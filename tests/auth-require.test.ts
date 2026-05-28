// Tests for `requireAccountId`.
//
// We bypass the singleton entirely by passing a stub `IdentityProvider`
// through the second argument. That keeps these tests independent of Auth.js
// AND `getIdentityProvider()`'s NODE_ENV gate.

import { describe, it, expect, vi } from "vitest";

// `require.ts` transitively imports `lib/auth/auth-config.ts`, which loads
// the `next-auth` package. `next-auth` fails to resolve under Vitest's Node
// runtime because of an ESM/CJS interop bug with `next/server`. Since we
// pass a stub provider directly to `requireAccountId` (no auth-config needed
// at runtime), mocking the module out is the cleanest fix.
vi.mock("../lib/auth/auth-config", () => ({
  auth: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/auth/auth-config", () => ({
  auth: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import { requireAccountId } from "../lib/auth/require";
import type { IdentityProvider } from "../lib/auth/identity";

function makeReq(): Request {
  return new Request("http://x.test/api/redeem", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
}

function stubProvider(
  impl: (req: Request) => Promise<string | null>,
): IdentityProvider {
  return { resolveAccountId: impl };
}

describe("requireAccountId", () => {
  it("returns { ok: false, response } with 401 unauthenticated when provider yields null", async () => {
    const provider = stubProvider(async () => null);
    const result = await requireAccountId(makeReq(), provider);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected ok=false");
    }
    expect(result.response.status).toBe(401);
    const body = (await result.response.json()) as Record<string, unknown>;
    expect(body).toEqual({ error: "unauthenticated" });
    expect(Object.keys(body)).toEqual(["error"]);
  });

  it("treats empty-string account id as unauthenticated", async () => {
    const provider = stubProvider(async () => "");
    const result = await requireAccountId(makeReq(), provider);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected ok=false");
    }
    expect(result.response.status).toBe(401);
  });

  it("returns { ok: true, accountId } when provider yields a valid id", async () => {
    const provider = stubProvider(async () => "mock:abcdef0123456789");
    const result = await requireAccountId(makeReq(), provider);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected ok=true");
    }
    expect(result.accountId).toBe("mock:abcdef0123456789");
  });

  it("maps provider exceptions to a generic 500 internal", async () => {
    const provider = stubProvider(async () => {
      throw new Error("session-store-down");
    });
    const result = await requireAccountId(makeReq(), provider);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected ok=false");
    }
    expect(result.response.status).toBe(500);
    const body = (await result.response.json()) as Record<string, unknown>;
    expect(body).toEqual({ error: "internal" });
  });

  it("401 response carries security headers", async () => {
    const provider = stubProvider(async () => null);
    const result = await requireAccountId(makeReq(), provider);
    if (result.ok) {
      throw new Error("expected ok=false");
    }
    expect(result.response.headers.get("Content-Security-Policy")).not.toBeNull();
    expect(result.response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(result.response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("does not call the provider twice", async () => {
    let calls = 0;
    const provider = stubProvider(async () => {
      calls += 1;
      return "mock:abcdef0123456789";
    });
    await requireAccountId(makeReq(), provider);
    expect(calls).toBe(1);
  });
});
