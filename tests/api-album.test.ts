// E2E adversarial tests for GET /api/album.
//
// The endpoint chains: auth gate → rate-limit (60/min/IP) → query → response.
// Each hop has its own failure mode; we test them individually.
//
// Mocking strategy (mirrors api-redeem.test.ts):
//   - `@/lib/db/client`: mock `prisma.redemption.findMany`. We never touch a
//     real DB.
//   - `@/lib/auth/auth-config`: stub out so the `next-auth` ESM/CJS bug under
//     Vitest doesn't bite (same trick as auth-require.test.ts).
//   - `@/lib/auth/identity`: stub `getIdentityProvider()` so we can swap
//     between "no session", "session OK" and "provider throws" per test.
//   - `_resetRedisForTests` to keep rate-limit deterministic per test.
//   - `vi.spyOn(console, ...)` to assert log content / leak hygiene.

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import {
  InMemoryRedis,
  _resetRedisForTests,
} from "../lib/redis/client";

// ----------------------------------------------------------------------------
// Mocks — declared BEFORE the route import.
// ----------------------------------------------------------------------------

vi.mock("@/lib/db/client", () => {
  const findMany = vi.fn();
  return {
    prisma: {
      redemption: { findMany },
    },
  };
});
vi.mock("../lib/db/client", () => {
  const findMany = vi.fn();
  return {
    prisma: {
      redemption: { findMany },
    },
  };
});

vi.mock("@/lib/auth/auth-config", () => ({
  auth: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("../lib/auth/auth-config", () => ({
  auth: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/auth/identity", () => {
  const resolveAccountId = vi.fn();
  return {
    getIdentityProvider: () => ({ resolveAccountId }),
    _resetIdentityProviderForTests: () => {},
  };
});
vi.mock("../lib/auth/identity", () => {
  const resolveAccountId = vi.fn();
  return {
    getIdentityProvider: () => ({ resolveAccountId }),
    _resetIdentityProviderForTests: () => {},
  };
});

// Safe to import the route now — its dependencies resolve to the mocks.
import { GET } from "../app/api/album/route";
import { prisma as prismaFromMock } from "@/lib/db/client";
import { getIdentityProvider } from "@/lib/auth/identity";

const findManyMock = prismaFromMock.redemption.findMany as ReturnType<
  typeof vi.fn
>;
const resolveAccountIdMock = getIdentityProvider().resolveAccountId as ReturnType<
  typeof vi.fn
>;

// ----------------------------------------------------------------------------
// Fixtures + helpers
// ----------------------------------------------------------------------------

const VALID_ACCOUNT_ID = "mock:abcdef0123456789";
const VALID_ACCOUNT_ID_2 = "mock:1234567890abcdef";

const PACK_SV = {
  guaranteed: [
    { type: "sports_credit", amount: 10, currency: "USD", label: "$10 USD" },
    {
      type: "casino_spins",
      count: 200,
      game_name: "Clover Super Pot",
      label: "200 giros",
    },
    { type: "deposit_match", multiplier: 3, label: "3x primer depósito" },
  ],
  variable: [
    { type: "none", label: "No ganaste" },
    { type: "none", label: "No ganaste" },
  ],
  pack_version: "v1",
};

const PACK_GT = {
  guaranteed: [
    { type: "sports_credit", amount: 100, currency: "GTQ", label: "Q100" },
    {
      type: "casino_spins",
      count: 200,
      game_name: "Super Tiki Strike",
      label: "200 giros",
    },
    { type: "deposit_match", multiplier: 3, label: "3x primer depósito" },
  ],
  variable: [
    {
      type: "collectible",
      collectible_id: "messi-2026",
      label: "Messi 2026",
      rarity: "rare",
    },
    { type: "none", label: "No ganaste" },
  ],
  pack_version: "v1",
};

interface MakeReqOpts {
  ip?: string;
  headers?: Record<string, string>;
}

// Simulate Vercel so `extractClientIp` honors `x-vercel-forwarded-for` (else
// it falls back to a UA-hashed bucket and per-IP isolation tests collapse).
process.env.VERCEL = "1";

function makeReq(opts: MakeReqOpts = {}): Request {
  const ip = opts.ip ?? "1.2.3.4";
  const headers: Record<string, string> = {
    "x-forwarded-for": ip,
    "x-vercel-forwarded-for": ip,
    ...(opts.headers ?? {}),
  };
  return new Request("http://x.test/api/album", {
    method: "GET",
    headers,
  });
}

function expectSecurityHeaders(res: Response): void {
  expect(res.headers.get("Content-Security-Policy")).not.toBeNull();
  expect(res.headers.get("Strict-Transport-Security")).not.toBeNull();
  expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
}

interface LogCapture {
  log: string[];
  warn: string[];
  error: string[];
}
let logs: LogCapture;
let logSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

function captureConsole(): void {
  logs = { log: [], warn: [], error: [] };
  logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    logs.log.push(
      args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "),
    );
  });
  warnSpy = vi
    .spyOn(console, "warn")
    .mockImplementation((...args: unknown[]) => {
      logs.warn.push(
        args
          .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
          .join(" "),
      );
    });
  errorSpy = vi
    .spyOn(console, "error")
    .mockImplementation((...args: unknown[]) => {
      logs.error.push(
        args
          .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
          .join(" "),
      );
    });
}

function restoreConsole(): void {
  logSpy.mockRestore();
  warnSpy.mockRestore();
  errorSpy.mockRestore();
}

function allLogLines(): string[] {
  return [...logs.log, ...logs.warn, ...logs.error];
}

// ----------------------------------------------------------------------------
// Lifecycle
// ----------------------------------------------------------------------------

beforeEach(() => {
  resolveAccountIdMock.mockReset();
  findManyMock.mockReset();
  _resetRedisForTests(new InMemoryRedis());
  captureConsole();
});

afterEach(() => {
  restoreConsole();
});

// =============================================================================
// A. Authentication
// =============================================================================

describe("GET /api/album — authentication", () => {
  it("401 unauthenticated when provider resolves to null; findMany NOT called", async () => {
    resolveAccountIdMock.mockResolvedValueOnce(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ error: "unauthenticated" });
    expect(Object.keys(body)).toEqual(["error"]);
    expect(findManyMock).not.toHaveBeenCalled();
    expectSecurityHeaders(res);
  });

  it("500 internal when the identity provider throws (no detail leaked)", async () => {
    resolveAccountIdMock.mockRejectedValueOnce(
      new Error("session-store-down-secret-detail"),
    );
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ error: "internal" });
    expect(JSON.stringify(body)).not.toContain("session-store-down");
    expect(findManyMock).not.toHaveBeenCalled();
    expectSecurityHeaders(res);
  });
});

