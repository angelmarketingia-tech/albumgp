// POST /api/redeem — atomically redeem a code and notify the central platform.
//
// SERVER ONLY. AGENTS.md §3 (open vs redeem), §5 (atomic redemption), §6
// (auth required), §8 (security), §12 (audit trail).
// SECURITY.md §2 (validation flow), §5 (response convention), §6 (webhook).
//
// Flow (order matters — DO NOT rearrange):
//   1. Auth gate (`requireAccountId`). 401 if no session. Done BEFORE Redis
//      so we don't burn rate-limit on unauthenticated callers.
//   2. Parse + Zod-validate body. Bad body → 400.
//   3. Rate-limit: IP (5/min) + hashed-code (1/min). 429 if either trips.
//   4. ATOMIC redemption via a single conditional `updateMany WHERE
//      status='active' AND NOT expired`. count===0 → 404 generic.
//   5. Re-read the row (now `redeemed`) to grab `id`, `country`, `pack_result`.
//   6. Validate `pack_result` defensively (could be null/corrupt). 409 if so.
//   7. Insert into `redemptions` (audit row, status=pending).
//   8. Fire webhook (await — we want the status to persist deterministically).
//   9. Update `redemptions.webhook_status/attempts/last_error`.
//  10. Return generic `{ status, prizes, country }`. NO code/id/account_id.

import { createHash, randomUUID } from "node:crypto";
import type { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { requireAccountId } from "@/lib/auth/require";
import {
  codeInputSchema,
  packResultSchema,
  type PackResult,
} from "@/lib/prizes";
import {
  extractClientIp,
  keyForCode,
  keyForIp,
} from "@/lib/redis/rate-limit";
import { genericError, ok } from "@/lib/security/response";
import {
  withRateLimit,
  type RateLimitRule,
} from "@/lib/security/with-rate-limit";
import { sendRedemptionWebhook } from "@/lib/webhook/sender";
import type { RedemptionWebhookPayload } from "@/lib/webhook/types";

// Force Node.js runtime — Prisma + node:crypto.randomUUID are not Edge-safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RedeemSuccess {
  status: "redeemed";
  prizes: PackResult;
  country: "SV" | "GT";
}

function hashCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

function logInfo(event: string, fields: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ level: "info", event, ...fields }));
}

function logWarn(event: string, fields: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.warn(JSON.stringify({ level: "warn", event, ...fields }));
}

function logError(event: string, fields: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ level: "error", event, ...fields }));
}

async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

interface AuthedCtx {
  accountId: string;
}

