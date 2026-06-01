/**
 * Auth.js v5 (next-auth@beta) configuration for AlbumGP.
 *
 * STATUS: Phase 3 — Wave 1. This is a **dev-only stub**. There is ONE provider
 * (a mock Credentials provider) gated hard on NODE_ENV !== 'production'. When
 * the real SSO arrives, swap the provider here and the `IdentityProvider`
 * implementation in `lib/auth/identity.ts`. `/api/redeem` does NOT touch this
 * file directly — it goes through `IdentityProvider` (see `lib/auth/identity.ts`).
 *
 * SECURITY (AGENTS.md §6, §8 + SECURITY.md §1, §5):
 *   - AUTH_SECRET is REQUIRED in production. In dev a stable derived secret is
 *     used so sessions survive reloads without random fluctuation.
 *   - JWT session strategy (no DB round-trip; cheap for serverless).
 *   - Cookies: httpOnly, sameSite=lax, secure only in production.
 *   - The session payload the CLIENT sees contains ONLY the opaque account id.
 *     The email lives in the JWT for server-side correlation but is NOT
 *     forwarded to `session.user` on the wire.
 *
 * @see lib/auth/mock-credentials.ts for the pure validator.
 * @see lib/auth/identity.ts for the `IdentityProvider` abstraction.
 */

import { createHash } from "node:crypto";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { validateMockCredentials } from "./mock-credentials";

/**
 * Derive a stable dev-only AUTH_SECRET from the project path when the env var
 * is absent. This is intentionally NOT random — we want cookies to remain
 * valid across `next dev` restarts. NEVER reached in production (the resolver
 * throws first; see `resolveAuthSecret`).
 */
function devFallbackSecret(): string {
  const seed = `albumgp-dev-${process.cwd()}`;
  return createHash("sha256").update(seed, "utf8").digest("hex");
}

function resolveAuthSecret(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.AUTH_SECRET;
  if (typeof raw === "string" && raw.length > 0) {
    return raw;
  }
  if (env.NODE_ENV === "production") {
    throw new Error("auth_config_invalid");
  }
  return devFallbackSecret();
}

/**
 * Internal Auth.js options. Exported as a constant (not the result of
 * `NextAuth(...)`) so it can be re-used by tests that want to introspect
 * the config without spinning up the handlers.
 */
export const authConfig: NextAuthConfig = {
  // JWT — cheap, serverless-friendly, no DB needed for sessions.
  session: { strategy: "jwt" },

  // Centralized secret resolution: throws in prod if AUTH_SECRET is missing.
  secret: resolveAuthSecret(),

  // Cookie hardening. `secure` only kicks in on prod (else dev over http breaks).
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  pages: {
    signIn: "/auth/signin",
  },

  // Provider registration is gated at CONFIG TIME on NODE_ENV. Previously the
  // mock Credentials provider was always registered and only the inner
  // `validateMockCredentials` runtime check protected prod — that leaks when
  // NODE_ENV is unset / 'staging' / 'preview'. Belt-and-suspenders: also keep
  // the runtime throw inside `validateMockCredentials`.
  providers:
    process.env.NODE_ENV === "production"
      ? []
      : [
          Credentials({
            id: "mock",
            name: "mock",
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            async authorize(raw) {
              // Delegates to a pure helper so we can unit-test it without Auth.js.
              // `validateMockCredentials` throws hard when NODE_ENV === 'production';
              // we re-throw with a generic message so Auth.js doesn't leak internals.
              try {
                const user = validateMockCredentials({
                  email: raw?.email,
                  password: raw?.password,
                });
                return user;
              } catch {
                throw new Error("auth_config_invalid");
              }
            },
          }),
        ],

  callbacks: {
    /**
     * Persist the stable account id (and the original email, server-only) into
     * the JWT on first login.
     */
    async jwt({ token, user }) {
      if (user && typeof user.id === "string") {
        // `account_id` is the persistence key (redemptions.account_id).
        token.account_id = user.id;
      }
      return token;
    },
    /**
     * Expose ONLY the opaque account id to the client. Email stays in the JWT
     * for server-side logging but is not forwarded to `session.user`.
     */
    async session({ session, token }) {
      const accountId =
        typeof token.account_id === "string" ? token.account_id : null;
      if (accountId && session.user) {
        session.user.id = accountId;
        // Defensive: scrub email from the wire payload even though Auth.js
        // would forward it by default. The IdentityProvider only needs `id`.
        if ("email" in session.user) {
          session.user.email = "";
        }
        if ("name" in session.user) {
          // Intentionally scrubbed to avoid leaking PII to the wire. Callers
          // that derive a `firstName` greeting (e.g. the album page) MUST
          // treat empty string as "no display name" and fall back — do NOT
          // render `Hola, !` when this is "".
          session.user.name = "";
        }
      }
      return session;
    },
  },
};

/**
 * Auth.js v5 entrypoint. Exports the route handlers AND the server-only
 * `auth()` helper used by the IdentityProvider.
 *
 *   - `handlers` → wired into `app/api/auth/[...nextauth]/route.ts`.
 *   - `auth()`   → server-only helper to read the current session inside
 *                   route handlers / RSC. Consumed by `MockCredentialsIdentityProvider`.
 *   - `signIn` / `signOut` → server actions for the signin page.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
