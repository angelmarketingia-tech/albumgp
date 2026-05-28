import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryRedis } from "../lib/redis/client";
import {
  rateLimit,
  keyForIp,
  keyForCode,
} from "../lib/redis/rate-limit";

describe("rateLimit (fixed-window, InMemoryRedis)", () => {
  let redis: InMemoryRedis;

  beforeEach(() => {
    redis = new InMemoryRedis();
  });

  it("allows up to `max` requests in window, blocks N+1", async () => {
    const opts = { key: "rl:test:allow", max: 3, windowSeconds: 60 };

    const r1 = await rateLimit(opts, redis);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await rateLimit(opts, redis);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = await rateLimit(opts, redis);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    const r4 = await rateLimit(opts, redis);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it("isolates keys (different keys do not interfere)", async () => {
    const a = { key: "rl:test:a", max: 1, windowSeconds: 60 };
    const b = { key: "rl:test:b", max: 1, windowSeconds: 60 };

    expect((await rateLimit(a, redis)).allowed).toBe(true);
    expect((await rateLimit(a, redis)).allowed).toBe(false);
    // b sigue libre
    expect((await rateLimit(b, redis)).allowed).toBe(true);
  });

  it("resetAt is in the future and within windowSeconds", async () => {
    const before = Date.now();
    const r = await rateLimit(
      { key: "rl:test:reset", max: 5, windowSeconds: 30 },
      redis,
    );
    const after = Date.now();
    expect(r.resetAt).toBeGreaterThanOrEqual(before + 30 * 1000 - 50);
    expect(r.resetAt).toBeLessThanOrEqual(after + 30 * 1000 + 50);
  });

  it("expires the window after windowSeconds (real TTL)", async () => {
    // Window de 1s — verificamos manualmente sweepeando.
    const r1 = await rateLimit(
      { key: "rl:test:ttl", max: 1, windowSeconds: 1 },
      redis,
    );
    expect(r1.allowed).toBe(true);
    const r2 = await rateLimit(
      { key: "rl:test:ttl", max: 1, windowSeconds: 1 },
      redis,
    );
    expect(r2.allowed).toBe(false);

    await new Promise((res) => setTimeout(res, 1100));

    const r3 = await rateLimit(
      { key: "rl:test:ttl", max: 1, windowSeconds: 1 },
      redis,
    );
    expect(r3.allowed).toBe(true);
  });
});

describe("keyForIp", () => {
  it("uses the first IP from x-forwarded-for", () => {
    const req = new Request("http://x.test", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });
    expect(keyForIp(req, "open")).toBe("rl:ip:open:203.0.113.5");
  });

  it("falls back to 'unknown' when header is missing", () => {
    const req = new Request("http://x.test");
    expect(keyForIp(req, "open")).toBe("rl:ip:open:unknown");
  });

  it("falls back to 'unknown' on garbage IP (sanitization)", () => {
    const req = new Request("http://x.test", {
      headers: { "x-forwarded-for": "not-an-ip; DROP TABLE codes;--" },
    });
    expect(keyForIp(req, "redeem")).toBe("rl:ip:redeem:unknown");
  });

  it("accepts IPv6", () => {
    const req = new Request("http://x.test", {
      headers: { "x-forwarded-for": "2001:db8::1" },
    });
    expect(keyForIp(req, "open")).toBe("rl:ip:open:2001:db8::1");
  });
});

describe("keyForCode", () => {
  it("hashes the code (sha256 hex) and never includes it in the key", () => {
    const code = "SUPER-SECRET-CODE-123";
    const key = keyForCode(code, "open");
    expect(key.startsWith("rl:code:open:")).toBe(true);
    expect(key).not.toContain(code);
    // sha256 hex = 64 chars
    const hash = key.replace("rl:code:open:", "");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same code", () => {
    expect(keyForCode("abc", "x")).toBe(keyForCode("abc", "x"));
  });

  it("differs for different codes", () => {
    expect(keyForCode("abc", "x")).not.toBe(keyForCode("abd", "x"));
  });
});
