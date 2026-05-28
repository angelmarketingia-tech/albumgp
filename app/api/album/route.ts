// GET /api/album — return the redemption history of the signed-in user.
//
// SERVER ONLY. AGENTS.md §3 (album section), §6 (auth required), §8 (security);
// SECURITY.md §3 (rate limiting), §5 (response convention).
//
// Flow:
//   1. Auth gate (`requireAccountId`). 401 if no session. Done BEFORE Redis so
//      unauthenticated callers don't consume their own IP bucket.
//   2. Rate-limit: 60 req/min by IP. No per-code rule (the user owns the data
//      and there's nothing to brute-force here).
//   3. Run `getAlbumForAccount(prisma, accountId)`. Any throw → 500.
//   4. Return `ok(album)`. Shape is enforced by `AlbumResponse`.
//
// Response shape is deliberately minimal (see `lib/album/types.ts`): it does
// NOT carry internal `code_id`, `redemption.id`, plaintext `code`,
// `account_id`, `webhook_status`/`webhook_attempts`, `redeemed_ip`, etc.

import type { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { requireAccountId } from "@/lib/auth/require";
import { getAlbumForAccount } from "@/lib/album";
import { keyForIp } from "@/lib/redis/rate-limit";
import { genericError, ok } from "@/lib/security/response";
import {
  withRateLimit,
  type RateLimitRule,
} from "@/lib/security/with-rate-limit";

// Prisma + node-only APIs — not Edge-safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function logInfo(event: string, fields: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ level: "info", event, ...fields }));
}

function logError(event: string, fields: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ level: "error", event, ...fields }));
}

interface AuthedCtx {
  accountId: string;
}

/** Inner handler — runs AFTER auth + rate-limit guards have passed. */
const albumHandler = async (
  _req: Request,
  ctx: AuthedCtx,
): Promise<NextResponse> => {
  const accountId = ctx.accountId;
  logInfo("album.request", { account_id: accountId });

  try {
    const album = await getAlbumForAccount(prisma, accountId);
    logInfo("album.served", {
      account_id: accountId,
      count: album.redemptions.length,
    });
    return ok(album);
  } catch (err) {
    logError("album.query_failed", {
      account_id: accountId,
      message: err instanceof Error ? err.message : "unknown",
    });
    return genericError(500, "internal");
  }
};

// Rate-limit: read-only of the user's own data → permissive but bounded.
// 60 req/min/IP keeps the surface noisy enough to be safe without blocking
// legitimate polling (the album UI can refresh on demand).
function buildRules(req: Request): ReadonlyArray<RateLimitRule> {
  const rules: RateLimitRule[] = [
    { key: keyForIp(req, "album"), max: 60, windowSeconds: 60 },
  ];
  return rules;
}

const rateLimited = withRateLimit<AuthedCtx>(buildRules, albumHandler);

export async function GET(req: Request): Promise<NextResponse> {
  // 1. AUTH GATE — runs BEFORE rate-limit on purpose: unauthenticated callers
  // shouldn't consume their own IP bucket.
  const guard = await requireAccountId(req);
  if (!guard.ok) {
    return guard.response;
  }
  return rateLimited(req, { accountId: guard.accountId });
}
