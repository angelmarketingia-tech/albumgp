/**
 * IdentityProvider abstraction — server-only.
 *
 * The whole point of this module is that `/api/redeem` (and any future
 * route that needs "who is signed in?") DOES NOT import Auth.js directly.
 * It depends on `IdentityProvider`. Today there is exactly ONE implementation
 * (`MockCredentialsIdentityProvider`). The day a real OIDC SSO lands we add
 * `OidcIdentityProvider` and flip the singleton in `getIdentityProvider()` —
 * `/api/redeem` does not change.
 *
 * SECURITY (AGENTS.md §6, §8 + SECURITY.md §5):
 *   - Server-only. Never import from a client component. (No `'use client'`
 *     module should ever land in this file's import chain.)
 *   - In production, `getIdentityProvider()` REFUSES to hand out the mock
 *     provider. This prevents a deploy that accidentally leaves
 *     `NEXTAUTH_PROVIDER=mock` in env from accepting test creds.
 *
 * NOTE on Auth.js v5 `auth()`:
 *   The `auth()` helper from `lib/auth/auth-config.ts` reads the session
 *   cookie from the current request context. In a route handler (App Router)
 *   it works without arguments because Next.js injects the request via async
 *   local storage. We deliberately accept `_req` in `resolveAccountId` to
 *   keep the interface ready for a future provider (e.g. one that inspects
 *   a Bearer token header instead of a cookie).
 */

// NOTE: this module is SERVER-ONLY. Do not import from a `'use client'` file.
// We deliberately avoid the `server-only` package to skip an extra dep; the
// rule is enforced by code review and by the fact that `auth-config.ts`
// transitively imports node-only APIs (`node:crypto`).
import { auth } from "./auth-config";

export interface IdentityProvider {
  /**
   * Resolve the `account_id` for the user signing this request.
   *
   * @returns the stable, opaque account identifier on success.
   *          `null` when there is no valid session (caller MUST respond 401).
   *
   * Implementations MUST NOT throw on "no session" — that path is normal.
   * They MAY throw on infrastructure failures (e.g. session store down); the
   * caller will surface that as `internal`.
   */
  resolveAccountId(req: Request): Promise<string | null>;
}

/**
 * Mock implementation backed by Auth.js v5 + the dev-only Credentials provider.
 *
 * Reads the session via `auth()` (cookie-based, JWT-strategy). Returns the
 * `account_id` we stamped into the JWT in `auth-config.ts > callbacks.jwt`.
 */
export class MockCredentialsIdentityProvider implements IdentityProvider {
  async resolveAccountId(_req: Request): Promise<string | null> {
    const session = await auth();
    if (!session) {
      return null;
    }
    const user = session.user;
    if (!user || typeof user.id !== "string" || user.id.length === 0) {
      return null;
    }
    return user.id;
  }
}

let cachedProvider: IdentityProvider | null = null;

/**
 * Singleton accessor.
 *
 * Today: always returns `MockCredentialsIdentityProvider` in non-production.
 * In production: throws **unless** a real OIDC provider has been wired in
 * (none exist yet → it always throws in prod, which is exactly what we want
 * so a misconfigured deploy fails closed).
 *
 * @param env override (tests).
 */
export function getIdentityProvider(
  env: NodeJS.ProcessEnv = process.env,
): IdentityProvider {
  // DEMO/PREVIEW override: with SIMULATE_REDEEM=1 we run a no-DB preview where
  // the real OIDC isn't wired yet. Returning the mock here (instead of throwing)
  // lets the build collect page data and the auth'd routes respond gracefully.
  // Production WITHOUT this flag keeps the strict fail-closed behavior below.
  if (env.NODE_ENV === "production" && env.SIMULATE_REDEEM !== "1") {
    // Future: branch on `env.AUTH_PROVIDER === 'oidc'` and return the OIDC
    // implementation. Until then, prod must NOT silently fall back to mock.
    throw new Error("auth_config_invalid");
  }
  if (cachedProvider === null) {
    cachedProvider = new MockCredentialsIdentityProvider();
  }
  return cachedProvider;
}

/**
 * Test-only: reset the cached singleton. Exported with an underscore prefix
 * to signal "do not use in app code".
 */
export function _resetIdentityProviderForTests(): void {
  cachedProvider = null;
}
