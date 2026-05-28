/**
 * `requireAccountId` — auth gate for route handlers.
 *
 * Pattern (App Router):
 *
 *   import { requireAccountId } from "@/lib/auth/require";
 *
 *   export async function POST(req: Request): Promise<NextResponse> {
 *     const guard = await requireAccountId(req);
 *     if (!guard.ok) return guard.response;
 *     const accountId: string = guard.accountId;
 *     // ...persist redemptions.account_id = accountId
 *   }
 *
 * SECURITY (SECURITY.md §5):
 *   - The 401 body is the generic `{ error: 'unauthenticated' }` — never any
 *     hint about WHY (no session vs expired vs malformed cookie).
 *   - The provider may throw on infrastructure failures; we map that to a
 *     generic 500 `internal` so caller code stays trivial.
 */

import type { NextResponse } from "next/server";
import { genericError } from "@/lib/security/response";
import {
  getIdentityProvider,
  type IdentityProvider,
} from "./identity";

export type RequireAccountIdResult =
  | { ok: true; accountId: string }
  | { ok: false; response: NextResponse };

/**
 * Resolve the caller's `account_id` or return a ready-to-send 401/500.
 *
 * @param req      the inbound request — passed through to the IdentityProvider.
 * @param provider optional override (tests). Defaults to the configured
 *                 singleton from `getIdentityProvider()`.
 */
export async function requireAccountId(
  req: Request,
  provider: IdentityProvider = getIdentityProvider(),
): Promise<RequireAccountIdResult> {
  let accountId: string | null;
  try {
    accountId = await provider.resolveAccountId(req);
  } catch {
    // Infra failure inside the provider (e.g. session store unreachable). We
    // intentionally swallow the cause here; the provider itself should log.
    return { ok: false, response: genericError(500, "internal") };
  }

  if (accountId === null || accountId.length === 0) {
    return { ok: false, response: genericError(401, "unauthenticated") };
  }

  return { ok: true, accountId };
}