// =============================================================================
// B. Happy path
// =============================================================================

describe("GET /api/album — happy path", () => {
  beforeEach(() => {
    resolveAccountIdMock.mockResolvedValue(VALID_ACCOUNT_ID);
  });

  it("session OK + 0 redemptions → 200 with empty album", async () => {
    findManyMock.mockResolvedValueOnce([]);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      redemptions: [],
      unique_collectibles_count: 0,
      total_cards_count: 0,
    });
    expectSecurityHeaders(res);
  });

  it("session OK + 2 redemptions → 200 with the assembled list (desc order)", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "r-1",
        result: PACK_GT,
        createdAt: new Date("2026-05-28T10:00:00.000Z"),
        code: { country: "GT" },
      },
      {
        id: "r-2",
        result: PACK_SV,
        createdAt: new Date("2026-05-01T08:00:00.000Z"),
        code: { country: "SV" },
      },
    ]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      redemptions: Array<{
        country: string;
        redeemed_at: string;
        prizes: Array<{ prize: { type: string } }>;
      }>;
      unique_collectibles_count: number;
      total_cards_count: number;
    };
    expect(body.redemptions).toHaveLength(2);
    expect(body.redemptions[0]?.country).toBe("GT");
    expect(body.redemptions[0]?.redeemed_at).toBe("2026-05-28T10:00:00.000Z");
    expect(body.redemptions[0]?.prizes).toHaveLength(5);
    expect(body.redemptions[1]?.country).toBe("SV");
    expect(body.total_cards_count).toBe(10);
    expect(body.unique_collectibles_count).toBe(1);
  });

  it("findMany is invoked with `where.accountId` = the authed account", async () => {
    findManyMock.mockResolvedValueOnce([]);
    await GET(makeReq());
    expect(findManyMock).toHaveBeenCalledTimes(1);
    const call = findManyMock.mock.calls[0]?.[0] as {
      where: { accountId: string };
    };
    expect(call.where.accountId).toBe(VALID_ACCOUNT_ID);
  });

  it("different account_ids see different albums (where.accountId is honored)", async () => {
    // Two different sessions; findMany returns a different shape per call,
    // based on the account_id used in `where`.
    findManyMock.mockImplementation(
      (args: { where: { accountId: string } }) => {
        if (args.where.accountId === VALID_ACCOUNT_ID) {
          return Promise.resolve([
            {
              id: "a-1",
              result: PACK_SV,
              createdAt: new Date("2026-05-28T10:00:00.000Z"),
              code: { country: "SV" },
            },
          ]);
        }
        if (args.where.accountId === VALID_ACCOUNT_ID_2) {
          return Promise.resolve([
            {
              id: "b-1",
              result: PACK_GT,
              createdAt: new Date("2026-05-28T11:00:00.000Z"),
              code: { country: "GT" },
            },
            {
              id: "b-2",
              result: PACK_GT,
              createdAt: new Date("2026-05-27T11:00:00.000Z"),
              code: { country: "GT" },
            },
          ]);
        }
        return Promise.resolve([]);
      },
    );

    // Account 1
    resolveAccountIdMock.mockResolvedValueOnce(VALID_ACCOUNT_ID);
    const res1 = await GET(makeReq({ ip: "10.0.0.1" }));
    const body1 = (await res1.json()) as { redemptions: unknown[] };
    expect(body1.redemptions).toHaveLength(1);

    // Account 2 (different IP so rate-limit doesn't interfere)
    resolveAccountIdMock.mockResolvedValueOnce(VALID_ACCOUNT_ID_2);
    const res2 = await GET(makeReq({ ip: "10.0.0.2" }));
    const body2 = (await res2.json()) as {
      redemptions: Array<{ country: string }>;
    };
    expect(body2.redemptions).toHaveLength(2);
    expect(body2.redemptions.every((r) => r.country === "GT")).toBe(true);
  });
});

