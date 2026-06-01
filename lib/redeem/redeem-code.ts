// Pure redeem pipeline. Mirrors lib/open/open-code.ts: extracts the atomic
// status-flip, audit-row insert, and webhook fire-and-await from the HTTP
// handler so the same logic can be reused by future entry points (RSC,
// internal jobs) with consistent log shape + status semantics.
//
// SERVER ONLY. AGENTS.md §3 (open vs redeem), §5 (atomic redemption), §6
// (auth required — but enforced by the caller), §8 (security), §12 (audit).
// SECURITY.md §2 (validation), §5 (response convention), §6 (webhook).
//
// Returns a transport-agnostic discriminated union. The HTTP route adapts it
// to genericError(status, code) / ok(body). Auth is caller responsibility:
// `'auth'` is reserved in the failure union so callers (or this function in
// future revisions) can surface it without a type churn.

import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import {
  codeInputSchema,
  packResultSchema,
  type PackResult,
} from "@/lib/prizes";
import { sendRedemptionWebhook } from "@/lib/webhook/sender";
import type { RedemptionWebhookPayload } from "@/lib/webhook/types";

// Vercel-only helper: keeps the serverless invocation alive for background work
// after the HTTP response is flushed. Loaded via guarded dynamic require so we
// don't pull a hard dep when running outside Vercel (local dev, vitest).
// Falling back to a floating promise is acceptable in non-Vercel environments
// because there's no host process to terminate before it settles.
type WaitUntilFn = (promise: Promise<unknown>) => void;
const waitUntil: WaitUntilFn = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const mod = require("@vercel/functions") as { waitUntil?: WaitUntilFn };
    if (typeof mod.waitUntil === "function") return mod.waitUntil;
  } catch {
    /* not on Vercel — promise floats to completion under the Node loop */
  }
  return (p: Promise<unknown>) => {
    void p.catch(() => {
      /* errors are logged inside the task itself */
    });
  };
})();

export interface RedemptionSuccess {
  status: "redeemed";
  prizes: PackResult;
  country: "SV" | "GT";
}

export type RedeemFailureCode = "invalid" | "already" | "auth" | "error";

export type RedeemCodeResult =
  | { ok: true; redemption: RedemptionSuccess }
  | { ok: false; status: number; code: RedeemFailureCode };

export interface RedeemCodeInput {
  code: string;
  accountId: string;
  ip: string;
}

function hashCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

function logInfo(event: string, fields: Record<string, unknown>): void {
  console.log(JSON.stringify({ level: "info", event, ...fields }));
}

function logWarn(event: string, fields: Record<string, unknown>): void {
  console.warn(JSON.stringify({ level: "warn", event, ...fields }));
}

function logError(event: string, fields: Record<string, unknown>): void {
  console.error(JSON.stringify({ level: "error", event, ...fields }));
}

function fail(status: number, code: RedeemFailureCode): RedeemCodeResult {
  return { ok: false, status, code };
}

/**
 * Redeem a code on behalf of `accountId`. Caller supplies `ip` (already
 * extracted from the request) so it's recorded on the code row for audit.
 *
 * Webhook is NOT awaited inside the request lifecycle: sender backoffs
 * (1s/5s/30s) + 10s per-attempt timeout could stall the response ~36s and
 * exceed Vercel's function limit. We persist the redemption row with
 * `webhookStatus='pending'`, return success immediately, and fire the delivery
 * via `waitUntil` so the platform keeps the invocation alive long enough to
 * update the row with the final status.
 */
