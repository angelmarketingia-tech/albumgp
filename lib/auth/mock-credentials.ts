/**
 * Pure validator + id-derivation for the dev-only mock Credentials provider.
 *
 * This file is intentionally **framework-agnostic** (no Auth.js imports) so:
 *   - The hard "fail in production" guard is testable in isolation.
 *   - The stable account-id derivation is testable in isolation.
 *   - `authorize` in `auth-config.ts` is a thin wrapper around `validateMockCredentials`.
 *
 * SECURITY (AGENTS.md §6, §8 + SECURITY.md §1):
 *   - Mock auth NEVER accepts credentials when `NODE_ENV === 'production'`.
 *   - The mock password lives in `MOCK_AUTH_PASSWORD` (env, server-only). Empty
 *     value => the provider rejects ALL attempts (fail-closed).
 *   - The account id is `mock:` + first 16 hex chars of `SHA-256(email)` —
 *     stable across reloads, opaque enough that the email is not trivially
 *     recoverable from logs, and namespaced so a future OIDC provider's ids
 *     can't collide with mock ones.
 */

import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Whitelisted dev emails. Hardcoded as the source of truth. The env var
 * `MOCK_AUTH_ALLOWED_EMAILS` (comma-separated) can override for local testing
 * — see `getAllowedMockEmails`.
 */
export const DEFAULT_MOCK_ALLOWED_EMAILS: ReadonlyArray<string> = Object.freeze([
  "admin@test.local",
  "user1@test.local",
  "user2@test.local",
]);

/**
 * Mock account id prefix. The redeem flow can recognize mock accounts by this
 * prefix if it ever needs to (e.g. excluding them from analytics). Real OIDC
 * accounts would use a different prefix (`oidc:` or no prefix).
 */
export const MOCK_ACCOUNT_ID_PREFIX = "mock:";

/**
 * Compute the stable opaque account id for a mock email.
 *
 * `mock:` + first 16 hex chars of SHA-256(lowercased email).
 *
 * Lowercasing is defensive: email addresses are case-insensitive in the local
 * part by convention, and we don't want `Admin@test.local` to be a "different
 * account" from `admin@test.local`.
 */
export function deriveMockAccountId(email: string): string {
  const normalized = email.trim().toLowerCase();
  const hash = createHash("sha256").update(normalized, "utf8").digest("hex");
  return `${MOCK_ACCOUNT_ID_PREFIX}${hash.slice(0, 16)}`;
}

/**
 * Read the allowed-email whitelist from env, or fall back to the defaults.
 * Returns a defensive copy so callers can't mutate module state.
 */
export function getAllowedMockEmails(
  env: NodeJS.ProcessEnv = process.env,
): ReadonlyArray<string> {
  const raw = env.MOCK_AUTH_ALLOWED_EMAILS;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const list = raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0);
    if (list.length > 0) {
      return Object.freeze([...list]);
    }
  }
  return DEFAULT_MOCK_ALLOWED_EMAILS;
}

export interface MockUser {
  id: string;
  email: string;
  name: string;
}

export interface ValidateMockCredentialsInput {
  email: unknown;
  password: unknown;
}

/**
 * Validate a mock credentials attempt purely (no Auth.js, no DB).
 *
 * Returns the `MockUser` on success, or `null` on ANY failure. The caller
 * MUST treat `null` as "credenciales inválidas" — never reveal which check
 * failed. (See AGENTS.md §8 and SECURITY.md §5.)
 *
 * Throws ONLY when configuration is unsafe (production + mock enabled) so
 * a misconfigured deploy crashes fast rather than silently accepting test
 * credentials.
 */
export function validateMockCredentials(
  input: ValidateMockCredentialsInput,
  env: NodeJS.ProcessEnv = process.env,
): MockUser | null {
  // Hard fail-fast: the mock MUST NEVER run in production.
  if (env.NODE_ENV === "production") {
    throw new Error("auth_config_invalid");
  }

  const { email, password } = input;
  if (typeof email !== "string" || typeof password !== "string") {
    return null;
  }

  const expected = env.MOCK_AUTH_PASSWORD;
  if (typeof expected !== "string" || expected.length === 0) {
    // Fail closed: no password configured => provider rejects everyone.
    return null;
  }
  // Constant-time compare to avoid leaking password length/prefix via timing
  // if this helper is ever reused outside the dev mock (e.g. OIDC fallback).
  const a = Buffer.from(password, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const allowed = getAllowedMockEmails(env);
  if (!allowed.includes(normalizedEmail)) {
    return null;
  }

  return {
    id: deriveMockAccountId(normalizedEmail),
    email: normalizedEmail,
    name: normalizedEmail.split("@")[0] ?? "user",
  };
}
