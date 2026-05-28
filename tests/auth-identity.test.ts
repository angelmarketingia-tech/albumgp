// Tests for `MockCredentialsIdentityProvider` and `getIdentityProvider`.
//
// We mock `lib/auth/auth-config` so we never spin up Auth.js — that keeps
// these tests pure and fast, and decouples them from the cookie/session
// machinery (we'd test that via integration tests, not here).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// --- Mock Auth.js BEFORE importing the module under test --------------------
const authMock = vi.fn();
vi.mock("../lib/auth/auth-config", () => ({
  auth: (...args: unknown[]) => authMock(...args),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Same mock under the `@/` path alias just in case some import path differs.
vi.mock("@/lib/auth/auth-config", () => ({
  auth: (...args: unknown[]) => authMock(...args),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import {
  MockCredentialsIdentityProvider,
  getIdentityProvider,
  _resetIdentityProviderForTests,
} from "../lib/auth/identity";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function setNodeEnv(value: string | undefined): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

beforeEach(() => {
  authMock.mockReset();
  _resetIdentityProviderForTests();
  setNodeEnv("test");
});

afterEach(() => {
  setNodeEnv(ORIGINAL_NODE_ENV);
  _resetIdentityProviderForTests();
});

function makeReq(): Request {
  return new Request("http://x.test/api/redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
}

describe("MockCredentialsIdentityProvider.resolveAccountId", () => {
  it("returns null when there is no session at all", async () => {
    authMock.mockResolvedValueOnce(null);
    const provider = new MockCredentialsIdentityProvider();
    const result = await provider.resolveAccountId(makeReq());
    expect(result).toBeNull();
  });

  it("returns null when session has no `user`", async () => {
    authMock.mockResolvedValueOnce({});
    const provider = new MockCredentialsIdentityProvider();
    expect(await provider.resolveAccountId(makeReq())).toBeNull();
  });

  it("returns null when `user.id` is missing", async () => {
    authMock.mockResolvedValueOnce({ user: {} });
    const provider = new MockCredentialsIdentityProvider();
    expect(await provider.resolveAccountId(makeReq())).toBeNull();
  });

  it("returns null when `user.id` is not a string", async () => {
    authMock.mockResolvedValueOnce({ user: { id: 42 } });
    const provider = new MockCredentialsIdentityProvider();
    expect(await provider.resolveAccountId(makeReq())).toBeNull();
  });

  it("returns null when `user.id` is empty string", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "" } });
    const provider = new MockCredentialsIdentityProvider();
    expect(await provider.resolveAccountId(makeReq())).toBeNull();
  });

  it("returns the account id when the session is valid", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "mock:abcdef0123456789" } });
    const provider = new MockCredentialsIdentityProvider();
    const result = await provider.resolveAccountId(makeReq());
    expect(result).toBe("mock:abcdef0123456789");
  });

  it("propagates errors from auth() (infra failure)", async () => {
    authMock.mockRejectedValueOnce(new Error("session-store-down"));
    const provider = new MockCredentialsIdentityProvider();
    await expect(provider.resolveAccountId(makeReq())).rejects.toThrow(
      /session-store-down/,
    );
  });
});

describe("getIdentityProvider", () => {
  it("returns a MockCredentialsIdentityProvider in non-production", () => {
    setNodeEnv("development");
    const provider = getIdentityProvider();
    expect(provider).toBeInstanceOf(MockCredentialsIdentityProvider);
  });

  it("returns the SAME instance on repeated calls (singleton)", () => {
    setNodeEnv("development");
    const a = getIdentityProvider();
    const b = getIdentityProvider();
    expect(a).toBe(b);
  });

  it("THROWS when NODE_ENV === 'production' and no OIDC provider is configured", () => {
    setNodeEnv("production");
    expect(() => getIdentityProvider()).toThrowError(/auth_config_invalid/);
  });

  it("respects an injected env (override)", () => {
    const env = { NODE_ENV: "production" } as unknown as NodeJS.ProcessEnv;
    expect(() => getIdentityProvider(env)).toThrowError(/auth_config_invalid/);
  });
});