// =============================================================================
// C. Query failure
// =============================================================================

describe("GET /api/album — query failure", () => {
  beforeEach(() => {
    resolveAccountIdMock.mockResolvedValue(VALID_ACCOUNT_ID);
  });

  it("findMany throws → 500 internal; no DB detail leaked", async () => {
    findManyMock.mockRejectedValueOnce(new Error("pg-conn-refused-XYZ"));
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ error: "internal" });
    expect(JSON.stringify(body)).not.toContain("pg-conn-refused-XYZ");
    expectSecurityHeaders(res);
    expect(allLogLines().join("\n")).toContain("album.query_failed");
  });
});

// =============================================================================
// D. Rate limit (post-auth)
// =============================================================================

describe("GET /api/album — rate limiting", () => {
  beforeEach(() => {
    resolveAccountIdMock.mockResolvedValue(VALID_ACCOUNT_ID);
    findManyMock.mockResolvedValue([]);
  });

  it("60 requests from same IP within 1 min OK; 61st → 429", async () => {
    for (let i = 0; i < 60; i++) {
      const r = await GET(makeReq({ ip: "9.9.9.9" }));
      expect(r.status).toBe(200);
    }
    const blocked = await GET(makeReq({ ip: "9.9.9.9" }));
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "rate_limited" });
    expectSecurityHeaders(blocked);
  });

  it("different IPs do NOT interfere with each other's IP buckets", async () => {
    // Fill IP A's bucket.
    for (let i = 0; i < 60; i++) {
      const r = await GET(makeReq({ ip: "11.11.11.11" }));
      expect(r.status).toBe(200);
    }
    const blockedA = await GET(makeReq({ ip: "11.11.11.11" }));
    expect(blockedA.status).toBe(429);

    // Fresh IP — must still pass.
    const freshB = await GET(makeReq({ ip: "22.22.22.22" }));
    expect(freshB.status).toBe(200);
  });
});

// =============================================================================
// E. Security headers across status codes
// =============================================================================

describe("GET /api/album — security headers across status codes", () => {
  it("200 carries all security headers", async () => {
    resolveAccountIdMock.mockResolvedValueOnce(VALID_ACCOUNT_ID);
    findManyMock.mockResolvedValueOnce([]);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expectSecurityHeaders(res);
  });

  it("401 carries all security headers", async () => {
    resolveAccountIdMock.mockResolvedValueOnce(null);
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    expectSecurityHeaders(res);
  });

  it("429 carries all security headers", async () => {
    resolveAccountIdMock.mockResolvedValue(VALID_ACCOUNT_ID);
    findManyMock.mockResolvedValue([]);
    for (let i = 0; i < 60; i++) {
      await GET(makeReq({ ip: "33.33.33.33" }));
    }
    const res = await GET(makeReq({ ip: "33.33.33.33" }));
    expect(res.status).toBe(429);
    expectSecurityHeaders(res);
  });

  it("500 carries all security headers", async () => {
    resolveAccountIdMock.mockResolvedValueOnce(VALID_ACCOUNT_ID);
    findManyMock.mockRejectedValueOnce(new Error("boom"));
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
    expectSecurityHeaders(res);
  });
});

// =============================================================================
// F. Response shape — anti-leak
// =============================================================================

