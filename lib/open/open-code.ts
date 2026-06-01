// Pure open-code pipeline. Shared by POST /api/open and the server-rendered
// /sobre/[code] page so both paths share one IP-attributed logic + log shape.
//
// SERVER ONLY. AGENTS.md §3 (open vs redeem), §5 (codes model), §8 (security).
// SECURITY.md §2 (validation flow) + §5 (generic response convention).
//
// Returns a transport-agnostic `{ ok, status, body }` — the caller wraps it in
// NextResponse (route) or consumes it directly (RSC). Body shape mirrors the
// public API: `{ pack, country, tier }` on success, `{ error }` on failure.

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import {
  codeInputSchema,
  packResultSchema,
  resolvePack,
  tierFromValue,
  type EnvelopeTier,
  type PrizeSetData,
  type PackResult,
} from "@/lib/prizes";
import { prizeSchema, variablePoolEntrySchema } from "@/lib/prizes/schemas";
import { keyForCode, rateLimit } from "@/lib/redis/rate-limit";
import type { ErrorCode } from "@/lib/security/response";

export interface OpenSuccessBody {
  pack: PackResult;
  country: "SV" | "GT";
  tier: EnvelopeTier;
}

export interface OpenErrorBody {
  error: ErrorCode;
}

export type OpenCodeResult =
  | { ok: true; status: 200; body: OpenSuccessBody }
  | { ok: false; status: number; body: OpenErrorBody };

