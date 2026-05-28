// Tests for the pure validator behind the mock Credentials provider.
//
// We test the PURE function (not Auth.js) — that's why it lives in
// `lib/auth/mock-credentials.ts` outside of `auth-config.ts`. Auth.js v5's
// `authorize` is a thin wrapper around this.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  deriveMockAccountId,
  DEFAULT_MOCK_ALLOWED_EMAILS,
  getAllowedMockEmails,
  MOCK_ACCOUNT_ID_PREFIX,
  validateMockCredentials,
} from "../lib/auth/mock-credentials";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  // Reset env to a clean dev baseline before each test.
  for (const key of Object.keys(process.env)) {
    if (
      key === "NODE_ENV" ||
      key === "MOCK_AUTH_PASSWORD" ||
      key === "MOCK_AUTH_ALLOWED_EMAILS"
    ) {
      delete process.env[key];
    }
  }
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
});

afterEach(() => {
  // Restore original env so unrelated tests aren't affected.
  for (const key of Object.keys(process.env)) {
    if (
      key === "NODE_ENV" ||
      key === "MOCK_AUTH_PASSWORD" ||
      key === "MOCK_AUTH_ALLOWED_EMAILS"
    ) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
});

describe("deriveMockAccountId", () => {
  it("is stable: same email -> same id", () => {
    const a = deriveMockAccountId("admin@test.local");
    const b = deriveMockAccountId("admin@test.local");
    expect(a).toBe(b);
  });

  it("normalizes case before hashing", () => {
    const lower = deriveMockAccountId("admin@test.local");
    const upper = deriveMockAccountId("ADMIN@test.local");
    expect(lower).toBe(upper);
  });

  it("prefixes with 'mock:'", () => {
    const id = deriveMockAccountId("user1@test.local");
    expect(id.startsWith(MOCK_ACCOUNT_ID_PREFIX)).toBe(true);
  });

  it("different emails produce different ids", () => {
    const a = deriveMockAccountId("admin@test.local");
    const b = deriveMockAccountId("user1@test.local");
    expect(a).not.toBe(b);
  });

  it("uses 16 hex chars after the prefix", () => {
    const id = deriveMockAccountId("user2@test.local");
    expect(id).toMatch(/^mock:[0-9a-f]{16}$/);
  });
});

describe("getAllowedMockEmails", () => {
  it("returns defaults when env is unset", () => {
    expect(getAllowedMockEmails({} as NodeJS.ProcessEnv)).toEqual(
      DEFAULT_MOCK_ALLOWED_EMAILS,
    );
  });

  it("returns parsed env when set", () => {
    const env = {
      MOCK_AUTH_ALLOWED_EMAILS: "a@x.com, b@x.com ,c@x.com",
    } as unknown as NodeJS.ProcessEnv;
    expect(getAllowedMockEmails(env)).toEqual(["a@x.com", "b@x.com", "c@x.com"]);
  });

  it("falls back to defaults if env is whitespace only", () => {
    const env = { MOCK_AUTH_ALLOWED_EMAILS: "   ," } as unknown as NodeJS.ProcessEnv;
    expect(getAllowedMockEmails(env)).toEqual(DEFAULT_MOCK_ALLOWED_EMAILS);
  });
});

describe("validateMockCredentials", () => {
  const goodEnv = (): NodeJS.ProcessEnv =>
    ({
      NODE_ENV: "test",
      MOCK_AUTH_PASSWORD: "gp-test-pass-do-not-use",
    }) as unknown as NodeJS.ProcessEnv;

  it("accepts a whitelisted email with the correct password", () => {
    const user = validateMockCredentials(
      { email: "admin@test.local", password: "gp-test-pass-do-not-use" },
      goodEnv(),
    );
    expect(user).not.toBeNull();
    expect(user?.email).toBe("admin@test.local");
    expect(user?.id).toBe(deriveMockAccountId("admin@test.local"));
  });

  it("rejects a non-whitelisted email", () => {
    const user = validateMockCredentials(
      { email: "intruder@test.local", password: "gp-test-pass-do-not-use" },
      goodEnv(),
    );
    expect(user).toBeNull();
  });

  it("rejects a wrong password", () => {
    const user = validateMockCredentials(
      { email: "admin@test.local", password: "wrong" },
      goodEnv(),
    );
    expect(user).toBeNull();
  });

  it("rejects when MOCK_AUTH_PASSWORD is empty (fail-closed)", () => {
    const user = validateMockCredentials(
      { email: "admin@test.local", password: "" },
      { NODE_ENV: "test", MOCK_AUTH_PASSWORD: "" } as unknown as NodeJS.ProcessEnv,
    );
    expect(user).toBeNull();
  });

  it("rejects when MOCK_AUTH_PASSWORD is missing entirely", () => {
    const user = validateMockCredentials(
      { email: "admin@test.local", password: "whatever" },
      { NODE_ENV: "test" } as unknown as NodeJS.ProcessEnv,
    );
    expect(user).toBeNull();
  });

  it("rejects non-string email or password", () => {
    expect(
      validateMockCredentials(
        { email: 42, password: "gp-test-pass-do-not-use" },
        goodEnv(),
      ),
    ).toBeNull();
    expect(
      validateMockCredentials(
        { email: "admin@test.local", password: undefined },
        goodEnv(),
      ),
    ).toBeNull();
  });

  it("THROWS when NODE_ENV === 'production' (mock must never run in prod)", () => {
    expect(() =>
      validateMockCredentials(
        { email: "admin@test.local", password: "gp-test-pass-do-not-use" },
        {
          NODE_ENV: "production",
          MOCK_AUTH_PASSWORD: "gp-test-pass-do-not-use",
        } as unknown as NodeJS.ProcessEnv,
      ),
    ).toThrowError(/auth_config_invalid/);
  });

  it("returns the same id for the same email across calls", () => {
    const env = goodEnv();
    const a = validateMockCredentials(
      { email: "user1@test.local", password: "gp-test-pass-do-not-use" },
      env,
    );
    const b = validateMockCredentials(
      { email: "user1@test.local", password: "gp-test-pass-do-not-use" },
      env,
    );
    expect(a?.id).toBe(b?.id);
    expect(a?.id.startsWith("mock:")).toBe(true);
  });

  it("normalizes email case before whitelist check", () => {
    const user = validateMockCredentials(
      { email: "ADMIN@TEST.LOCAL", password: "gp-test-pass-do-not-use" },
      goodEnv(),
    );
    expect(user).not.toBeNull();
    expect(user?.email).toBe("admin@test.local");
  });
});
