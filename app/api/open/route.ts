// POST /api/open — validate a code and reveal its envelope.
//
// SERVER ONLY. AGENTS.md §3 (open vs redeem), §5 (codes model), §8 (security).
// SECURITY.md §2 (validation flow) + §5 (generic response convention).
//
// Thin transport wrapper around `openCodeDirect` so the route and the
// server-rendered `/sobre/[code]` page share one pipeline (validation,
// rate-limit, DB lookup, resolve, persist, race handling, logging).

import { NextResponse } from "next/server";
import { codeInputSchema } from "@/lib/prizes";
import { openCodeDirect } from "@/lib/open/open-code";
import { extractClientIp } from "@/lib/redis/rate-limit";
import { genericError } from "@/lib/security/response";
import { SECURITY_HEADERS } from "@/lib/security/headers";

// Force the Node.js runtime — Prisma + node:crypto.randomInt are not Edge-safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cap raw POST body well below the JSON parser default so a 10MB payload
// cannot be buffered before validation rejects it.
const MAX_BODY_BYTES = 8192;

async function readJsonBody(req: Request): Promise<unknown> {
  const contentType = req.headers.get("content-type");
  if (!contentType || !contentType.toLowerCase().startsWith("application/json")) {
    return { __reject: 415 } as const;
  }
  const lengthHeader = req.headers.get("content-length");
  // Require an explicit, sane Content-Length — chunked/unknown-length bodies
  // bypass the cap and could buffer megabytes before JSON.parse rejects them.
  if (lengthHeader === null) {
    return { __reject: 413 } as const;
  }
  const length = Number(lengthHeader);
  if (!Number.isFinite(length) || length < 0 || length > MAX_BODY_BYTES) {
    return { __reject: 413 } as const;
  }
  try {
    return await req.json();
  } catch {
    return null;
  }
}

// Same-origin gate: a CORS-simple POST from any third-party site would still
// hit this endpoint with the visitor's IP, letting an attacker brute-force
// codes through unwitting browsers. Compare Origin (preferred) or Referer
// host against the request's own Host header.
function isSameOrigin(req: Request): boolean {
  const host = req.headers.get("host");
  if (!host) return false;
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const source = origin ?? referer;
  if (!source) return false;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!isSameOrigin(req)) {
    return genericError(403, "invalid_input");
  }

  const body = await readJsonBody(req);
  if (body !== null && typeof body === "object" && "__reject" in body) {
    const status = (body as { __reject: number }).__reject;
    return genericError(status === 415 ? 415 : 413, "invalid_input");
  }
  if (body === null || typeof body !== "object") {
    return genericError(400, "invalid_input");
  }

  const parsed = codeInputSchema.safeParse(body);
  if (!parsed.success) {
    return genericError(400, "invalid_input");
  }

  const result = await openCodeDirect({
    code: parsed.data.code,
    ip: extractClientIp(req),
  });

  return NextResponse.json(result.body, {
    status: result.status,
    headers: SECURITY_HEADERS,
  });
}