export interface OpenCodeInput {
  code: string;
  ip: string;
  userAgent?: string;
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

function toPrizeSetData(
  prizeSet: {
    id: string;
    guaranteed: Prisma.JsonValue;
    variablePool: Prisma.JsonValue;
    cardsPerPack: number;
  },
  code_hash: string,
): PrizeSetData {
  try {
    return {
      guaranteed: z.array(prizeSchema).parse(prizeSet.guaranteed),
      variable_pool: z.array(variablePoolEntrySchema).parse(prizeSet.variablePool),
      cards_per_pack: prizeSet.cardsPerPack,
    };
  } catch (err) {
    logError("open.prize_set_invalid", {
      code_hash,
      prize_set_id: prizeSet.id,
      error: String(err),
    });
    throw err;
  }
}

function err(status: number, code: ErrorCode): OpenCodeResult {
  return { ok: false, status, body: { error: code } };
}

/**
 * Open + reveal a code. Caller supplies `ip` (already extracted from the
 * request or the RSC `headers()` bag) so rate-limit attribution stays
 * consistent across entry points.
 */
export async function openCodeDirect(
  input: OpenCodeInput,
): Promise<OpenCodeResult> {
  const parsed = codeInputSchema.safeParse({ code: input.code });
  if (!parsed.success) {
    return err(400, "invalid_input");
  }

  const code = parsed.data.code;
  const codeHash = hashCode(code);

  logInfo("open.request", { code_hash: codeHash });

  let lookup;
  try {
    lookup = await prisma.code.findUnique({
      where: { code },
      select: {
        id: true,
        status: true,
        expiresAt: true,
        country: true,
        packResult: true,
        openedAt: true,
        prizeSet: { select: { tier: true } },
      },
    });
  } catch (e) {
    logError("open.db_lookup_failed", {
      code_hash: codeHash,
      message: e instanceof Error ? e.message : "unknown",
      stack: e instanceof Error ? e.stack : undefined,
    });
    return err(500, "internal");
  }

  if (!lookup) {
    logWarn("open.rejected", { code_hash: codeHash, reason: "not_found" });
    return err(404, "not_found_or_unavailable");
  }

  if (lookup.status !== "active") {
    logWarn("open.rejected", {
      code_hash: codeHash,
      reason: `status:${lookup.status}`,
    });
    return err(404, "not_found_or_unavailable");
  }

  if (lookup.expiresAt && lookup.expiresAt.getTime() <= Date.now()) {
    logWarn("open.rejected", { code_hash: codeHash, reason: "expired_at" });
    return err(404, "not_found_or_unavailable");
  }

  // Defensive: si la relación prizeSet falta (FK rota, mock parcial, etc.)
  // caemos a `bronce` en vez de crashear. Loggeamos para investigarlo después.
  if (lookup.prizeSet === null || lookup.prizeSet === undefined) {
    logError("open.prize_set_missing", {
      code_hash: codeHash,
      lookup_id: lookup.id,
    });
  }
  const tier: EnvelopeTier =
    tierFromValue(lookup.prizeSet?.tier) ?? "bronce";

  const isReopen = lookup.packResult !== null && lookup.packResult !== undefined;

  // Per-code limit runs on BOTH branches so an attacker can't probe an
  // already-opened code unboundedly; re-opens get a looser cap so legitimate
  // refreshes of /sobre/[code] don't get throttled.
  const codeResult = await rateLimit({
    key: keyForCode(code, "open"),
    max: isReopen ? 20 : 5,
    windowSeconds: 60,
  });
  if (!codeResult.allowed) {
    return err(429, "rate_limited");
  }

  // Per-IP limit only on the first-open branch — re-opens are idempotent reads
  // and an honest user hitting refresh on /sobre shouldn't trip a 60s lockout.
  if (!isReopen) {
    const ipKey = `rl:ip:open:${input.ip}`;
    const ipResult = await rateLimit({ key: ipKey, max: 10, windowSeconds: 60 });
    if (!ipResult.allowed) {
      return err(429, "rate_limited");
    }
  }

  // Re-open fast path: pack_result already set on a previous successful open.
  // Skip the heavy prizeSet load + resolution entirely.
  if (isReopen) {
    try {
      const existing = packResultSchema.parse(lookup.packResult);
      logInfo("open.reopened", { code_hash: codeHash });
      return {
        ok: true,
        status: 200,
        body: { pack: existing, country: lookup.country, tier },
      };
    } catch (e) {
      logError("open.stored_pack_invalid", {
        code_hash: codeHash,
        message: e instanceof Error ? e.message : "unknown",
      });
      return err(404, "not_found_or_unavailable");
    }
  }

  let codeRow;
  try {
    codeRow = await prisma.code.findUnique({
      where: { code },
      include: { prizeSet: true },
    });
  } catch (e) {
    logError("open.db_lookup_failed", {
      code_hash: codeHash,
      message: e instanceof Error ? e.message : "unknown",
      stack: e instanceof Error ? e.stack : undefined,
    });
    return err(500, "internal");
  }

  if (!codeRow) {
    logWarn("open.rejected", { code_hash: codeHash, reason: "not_found" });
    return err(404, "not_found_or_unavailable");
  }

  let resolved: PackResult;
  try {
    resolved = resolvePack(toPrizeSetData(codeRow.prizeSet, codeHash));
  } catch (e) {
    logError("open.resolve_failed", {
      code_hash: codeHash,
      message: e instanceof Error ? e.message : "unknown",
      stack: e instanceof Error ? e.stack : undefined,
    });
    return err(500, "internal");
  }

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
  } catch (e) {
    logError("open.persist_failed", {
      code_hash: codeHash,
      message: e instanceof Error ? e.message : "unknown",
      stack: e instanceof Error ? e.stack : undefined,
    });
    return err(500, "internal");
  }

  if (writtenCount === 0) {
    let refreshed;
    try {
      refreshed = await prisma.code.findUnique({
        where: { id: codeRow.id },
        select: { packResult: true, country: true, status: true, expiresAt: true },
      });
    } catch (e) {
      logError("open.race_refetch_failed", {
        code_hash: codeHash,
        message: e instanceof Error ? e.message : "unknown",
      });
      return err(500, "internal");
    }
    if (
      !refreshed ||
      refreshed.packResult === null ||
      refreshed.packResult === undefined
    ) {
      logError("open.race_pack_missing", { code_hash: codeHash });
      return err(404, "not_found_or_unavailable");
    }
    try {
      const winning = packResultSchema.parse(refreshed.packResult);
      logInfo("open.race_lost_returning_winner", { code_hash: codeHash });
      return {
        ok: true,
        status: 200,
        body: { pack: winning, country: refreshed.country, tier },
      };
    } catch (e) {
      logError("open.race_pack_invalid", {
        code_hash: codeHash,
        message: e instanceof Error ? e.message : "unknown",
      });
      return err(404, "not_found_or_unavailable");
    }
  }

  logInfo("open.opened", { code_hash: codeHash });
  return {
    ok: true,
    status: 200,
    body: { pack: resolved, country: codeRow.country, tier },
  };
}