describe("GET /api/album — response shape (anti-leak)", () => {
  beforeEach(() => {
    resolveAccountIdMock.mockResolvedValue(VALID_ACCOUNT_ID);
  });

  it("200 success body has EXACTLY { redemptions, unique_collectibles_count, total_cards_count }", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "r-1",
        result: PACK_SV,
        createdAt: new Date("2026-05-28T10:00:00.000Z"),
        code: { country: "SV" },
      },
    ]);
    const res = await GET(makeReq());
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      "redemptions",
      "total_cards_count",
      "unique_collectibles_count",
    ]);
  });

  it("each redemption item carries ONLY { redeemed_at, country, prizes }", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "r-secret",
        result: PACK_SV,
        createdAt: new Date("2026-05-28T10:00:00.000Z"),
        code: { country: "SV" },
      },
    ]);
    const res = await GET(makeReq());
    const body = (await res.json()) as {
      redemptions: Array<Record<string, unknown>>;
    };
    const item = body.redemptions[0];
    expect(item).toBeDefined();
    expect(Object.keys(item ?? {}).sort()).toEqual([
      "country",
      "prizes",
      "redeemed_at",
    ]);
  });

  it("response does NOT include code_id, code, account_id, id, webhook_*", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "33333333-3333-4333-8333-333333333333",
        result: PACK_GT,
        createdAt: new Date("2026-05-28T10:00:00.000Z"),
        code: {
          country: "GT",
        },
      },
    ]);
    const res = await GET(makeReq());
    const serialized = JSON.stringify(await res.json());

    for (const forbidden of [
      "code_id",
      "codeId",
      "account_id",
      "accountId",
      "webhook_status",
      "webhookStatus",
      "webhook_attempts",
      "webhookAttempts",
      "webhook_last_error",
      "webhookLastError",
      "redeemed_by",
      "redeemedBy",
      "redeemed_ip",
      "redeemedIp",
      "prize_set_id",
      "prizeSetId",
      "createdAt",
    ]) {
      expect(serialized, `must not leak ${forbidden}`).not.toContain(forbidden);
    }

    // Also: the redemption.id and the account_id should never appear as values.
    expect(serialized).not.toContain("33333333-3333-4333-8333-333333333333");
    expect(serialized).not.toContain(VALID_ACCOUNT_ID);
  });

  it("each AlbumPrize wraps the Prize under `prize` (no extra DB fields)", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "r-1",
        result: PACK_GT,
        createdAt: new Date("2026-05-28T10:00:00.000Z"),
        code: { country: "GT" },
      },
    ]);
    const res = await GET(makeReq());
    const body = (await res.json()) as {
      redemptions: Array<{
        prizes: Array<{ prize: { type: string } }>;
      }>;
    };
    const prizes = body.redemptions[0]?.prizes ?? [];
    expect(prizes).toHaveLength(5);
    for (const p of prizes) {
      expect(Object.keys(p)).toEqual(["prize"]);
      expect(p.prize.type).toBeTruthy();
    }
  });
});

// =============================================================================
// G. Logging hygiene
// =============================================================================

describe("GET /api/album — logging hygiene", () => {
  it("emits album.request and album.served with account_id and count", async () => {
    resolveAccountIdMock.mockResolvedValueOnce(VALID_ACCOUNT_ID);
    findManyMock.mockResolvedValueOnce([
      {
        id: "r-1",
        result: PACK_SV,
        createdAt: new Date("2026-05-28T10:00:00.000Z"),
        code: { country: "SV" },
      },
    ]);
    await GET(makeReq());
    const joined = allLogLines().join("\n");
    expect(joined).toContain("album.request");
    expect(joined).toContain("album.served");
    expect(joined).toContain(VALID_ACCOUNT_ID);
    expect(joined).toContain(`"count":1`);
  });

  it("logs never contain WEBHOOK/AUTH/MOCK_AUTH secret values", async () => {
    const SENTINEL = "sentinel-secret-do-not-log-ALBUM";
    process.env.WEBHOOK_CENTRAL_SECRET = `webhook-${SENTINEL}-w`;
    process.env.MOCK_AUTH_PASSWORD = `mock-${SENTINEL}-m`;
    process.env.AUTH_SECRET = `auth-${SENTINEL}-a`;
    try {
      resolveAccountIdMock.mockResolvedValueOnce(VALID_ACCOUNT_ID);
      findManyMock.mockResolvedValueOnce([]);
      await GET(makeReq());
      const joined = allLogLines().join("\n");
      expect(joined).not.toContain(SENTINEL);
    } finally {
      delete process.env.WEBHOOK_CENTRAL_SECRET;
      delete process.env.MOCK_AUTH_PASSWORD;
      delete process.env.AUTH_SECRET;
    }
  });
});
