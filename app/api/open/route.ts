// POST /api/open — validate a code and reveal its envelope.
//
// SERVER ONLY. AGENTS.md §3 (open vs redeem), §5 (codes model), §8 (security).
// SECURITY.md §2 (validation flow) + §5 (generic response convention).
//
// Flow:
//   1. Parse + Zod-validate the body. Bad body → 400 invalid_input.
//   2. Rate-limit: IP (10/min) + hashed-code (5/min). Either trips → 429.
//   3. DB lookup (unique index on `code`).
//   4. Reject `unknown / disabled / expired / consumed / past expires_at`
//      with a SINGLE 404 not_found_or_unavailable (no enumeration).
//   5. If pack_result already set → return it verbatim (re-open is idempotent).
//   6. Else resolve a new PackResult and persist atomically via a conditional
//      `updateMany` (count==0 → race lost, re-read and return whatever stuck).
//   7. Response shape: `{ pack, country }`. NOTHING else. No code, no ids,
//      no prize_set internals, no weights.

import { createHash } from "node:crypto";
import type { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import {
  codeInputSchema,
  packResultSchema,
  resolvePack,
  type PrizeSetData,
  type PackResult,
  type Prize,
  type VariablePoolEntry,
} from "@/lib/prizes";
import { keyForCode, keyForIp } from "@/lib/redis/rate-limit";
import { genericError, ok } from "@/lib/security/response";
import { withRateLimit, type RateLimitRule } from "@/lib/security/with-rate-limit";

// Force the Node.js runtime — Prisma + node:crypto.randomInt are not Edge-safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OpenSuccess {
  pack: PackResult;
  country: "SV" | "GT";
}

/**
 * Logging helper — never leaks secrets. Codes are referenced by their
 * SHA-256 hex hash so we can correlate without exposing them in logs.
 */
function hashCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

function logInfo(event: string, fields: Record<string, unknown>): void {
  // Structured single-line log. Keep it cheap and grep-friendly.
  console.log(JSON.stringify({ level: "info", event, ...fields }));
}

function logWarn(event: string, fields: Record<string, unknown>): void {
  console.warn(JSON.stringify({ level: "warn", event, ...fields }));
}

function logError(event: string, fields: Record<string, unknown>): void {
  console.error(JSON.stringify({ level: "error", event, ...fields }));
}

/**
 * Best-effort body parse. Returns `null` (not throws) on any malformation so
 * the handler can respond with a generic 400 without leaking parser details.
 */
async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/**
 * Cast a `prizeSet` row (Prisma `Json` fields are `JsonValue`) into the
 * resolver's input shape. Validation against `packResultSchema` happens
 * inside `resolvePack`, so a bad config raises there (caught here).
 */
function toPrizeSetData(prizeSet: {
  guaranteed: Prisma.JsonValue;
  variablePool: Prisma.JsonValue;
  cardsPerPack: number;
}): PrizeSetData {
  // We trust schema-typed JSON because writes are gated by `packResultSchema`
  // (resolve) or migration seeds. Resolver also defensively handles bad data.
  return {
    guaranteed: prizeSet.guaranteed as unknown as Prize[],
    variable_pool: prizeSet.variablePool as unknown as VariablePoolEntry[],
    cards_per_pack: prizeSet.cardsPerPack,
  };
}

