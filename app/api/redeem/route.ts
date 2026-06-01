// POST /api/redeem — HTTP adapter around `redeemCodeDirect`.
//
// SERVER ONLY. AGENTS.md §3 (open vs redeem), §6 (auth required), §8
// (security). The pipeline (atomic update, audit, webhook) lives in
// lib/redeem/redeem-code.ts so other entry points can reuse it.
//
// Flow:
//   1. Auth gate (`requireAccountId`). 401 if no session — done BEFORE
//      rate-limit so unauthenticated callers don't burn their IP bucket.
//   2. Parse body ONCE; pass the parsed value through ctx to both the
//      rate-limit rules builder and the handler.
//   3. Rate-limit: IP 5/min + hashed-code 1/min (only when code parses).
//   4. Delegate to `redeemCodeDirect`.
//   5. Map the discriminated union to status codes via genericError/ok.

import type { NextResponse } from "next/server";
import { requireAccountId } from "@/lib/auth/require";
import { redeemCodeDirect } from "@/lib/redeem/redeem-code";
import {
  extractClientIp,
  keyForCode,
  keyForIp,
} from "@/lib/redis/rate-limit";
import {
  genericError,
  ok,
  type ErrorCode,
} from "@/lib/security/response";
import {
  withRateLimit,
  type RateLimitRule,
} from "@/lib/security/with-rate-limit";

// Prisma + node:crypto.randomUUID inside the pipeline are not Edge-safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AuthedCtx {
  accountId: string;
  body: unknown;
}

const MAX_BODY_BYTES = 8192;

type ReadBodyResult =
  | { ok: true; body: unknown }
  | { ok: false; status: 415 | 413; code: ErrorCode };

// Gate parsing on declared content-type + length BEFORE awaiting req.json():
// trims CSRF surface (form posts can't reach the JSON parser) and caps body
// size so a malicious client can't stream an unbounded payload at us.
async function readJsonBody(req: Request): Promise<ReadBodyResult> {
  const contentType = req.headers.get("content-type");
  if (!contentType?.startsWith("application/json")) {
    return { ok: false, status: 415, code: "invalid_input" };
  }
  const lengthHeader = req.headers.get("content-length");
  const length = lengthHeader === null ? NaN : Number(lengthHeader);
  if (!Number.isFinite(length) || length <= 0 || length > MAX_BODY_BYTES) {
    return { ok: false, status: 413, code: "invalid_input" };
  }
  try {
    return { ok: true, body: await req.json() };
  } catch {
    return { ok: true, body: null };
  }
}

// Defense-in-depth beyond sameSite=lax: cross-origin POSTs that smuggle a
// JSON content-type still carry a foreign Origin, so we reject them here.
function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("host");
  if (host === null) {
    return false;
  }
  const source = origin ?? referer;
  if (source === null) {
    return false;
  }
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

function extractCode(body: unknown): string | null {
  if (body === null || typeof body !== "object" || !("code" in body)) {
    return null;
  }
  const candidate = (body as { code: unknown }).code;
  return typeof candidate === "string" ? candidate : null;
}

function failureToErrorCode(code: "invalid" | "already" | "auth" | "error"): ErrorCode {
  switch (code) {
    case "invalid":
      return "invalid_input";
    case "already":
      return "not_found_or_unavailable";
    case "auth":
      return "unauthenticated";
    case "error":
      return "internal";
  }
}

const redeemHandler = async (
  req: Request,
  ctx: AuthedCtx,
): Promise<NextResponse> => {
  const candidate = extractCode(ctx.body);
  if (candidate === null) {
    return genericError(400, "invalid_input");
  }

  const result = await redeemCodeDirect({
    code: candidate,
    accountId: ctx.accountId,
    ip: extractClientIp(req),
  });

  if (!result.ok) {
    // `error` failures from the pipeline cover both 409 conflicts and 500s;
    // map both onto the closest generic ErrorCode for that status.
    if (result.code === "error" && result.status === 409) {
      return genericError(409, "conflict");
    }
    return genericError(result.status, failureToErrorCode(result.code));
  }

  return ok(result.redemption);
};

/**
 * Rate-limit rules: IP always, plus per-code bucket when the body has a
 * parseable, well-formed code so a 400 later doesn't double-charge a code
 * bucket.
 */
function buildRules(req: Request, ctx: AuthedCtx): RateLimitRule[] {
  const rules: RateLimitRule[] = [
    { key: keyForIp(req, "redeem"), max: 5, windowSeconds: 60 },
  ];
  const candidate = extractCode(ctx.body);
  if (candidate !== null) {
    const normalized = candidate.trim().toUpperCase();
    if (/^[A-HJ-NP-Z2-9]{16}$/.test(normalized)) {
      // Compose with accountId so the buyer's own mobile retry / double-click
      // can replay (and hit the idempotent branch) while a different account
      // brute-forcing the same code is still throttled to 1/min.
      rules.push({
        key: `${keyForCode(normalized, "redeem")}:${ctx.accountId}`,
        max: 1,
        windowSeconds: 60,
      });
    }
  }
  return rules;
}

const rateLimited = withRateLimit<AuthedCtx>(buildRules, redeemHandler);

export async function POST(req: Request): Promise<NextResponse> {
  if (!isSameOrigin(req)) {
    // No "forbidden" in ErrorCode; "unauthenticated" is the closest public
    // mapping for a 403 cross-origin rejection.
    return genericError(403, "unauthenticated");
  }
  const guard = await requireAccountId(req);
  if (!guard.ok) {
    return guard.response;
  }
  const parsed = await readJsonBody(req);
  if (!parsed.ok) {
    return genericError(parsed.status, parsed.code);
  }
  return rateLimited(req, { accountId: guard.accountId, body: parsed.body });
}
