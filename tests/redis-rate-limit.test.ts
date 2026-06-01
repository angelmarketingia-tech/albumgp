import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { InMemoryRedis } from "../lib/redis/client";
import {
  rateLimit,
  keyForIp,
  keyForCode,
} from "../lib/redis/rate-limit";

// `extractClientIp` only trusts XFF when running on Vercel (via
// `x-vercel-forwarded-for`) or when the peer matches `TRUSTED_PROXY_CIDRS`.
// Outside of those it falls back to a UA-hashed bucket so client-spoofed XFF
// can't share a "real" IP bucket. The keyForIp tests below simulate the
// trusted-proxy mode so XFF is honored.
function withTrustedProxy<T>(fn: () => T): T {
  const prev = process.env.TRUSTED_PROXY_CIDRS;
  process.env.TRUSTED_PROXY_CIDRS = "127.0.0.1";
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.TRUSTED_PROXY_CIDRS;
    else process.env.TRUSTED_PROXY_CIDRS = prev;
  }
}

function requestWithPeer(peerIp: string, headers: Record<string, string>): Request {
  const req = new Request("http://x.test", { headers });
  // The rate-limit code reads `req.ip` or `req.socket.remoteAddress`. The
  // standard Request shape exposes neither, so attach it for the test.
  Object.defineProperty(req, "ip", { value: peerIp, configurable: true });
  return req;
}

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
  it("uses the trusted-proxy XFF (last hop = our proxy's observed client)", () => {
    // Outside Vercel, XFF is honored only when peer is in TRUSTED_PROXY_CIDRS,
    // and the trusted code takes the LAST hop (set by our own proxy) — the
    // FIRST hop is client-supplied and untrusted.
    withTrustedProxy(() => {
      const req = requestWithPeer("127.0.0.1", {
        "x-forwarded-for": "10.0.0.1, 203.0.113.5",
      });
      expect(keyForIp(req, "open")).toBe("rl:ip:open:203.0.113.5");
    });
  });

  // Cuando el header IP falta o trae basura, NO usamos un literal compartido
  // ("unknown"): un bad actor podría inundar ese bucket y bloquear a todos
  // los usuarios sin proxy. En su lugar derivamos un bucket per-cliente
  // hasheando UA + Accept-Language. El prefijo es "ua:" para distinguir.
  it("falls back to a UA-hashed bucket when header is missing", () => {
    const req = new Request("http://x.test");
    const key = keyForIp(req, "open");
    expect(key.startsWith("rl:ip:open:ua:")).toBe(true);
    expect(key.length).toBeGreaterThan("rl:ip:open:ua:".length + 10);
  });

  it("falls back to a UA-hashed bucket on garbage IP (sanitization)", () => {
    const req = new Request("http://x.test", {
      headers: { "x-forwarded-for": "not-an-ip; DROP TABLE codes;--" },
    });
    const key = keyForIp(req, "redeem");
    expect(key.startsWith("rl:ip:redeem:ua:")).toBe(true);
  });

  it("accepts IPv6", () => {
    withTrustedProxy(() => {
      const req = requestWithPeer("127.0.0.1", {
        "x-forwarded-for": "2001:db8::1",
      });
      expect(keyForIp(req, "open")).toBe("rl:ip:open:2001:db8::1");
    });
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