const openHandler = async (req: Request): Promise<NextResponse> => {
  const body = await readJsonBody(req);
  if (body === null || typeof body !== "object") {
    return genericError(400, "invalid_input");
  }

  const parsed = codeInputSchema.safeParse(body);
  if (!parsed.success) {
    return genericError(400, "invalid_input");
  }

  const code = parsed.data.code;
  const codeHash = hashCode(code);

  logInfo("open.request", { code_hash: codeHash });

  let codeRow;
  try {
    codeRow = await prisma.code.findUnique({
      where: { code },
      include: { prizeSet: true },
    });
  } catch (err) {
    logError("open.db_lookup_failed", {
      code_hash: codeHash,
      message: err instanceof Error ? err.message : "unknown",
      stack: err instanceof Error ? err.stack : undefined,
    });
    return genericError(500, "internal");
  }

  if (!codeRow) {
    logWarn("open.rejected", { code_hash: codeHash, reason: "not_found" });
    return genericError(404, "not_found_or_unavailable");
  }

  if (codeRow.status !== "active") {
    logWarn("open.rejected", {
      code_hash: codeHash,
      reason: `status:${codeRow.status}`,
    });
    return genericError(404, "not_found_or_unavailable");
  }

  if (codeRow.expiresAt && codeRow.expiresAt.getTime() <= Date.now()) {
    logWarn("open.rejected", { code_hash: codeHash, reason: "expired_at" });
    return genericError(404, "not_found_or_unavailable");
  }

  // Re-open path: pack_result already set on a previous successful open.
  if (codeRow.packResult !== null && codeRow.packResult !== undefined) {
    try {
      const existing = packResultSchema.parse(codeRow.packResult);
      logInfo("open.reopened", { code_hash: codeHash });
      const response: OpenSuccess = { pack: existing, country: codeRow.country };
      return ok(response);
    } catch (err) {
      // Stored pack_result is malformed. Don't re-resolve (we'd diverge from
      // what the user saw the first time). Treat as unavailable.
      logError("open.stored_pack_invalid", {
        code_hash: codeHash,
        message: err instanceof Error ? err.message : "unknown",
      });
      return genericError(404, "not_found_or_unavailable");
    }
  }

  // First open: resolve, then persist atomically.
  let resolved: PackResult;
  try {
    resolved = resolvePack(toPrizeSetData(codeRow.prizeSet));
  } catch (err) {
    logError("open.resolve_failed", {
      code_hash: codeHash,
      message: err instanceof Error ? err.message : "unknown",
      stack: err instanceof Error ? err.stack : undefined,
    });
    return genericError(500, "internal");
  }

  // Conditional update: only writes when `pack_result IS NULL`. If a
  // concurrent request beat us, count===0 and we re-read.
  let writtenCount = 0;
  try {
    const result = await prisma.code.updateMany({
      where: { id: codeRow.id, packResult: { equals: Prisma.JsonNull } },
      data: {
        packResult: resolved as unknown as Prisma.InputJsonValue,
        openedAt: codeRow.openedAt ?? new Date(),
      },
    });
    writtenCount = result.count;
  } catch (err) {
    logError("open.persist_failed", {
      code_hash: codeHash,
      message: err instanceof Error ? err.message : "unknown",
      stack: err instanceof Error ? err.stack : undefined,
    });
    return genericError(500, "internal");
  }

  if (writtenCount === 0) {
    // Race lost — someone else fixed pack_result first. Use theirs.
    let refreshed;
    try {
      refreshed = await prisma.code.findUnique({
        where: { id: codeRow.id },
        select: { packResult: true, country: true, status: true, expiresAt: true },
      });
    } catch (err) {
      logError("open.race_refetch_failed", {
        code_hash: codeHash,
        message: err instanceof Error ? err.message : "unknown",
      });
      return genericError(500, "internal");
    }
    if (
      !refreshed ||
      refreshed.packResult === null ||
      refreshed.packResult === undefined
    ) {
      logError("open.race_pack_missing", { code_hash: codeHash });
      return genericError(404, "not_found_or_unavailable");
    }
    try {
      const winning = packResultSchema.parse(refreshed.packResult);
      logInfo("open.race_lost_returning_winner", { code_hash: codeHash });
      const response: OpenSuccess = { pack: winning, country: refreshed.country };
      return ok(response);
    } catch (err) {
      logError("open.race_pack_invalid", {
        code_hash: codeHash,
        message: err instanceof Error ? err.message : "unknown",
      });
      return genericError(404, "not_found_or_unavailable");
    }
  }

  logInfo("open.opened", { code_hash: codeHash });
  const response: OpenSuccess = { pack: resolved, country: codeRow.country };
  return ok(response);
};

/**
 * Rules builder: we re-read the body inside `withRateLimit` to derive the
 * code key. The handler also re-reads via `req.json()` — but `Request#json`
 * is single-shot. So we clone the request for the rules builder and let the
 * handler consume the original. (Alternatively we'd pass the parsed body via
 * context, but the HOF signature is intentionally agnostic.)
 *
 * Approach taken: gate IP first (always applicable). For the code key, peek
 * at the body via a clone; if it doesn't parse to a valid code shape, skip
 * the code rule — the handler will then 400 on the same body.
 */
async function buildRules(req: Request): Promise<RateLimitRule[]> {
  const rules: RateLimitRule[] = [
    { key: keyForIp(req, "open"), max: 10, windowSeconds: 60 },
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
            key: keyForCode(normalized, "open"),
            max: 5,
            windowSeconds: 60,
          });
        }
      }
    }
  } catch {
    // Body unreadable — IP rule alone is fine; handler will 400.
  }

  return rules;
}

const rateLimited = withRateLimit<unknown>(buildRules, openHandler);

export async function POST(req: Request): Promise<NextResponse> {
  return rateLimited(req, undefined);
}