/** Inner handler — runs AFTER auth + rate-limit guards have passed. */
const redeemHandler = async (
  req: Request,
  ctx: AuthedCtx,
): Promise<NextResponse> => {
  const accountId = ctx.accountId;

  const body = await readJsonBody(req);
  if (body === null || typeof body !== "object") {
    logWarn("redeem.rejected", {
      account_id: accountId,
      reason: "body_unparseable",
    });
    return genericError(400, "invalid_input");
  }

  const parsed = codeInputSchema.safeParse(body);
  if (!parsed.success) {
    logWarn("redeem.rejected", {
      account_id: accountId,
      reason: "zod_invalid",
    });
    return genericError(400, "invalid_input");
  }

  const code = parsed.data.code;
  const codeHash = hashCode(code);

  logInfo("redeem.request", {
    code_hash: codeHash,
    account_id: accountId,
  });

  // -- Atomic redemption ---------------------------------------------------
  // ONLY operation that mutates the code's `status`. Conditional updateMany:
  //   - status MUST be 'active' (the predicate is the lock)
  //   - expires_at NULL OR in the future
  // Any concurrent request flips status='redeemed' first; the loser sees
  // count===0 and we return the generic 404.
  const now = new Date();
  const redeemedIp = extractClientIp(req);

  let updateCount: number;
  try {
    const result = await prisma.code.updateMany({
      where: {
        code,
        status: "active",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: {
        status: "redeemed",
        redeemedAt: now,
        redeemedBy: accountId,
        redeemedIp,
      },
    });
    updateCount = result.count;
  } catch (err) {
    logError("redeem.atomic_update_failed", {
      code_hash: codeHash,
      account_id: accountId,
      message: err instanceof Error ? err.message : "unknown",
    });
    return genericError(500, "internal");
  }

  if (updateCount === 0) {
    logWarn("redeem.rejected", {
      code_hash: codeHash,
      account_id: accountId,
      reason: "code_not_active",
    });
    return genericError(404, "not_found_or_unavailable");
  }

  // -- Re-read the row to obtain id, country, pack_result ------------------
  // Defensive: after a successful updateMany this row must exist with the
  // updated status. If it doesn't (or pack_result is null/corrupt) we treat
  // it as a conflict — we already consumed the code but can't honor it.
  let codeRow: {
    id: string;
    country: "SV" | "GT";
    packResult: Prisma.JsonValue | null;
  } | null;
  try {
    codeRow = await prisma.code.findUnique({
      where: { code },
      select: { id: true, country: true, packResult: true },
    });
  } catch (err) {
    logError("redeem.reread_failed", {
      code_hash: codeHash,
      account_id: accountId,
      message: err instanceof Error ? err.message : "unknown",
    });
    return genericError(500, "internal");
  }

  if (codeRow === null) {
    // Should never happen — we just successfully updated by `code`.
    logError("redeem.anomaly_row_missing", {
      code_hash: codeHash,
      account_id: accountId,
    });
    return genericError(409, "conflict");
  }

  if (codeRow.packResult === null || codeRow.packResult === undefined) {
    logError("redeem.anomaly_pack_missing", {
      code_hash: codeHash,
      account_id: accountId,
      code_id: codeRow.id,
    });
    return genericError(409, "conflict");
  }

  let packResult: PackResult;
  try {
    packResult = packResultSchema.parse(codeRow.packResult);
  } catch (err) {
    logError("redeem.pack_invalid", {
      code_hash: codeHash,
      account_id: accountId,
      code_id: codeRow.id,
      message: err instanceof Error ? err.message : "unknown",
    });
    return genericError(409, "conflict");
  }

  // -- Create audit row in `redemptions` -----------------------------------
  // `codeId` is `@unique`, so a duplicate attempt (impossible in practice
  // after a successful atomic update) collapses to P2002 → 409.
  const deliveryId = randomUUID();

  let redemptionId: string;
  let redemptionCreatedAt: Date;
  try {
    const redemption = await prisma.redemption.create({
      data: {
        codeId: codeRow.id,
        accountId,
        result: packResult as unknown as Prisma.InputJsonValue,
        webhookStatus: "pending",
        webhookAttempts: 0,
      },
      select: { id: true, createdAt: true },
    });
    redemptionId = redemption.id;
    redemptionCreatedAt = redemption.createdAt;
  } catch (err) {
    // P2002 = unique constraint violation (codeId already has a redemption).
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      logError("redeem.duplicate_redemption", {
        code_hash: codeHash,
        account_id: accountId,
        code_id: codeRow.id,
      });
      return genericError(409, "conflict");
    }
    logError("redeem.redemption_create_failed", {
      code_hash: codeHash,
      account_id: accountId,
      code_id: codeRow.id,
      message: err instanceof Error ? err.message : "unknown",
    });
    return genericError(500, "internal");
  }

  // -- Fire webhook (await) ------------------------------------------------
  const payload: RedemptionWebhookPayload = {
    event: "redemption",
    code_id: codeRow.id,
    code_hash: codeHash,
    country: codeRow.country,
    account_id: accountId,
    prizes: packResult,
    redeemed_at: redemptionCreatedAt.toISOString(),
    delivery_id: deliveryId,
  };

  const delivery = await sendRedemptionWebhook(payload);

  // -- Persist webhook outcome on the redemption row ----------------------
  try {
    await prisma.redemption.update({
      where: { id: redemptionId },
      data: {
        webhookStatus: delivery.status,
        webhookAttempts: delivery.attempts,
        webhookLastError: delivery.lastError ?? null,
      },
    });
  } catch (err) {
    // The redemption is already valid; failing to persist the webhook
    // status is a logged anomaly but doesn't reverse the user-facing
    // success. The webhook itself is re-driveable from the redemption row
    // (manual reconciliation, future Phase).
    logError("redeem.webhook_status_persist_failed", {
      code_hash: codeHash,
      account_id: accountId,
      code_id: codeRow.id,
      delivery_id: deliveryId,
      message: err instanceof Error ? err.message : "unknown",
    });
  }

  if (delivery.status === "failed") {
    logError("redeem.webhook_failed", {
      code_hash: codeHash,
      account_id: accountId,
      code_id: codeRow.id,
      delivery_id: deliveryId,
      attempts: delivery.attempts,
      error: delivery.lastError ?? "unknown",
    });
    // From the USER's POV, the redemption still succeeded — the prize is
    // recorded and the webhook is re-driveable. See AGENTS.md §5 + lead's
    // decision in Phase 3 Wave 2.
  }

  logInfo("redeem.success", {
    code_hash: codeHash,
    account_id: accountId,
    code_id: codeRow.id,
    delivery_id: deliveryId,
    webhook_status: delivery.status,
    webhook_attempts: delivery.attempts,
  });

  const response: RedeemSuccess = {
    status: "redeemed",
    prizes: packResult,
    country: codeRow.country,
  };
  return ok(response);
};

/**
 * Build rate-limit rules from the request. IP rule always applies; the
 * code rule applies only when the body has a parseable code (so a 400
 * later doesn't double-charge a code bucket needlessly).
 */
async function buildRules(req: Request): Promise<RateLimitRule[]> {
  const rules: RateLimitRule[] = [
    { key: keyForIp(req, "redeem"), max: 5, windowSeconds: 60 },
  ];
  try {
    const clone = req.clone();
    const peek = (await clone.json()) as unknown;
    if (peek && typeof peek === "object" && "code" in peek) {
      const candidate = (peek as { code: unknown }).code;
      if (typeof candidate === "string") {
        const normalized = candidate.trim().toUpperCase();
        if (/^[A-HJ-NP-Z2-9]{16}$/.test(normalized)) {
          rules.push({
            key: keyForCode(normalized, "redeem"),
            max: 1,
            windowSeconds: 60,
          });
        }
      }
    }
  } catch {
    // Body unreadable → IP rule alone is fine; handler will 400.
  }
  return rules;
}

const rateLimited = withRateLimit<AuthedCtx>(buildRules, redeemHandler);

export async function POST(req: Request): Promise<NextResponse> {
  // 1. AUTH GATE — runs BEFORE rate-limit on purpose: unauthenticated
  // callers shouldn't consume their own IP bucket.
  const guard = await requireAccountId(req);
  if (!guard.ok) {
    return guard.response;
  }
  return rateLimited(req, { accountId: guard.accountId });
}