export async function redeemCodeDirect(
  input: RedeemCodeInput,
): Promise<RedeemCodeResult> {
  const parsed = codeInputSchema.safeParse({ code: input.code });
  if (!parsed.success) {
    logWarn("redeem.rejected", {
      account_id: input.accountId,
      reason: "zod_invalid",
    });
    return fail(400, "invalid");
  }

  const code = parsed.data.code;
  const codeHash = hashCode(code);
  const accountId = input.accountId;

  logInfo("redeem.request", {
    code_hash: codeHash,
    account_id: accountId,
  });

  // -- Atomic redemption ---------------------------------------------------
  // ONLY operation that mutates the code's `status`. The conditional
  // updateMany is the lock: a concurrent winner flips status='redeemed'
  // first; the loser sees count===0 and we return the generic 404.
  const now = new Date();

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
        redeemedIp: input.ip,
      },
    });
    updateCount = result.count;
  } catch (err) {
    logError("redeem.atomic_update_failed", {
      code_hash: codeHash,
      account_id: accountId,
      message: err instanceof Error ? err.message : "unknown",
    });
    return fail(500, "error");
  }

  if (updateCount === 0) {
    // Idempotent replay: same account retrying its own already-redeemed code
    // should see success, not 404. Cross-account/different-session callers
    // still fall through to the generic 'already'.
    try {
      const existing = await prisma.code.findUnique({
        where: { code },
        select: { redeemedBy: true, packResult: true, country: true },
      });
      if (
        existing?.redeemedBy === accountId &&
        existing.packResult !== null &&
        existing.packResult !== undefined
      ) {
        const parsedPack = packResultSchema.parse(existing.packResult);
        logInfo("redeem.idempotent_replay", {
          code_hash: codeHash,
          account_id: accountId,
        });
        return {
          ok: true,
          redemption: {
            status: "redeemed",
            prizes: parsedPack,
            country: existing.country,
          },
        };
      }
    } catch (err) {
      logError("redeem.idempotent_replay_failed", {
        code_hash: codeHash,
        account_id: accountId,
        message: err instanceof Error ? err.message : "unknown",
      });
    }

    logWarn("redeem.rejected", {
      code_hash: codeHash,
      account_id: accountId,
      reason: "code_not_active",
    });
    return fail(404, "already");
  }

  // -- Re-read for id, country, pack_result --------------------------------
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
    return fail(500, "error");
  }

  if (codeRow === null) {
    logError("redeem.anomaly_row_missing", {
      code_hash: codeHash,
      account_id: accountId,
    });
    return fail(409, "error");
  }

  if (codeRow.packResult === null || codeRow.packResult === undefined) {
    logError("redeem.anomaly_pack_missing", {
      code_hash: codeHash,
      account_id: accountId,
      code_id: codeRow.id,
    });
    return fail(409, "error");
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
    return fail(409, "error");
  }

  // -- Audit row -----------------------------------------------------------
  // `codeId` is @unique, so a duplicate (impossible after a successful atomic
  // update) collapses to P2002 → 409.
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
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      logError("redeem.duplicate_redemption", {
        code_hash: codeHash,
        account_id: accountId,
        code_id: codeRow.id,
      });
      return fail(409, "error");
    }
    logError("redeem.redemption_create_failed", {
      code_hash: codeHash,
      account_id: accountId,
      code_id: codeRow.id,
      message: err instanceof Error ? err.message : "unknown",
    });
    return fail(500, "error");
  }

  // -- Webhook (fire-and-forget; status persisted asynchronously) ----------
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

  // webhookStatus convention on `redemptions.webhook_status`:
  //   'pending' → not yet delivered OR delivered in dry-run (sender returned
  //              attempts=0 because WEBHOOK_CENTRAL_URL is unset). Keeping
  //              dry-runs as 'pending' lets historical audits distinguish them
  //              from real 'sent' deliveries to central.
  //   'sent'    → at least one real fetch returned 2xx.
  //   'failed'  → all 3 attempts exhausted without a 2xx.
  const codeId = codeRow.id;
  waitUntil(
    sendRedemptionWebhook(payload)
      .then(async (delivery) => {
        const isDryRun = delivery.status === "sent" && delivery.attempts === 0;
        const persistedStatus = isDryRun ? "pending" : delivery.status;
        try {
          await prisma.redemption.update({
            where: { id: redemptionId },
            data: {
              webhookStatus: persistedStatus,
              webhookAttempts: delivery.attempts,
              webhookLastError: delivery.lastError ?? null,
            },
          });
        } catch (err) {
          // Redemption is already valid; failing to persist webhook status is
          // a logged anomaly but doesn't reverse user-facing success — the
          // webhook is re-driveable from the redemption row.
          logError("redeem.webhook_status_persist_failed", {
            code_hash: codeHash,
            account_id: accountId,
            code_id: codeId,
            delivery_id: deliveryId,
            message: err instanceof Error ? err.message : "unknown",
          });
        }

        if (delivery.status === "failed") {
          logError("redeem.webhook_failed", {
            code_hash: codeHash,
            account_id: accountId,
            code_id: codeId,
            delivery_id: deliveryId,
            attempts: delivery.attempts,
            error: delivery.lastError ?? "unknown",
          });
          // From the USER's POV the redemption still succeeded — see AGENTS.md §5.
        }

        logInfo("redeem.webhook_settled", {
          code_hash: codeHash,
          account_id: accountId,
          code_id: codeId,
          delivery_id: deliveryId,
          webhook_status: persistedStatus,
          webhook_attempts: delivery.attempts,
        });
      })
      .catch((err: unknown) => {
        // Sender is supposed to swallow its own errors; this branch covers an
        // unexpected throw so the floating promise never rejects unhandled.
        logError("redeem.webhook_task_threw", {
          code_hash: codeHash,
          account_id: accountId,
          code_id: codeId,
          delivery_id: deliveryId,
          message: err instanceof Error ? err.message : "unknown",
        });
      }),
  );

  logInfo("redeem.success", {
    code_hash: codeHash,
    account_id: accountId,
    code_id: codeRow.id,
    delivery_id: deliveryId,
    webhook_status: "pending",
  });

  return {
    ok: true,
    redemption: {
      status: "redeemed",
      prizes: packResult,
      country: codeRow.country,
    },
  };
}
