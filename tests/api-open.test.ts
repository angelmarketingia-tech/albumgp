// QA — E2E tests for POST /api/open.
//
// Focused on the *dangerous* cases (invalid input, leaks, race conditions,
// rate limit, header hygiene, internal errors). The happy path is already
// covered by Backend's resolver/schema unit tests.
//
// Mocking strategy:
//   - `@/lib/db/client` is mocked so we don't hit a real Postgres. Each
//     prisma method is a `vi.fn()` we configure per test.
//   - The Redis singleton is reset to a fresh `InMemoryRedis` via the
//     existing `_resetRedisForTests` helper between tests so rate-limit
//     state is deterministic.
//   - `console.log/warn/error` are spied so we can assert on logged content
//     (and confirm no plaintext code / secret leaks).

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  InMemoryRedis,
  _resetRedisForTests,
} from "../lib/redis/client";

// --- Mock Prisma client BEFORE importing the route ---------------------------

const findUniqueMock = vi.fn();
const updateManyMock = vi.fn();

vi.mock("@/lib/db/client", () => ({
  prisma: {
    code: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      updateMany: (...args: unknown[]) => updateManyMock(...args),
    },
  },
}));

// Same mock under the relative path the route uses, just in case.
vi.mock("../lib/db/client", () => ({
  prisma: {
    code: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      updateMany: (...args: unknown[]) => updateManyMock(...args),
    },
  },
}));

// Now safe to import the handler — its `prisma` import resolves to the mock.
import { POST } from "../app/api/open/route";

// --- Test helpers ------------------------------------------------------------

/** Build a valid 16-char code matching `^[A-HJ-NP-Z2-9]{16}$`. */
const VALID_CODE = "ABCDEFGHJKLMNPQR";
const VALID_CODE_2 = "ZYXWVUTSRQPNMLKJ";

const VALID_PACK_RESULT = {
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
} as const;

interface CodeRowFixtureOverrides {
  id?: string;
  code?: string;
  country?: "SV" | "GT";
  status?: "active" | "redeemed" | "disabled" | "expired";
  packResult?: unknown;
  openedAt?: Date | null;
  expiresAt?: Date | null;
}

function codeRowFixture(overrides: CodeRowFixtureOverrides = {}): {
  id: string;
  code: string;
  country: "SV" | "GT";
  status: "active" | "redeemed" | "disabled" | "expired";
  packResult: unknown;
  openedAt: Date | null;
  expiresAt: Date | null;
  prizeSet: {
    guaranteed: unknown;
    variablePool: unknown;
    cardsPerPack: number;
  };
} {
  return {
    id: overrides.id ?? "00000000-0000-0000-0000-000000000001",
    code: overrides.code ?? VALID_CODE,
    country: overrides.country ?? "SV",
    status: overrides.status ?? "active",
    packResult: overrides.packResult ?? null,
    openedAt: overrides.openedAt ?? null,
    expiresAt: overrides.expiresAt ?? null,
    prizeSet: {
      guaranteed: VALID_PACK_RESULT.guaranteed,
      variablePool: [
        { prize: { type: "none", label: "No ganaste" }, weight: 1 },
      ],
      cardsPerPack: 5,
    },
  };
}

interface MakeReqOpts {
  body?: unknown;
  rawBody?: string;
  ip?: string;
  headers?: Record<string, string>;
}

function makeReq(opts: MakeReqOpts = {}): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": opts.ip ?? "1.2.3.4",
    ...(opts.headers ?? {}),
  };
  let body: BodyInit | undefined;
  if (opts.rawBody !== undefined) {
    body = opts.rawBody;
  } else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
  } else {
    body = JSON.stringify({ code: VALID_CODE });
  }
  return new Request("http://x.test/api/open", {
    method: "POST",
    headers,
    body,
  });
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

function expectSecurityHeaders(res: Response): void {
  expect(res.headers.get("Content-Security-Policy")).not.toBeNull();
  expect(res.headers.get("Strict-Transport-Security")).not.toBeNull();
  expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(res.headers.get("Referrer-Policy")).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(res.headers.get("Permissions-Policy")).not.toBeNull();
}

// Captured console output across the test lifecycle.
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
    logs.log.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  });
  warnSpy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    logs.warn.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
  });
  errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    logs.error.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
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

// --- Lifecycle ---------------------------------------------------------------

beforeEach(() => {
  findUniqueMock.mockReset();
  updateManyMock.mockReset();
  _resetRedisForTests(new InMemoryRedis());
  captureConsole();
});

afterEach(() => {
  restoreConsole();
});

// =============================================================================
// 1. Input validation
// =============================================================================

describe("POST /api/open — input validation", () => {
  it("400 on body that is not JSON", async () => {
    const res = await POST(makeReq({ rawBody: "not-json-at-all" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "invalid_input" });
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("400 on empty body", async () => {
    const res = await POST(makeReq({ rawBody: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "invalid_input" });
  });

  it("400 on JSON `null` body", async () => {
    const res = await POST(makeReq({ rawBody: "null" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
  });

  it("400 when `code` field is missing", async () => {
    const res = await POST(makeReq({ body: { foo: "bar" } }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
  });

  it("400 on code length 15 (short)", async () => {
    const res = await POST(makeReq({ body: { code: "ABCDEFGHJKLMNPQ" } }));
    expect(res.status).toBe(400);
  });

  it("400 on code length 17 (long)", async () => {
    const res = await POST(makeReq({ body: { code: "ABCDEFGHJKLMNPQRS" } }));
    expect(res.status).toBe(400);
  });

  it("400 on forbidden chars: I, 1, 0, O", async () => {
    for (const bad of [
      "ABCDEFGHJKLMNPQI", // I
      "ABCDEFGHJKLMNPQ1", // 1
      "ABCDEFGHJKLMNPQ0", // 0
      "ABCDEFGHJKLMNPQO", // O
    ]) {
      const res = await POST(makeReq({ body: { code: bad } }));
      expect(res.status, `code ${bad} should be rejected`).toBe(400);
    }
  });

  it("400 on non-ASCII char (ñ)", async () => {
    const res = await POST(makeReq({ body: { code: "ABCDEFGHJKLMNPQñ" } }));
    expect(res.status).toBe(400);
  });

  it("400 on inner whitespace (still 16 chars but contains a space)", async () => {
    // Spaces are dropped only at the ends by .trim(); a space INSIDE the code
    // makes it fail the regex.
    const res = await POST(makeReq({ body: { code: "ABCDEFGH JKLMNPQR" } }));
    expect(res.status).toBe(400);
  });

  it("accepts code with leading/trailing whitespace (schema trims)", async () => {
    findUniqueMock.mockResolvedValueOnce(codeRowFixture({ packResult: VALID_PACK_RESULT }));
    const res = await POST(makeReq({ body: { code: `  ${VALID_CODE}  ` } }));
    expect(res.status).toBe(200);
  });

  it("accepts lowercase code (schema upper-cases)", async () => {
    findUniqueMock.mockResolvedValueOnce(codeRowFixture({ packResult: VALID_PACK_RESULT }));
    const res = await POST(makeReq({ body: { code: VALID_CODE.toLowerCase() } }));
    expect(res.status).toBe(200);
    // And it looked up using the normalized (uppercase) form.
    expect(findUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: VALID_CODE } }),
    );
  });
});

// =============================================================================
// 2. Lookup / unavailability — all funnel to the same 404
// =============================================================================

describe("POST /api/open — code lookup / unavailability", () => {
  const expectGeneric404 = async (res: Response): Promise<void> => {
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: "not_found_or_unavailable" });
    // Exactly one key, no leaking sibling fields.
    expect(Object.keys(body as object).sort()).toEqual(["error"]);
  };

  it("404 when code not found in DB", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    const res = await POST(makeReq());
    await expectGeneric404(res);
  });

  it("404 when code is redeemed", async () => {
    findUniqueMock.mockResolvedValueOnce(codeRowFixture({ status: "redeemed" }));
    const res = await POST(makeReq());
    await expectGeneric404(res);
  });

  it("404 when code is disabled", async () => {
    findUniqueMock.mockResolvedValueOnce(codeRowFixture({ status: "disabled" }));
    const res = await POST(makeReq());
    await expectGeneric404(res);
  });

  it("404 when code is expired", async () => {
    findUniqueMock.mockResolvedValueOnce(codeRowFixture({ status: "expired" }));
    const res = await POST(makeReq());
    await expectGeneric404(res);
  });

  it("404 when code is active but expires_at is in the past", async () => {
    findUniqueMock.mockResolvedValueOnce(
      codeRowFixture({ expiresAt: new Date(Date.now() - 60_000) }),
    );
    const res = await POST(makeReq());
    await expectGeneric404(res);
  });

  it("200 when code is active and expires_at is null", async () => {
    findUniqueMock.mockResolvedValueOnce(
      codeRowFixture({ expiresAt: null, packResult: VALID_PACK_RESULT }),
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
  });
});

// =============================================================================
// 3. Response shape — no leaks
// =============================================================================

describe("POST /api/open — response shape (anti-leak)", () => {
  it("success body has EXACTLY { pack, country } and no extra fields", async () => {
    findUniqueMock.mockResolvedValueOnce(
      codeRowFixture({ packResult: VALID_PACK_RESULT, country: "GT" }),
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["country", "pack"]);
    expect(body.country).toBe("GT");
    expect(body.pack).toEqual(VALID_PACK_RESULT);
  });

  it("does NOT include code, id, prize_set_id, variable_pool, weights, redeemed_by, redeemed_ip", async () => {
    findUniqueMock.mockResolvedValueOnce(
      codeRowFixture({ packResult: VALID_PACK_RESULT }),
    );
    const res = await POST(makeReq());
    const body = (await res.json()) as Record<string, unknown>;
    for (const key of [
      "code",
      "id",
      "prize_set_id",
      "prizeSetId",
      "variable_pool",
      "variablePool",
      "weights",
      "redeemed_by",
      "redeemedBy",
      "redeemed_ip",
      "redeemedIp",
    ]) {
      expect(body).not.toHaveProperty(key);
    }
    // And the raw serialized response must not literally contain the code.
    expect(JSON.stringify(body)).not.toContain(VALID_CODE);
  });
});

// =============================================================================
// 4. Atomicity & re-opening
// =============================================================================

describe("POST /api/open — atomicity and re-opening", () => {
  it("first open: persists pack_result via updateMany and returns it", async () => {
    findUniqueMock.mockResolvedValueOnce(codeRowFixture({ packResult: null }));
    updateManyMock.mockResolvedValueOnce({ count: 1 });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(updateManyMock).toHaveBeenCalledTimes(1);
    const call = updateManyMock.mock.calls[0]?.[0] as
      | { where: { id: string; packResult: { equals: unknown } }; data: { packResult: unknown } }
      | undefined;
    expect(call?.where).toMatchObject({
      id: "00000000-0000-0000-0000-000000000001",
      packResult: { equals: Prisma.JsonNull },
    });
    expect(call?.data.packResult).toBeDefined();
  });

  it("second open of the same (non-redeemed) code returns the SAME pack and does NOT call updateMany", async () => {
    findUniqueMock.mockResolvedValueOnce(
      codeRowFixture({ packResult: VALID_PACK_RESULT }),
    );
    const res = await POST(makeReq({ ip: "9.9.9.9" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pack: unknown; country: string };
    expect(body.pack).toEqual(VALID_PACK_RESULT);
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("stored pack_result is corrupt → 404, does NOT re-resolve", async () => {
    findUniqueMock.mockResolvedValueOnce(
      codeRowFixture({ packResult: { totally: "wrong shape" } }),
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found_or_unavailable" });
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("race: updateMany returns count=0 and winner has a valid pack → 200 with winner's pack", async () => {
    const winnerPack = {
      ...VALID_PACK_RESULT,
      variable: [
        { type: "none", label: "Pack ganador 1" },
        { type: "none", label: "Pack ganador 2" },
      ],
    };
    // First findUnique: code is active, no pack yet.
    findUniqueMock.mockResolvedValueOnce(codeRowFixture({ packResult: null }));
    // updateMany loses the race.
    updateManyMock.mockResolvedValueOnce({ count: 0 });
    // Refetch returns the winner's pack.
    findUniqueMock.mockResolvedValueOnce({
      packResult: winnerPack,
      country: "SV",
      status: "active",
      expiresAt: null,
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { pack: unknown; country: string };
    expect(body.pack).toEqual(winnerPack);
    expect(body.country).toBe("SV");
  });

  it("race: updateMany returns count=0 and refetch shows pack still null → defensive 404", async () => {
    findUniqueMock.mockResolvedValueOnce(codeRowFixture({ packResult: null }));
    updateManyMock.mockResolvedValueOnce({ count: 0 });
    findUniqueMock.mockResolvedValueOnce({
      packResult: null,
      country: "SV",
      status: "active",
      expiresAt: null,
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found_or_unavailable" });
  });

  it("race: updateMany returns count=0 and winning pack is malformed → defensive 404", async () => {
    findUniqueMock.mockResolvedValueOnce(codeRowFixture({ packResult: null }));
    updateManyMock.mockResolvedValueOnce({ count: 0 });
    findUniqueMock.mockResolvedValueOnce({
      packResult: { bogus: true },
      country: "SV",
      status: "active",
      expiresAt: null,
    });

    const res = await POST(makeReq());
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// 5. Rate limiting
// =============================================================================

describe("POST /api/open — rate limiting", () => {
  it("11th request from the same IP within 1 minute → 429 rate_limited", async () => {
    // Use 10 different valid codes (with not_found) so the per-code limit
    // (5/min) never triggers — we want to isolate the IP rule.
    for (let i = 0; i < 10; i++) {
      findUniqueMock.mockResolvedValueOnce(null);
    }
    const codes = [
      "ABCDEFGHJKLMNPQR",
      "ABCDEFGHJKLMNPQS",
      "ABCDEFGHJKLMNPQT",
      "ABCDEFGHJKLMNPQU",
      "ABCDEFGHJKLMNPQV",
      "ABCDEFGHJKLMNPQW",
      "ABCDEFGHJKLMNPQX",
      "ABCDEFGHJKLMNPQY",
      "ABCDEFGHJKLMNPQZ",
      "ABCDEFGHJKLMNPR2",
    ];
    for (const c of codes) {
      const r = await POST(makeReq({ ip: "5.5.5.5", body: { code: c } }));
      expect([200, 404]).toContain(r.status);
    }
    const res11 = await POST(
      makeReq({ ip: "5.5.5.5", body: { code: "ABCDEFGHJKLMNPR3" } }),
    );
    expect(res11.status).toBe(429);
    expect(await res11.json()).toEqual({ error: "rate_limited" });
  });

  it("6th request on the same code within 1 minute → 429 rate_limited", async () => {
    // Spread across 6 different IPs to keep the per-IP rule (10/min) loose.
    for (let i = 0; i < 5; i++) {
      findUniqueMock.mockResolvedValueOnce(null);
    }
    for (let i = 0; i < 5; i++) {
      const r = await POST(makeReq({ ip: `10.0.0.${i + 1}`, body: { code: VALID_CODE } }));
      expect(r.status).toBe(404);
    }
    const res6 = await POST(makeReq({ ip: "10.0.0.99", body: { code: VALID_CODE } }));
    expect(res6.status).toBe(429);
    expect(await res6.json()).toEqual({ error: "rate_limited" });
  });

  it("different IPs do not interfere with each other's IP buckets", async () => {
    findUniqueMock.mockResolvedValue(null);
    // 10 requests from IP A — should all pass the rate gate (10/min).
    for (let i = 0; i < 10; i++) {
      const r = await POST(
        makeReq({ ip: "7.7.7.7", body: { code: `ABCDEFGHJKLMNP${(i % 10) + 2}R` } }),
      );
      expect(r.status).not.toBe(429);
    }
    // 11th from A → blocked.
    const blocked = await POST(
      makeReq({ ip: "7.7.7.7", body: { code: "ABCDEFGHJKLMNQRS" } }),
    );
    expect(blocked.status).toBe(429);
    // 1st from B → still fine.
    const fresh = await POST(
      makeReq({ ip: "8.8.8.8", body: { code: "ABCDEFGHJKLMNQRT" } }),
    );
    expect(fresh.status).not.toBe(429);
  });

  it("different codes do not interfere with each other's code buckets", async () => {
    findUniqueMock.mockResolvedValue(null);
    // 5 requests on VALID_CODE from different IPs — fill its code bucket.
    for (let i = 0; i < 5; i++) {
      const r = await POST(
        makeReq({ ip: `11.0.0.${i + 1}`, body: { code: VALID_CODE } }),
      );
      expect(r.status).toBe(404);
    }
    // 6th on VALID_CODE → blocked.
    const blocked = await POST(
      makeReq({ ip: "11.0.0.99", body: { code: VALID_CODE } }),
    );
    expect(blocked.status).toBe(429);
    // 1st on VALID_CODE_2 → still fine.
    const fresh = await POST(
      makeReq({ ip: "11.0.0.50", body: { code: VALID_CODE_2 } }),
    );
    expect(fresh.status).not.toBe(429);
  });

  it("garbage XFF falls back to 'unknown' bucket without crashing", async () => {
    findUniqueMock.mockResolvedValue(null);
    const res = await POST(
      makeReq({
        ip: "'; DROP TABLE codes;--",
        body: { code: VALID_CODE },
      }),
    );
    // Should not 500. Either 404 (lookup miss) or 429 (if other 'unknown'
    // traffic filled the bucket — none should here as we just reset Redis).
    expect([200, 404]).toContain(res.status);
  });
});

// =============================================================================
// 6. Logging and secrets (smoke)
// =============================================================================

describe("POST /api/open — logging hygiene", () => {
  it("logs never contain the plaintext code; do contain a 64-char hex code_hash", async () => {
    findUniqueMock.mockResolvedValueOnce(
      codeRowFixture({ packResult: VALID_PACK_RESULT }),
    );
    await POST(makeReq({ body: { code: VALID_CODE } }));

    const lines = allLogLines();
    expect(lines.length).toBeGreaterThan(0);
    const joined = lines.join("\n");
    expect(joined).not.toContain(VALID_CODE);
    // code_hash is present and matches SHA-256 hex.
    expect(joined).toMatch(/"code_hash":"[0-9a-f]{64}"/);
    // And that hash is exactly the sha256 of the (normalized) code.
    expect(joined).toContain(sha256Hex(VALID_CODE));
  });

  it("logs never contain WEBHOOK_CENTRAL_SECRET / DATABASE_URL / UPSTASH_REDIS_REST_TOKEN values", async () => {
    process.env.WEBHOOK_CENTRAL_SECRET = "qa-secret-must-not-leak-0123456789abcdef";
    process.env.DATABASE_URL = "postgres://qa-must-not-leak@localhost/db";
    process.env.UPSTASH_REDIS_REST_TOKEN = "qa-token-must-not-leak-xyz";

    try {
      findUniqueMock.mockResolvedValueOnce(
        codeRowFixture({ packResult: VALID_PACK_RESULT }),
      );
      await POST(makeReq());

      const joined = allLogLines().join("\n");
      expect(joined).not.toContain("qa-secret-must-not-leak-0123456789abcdef");
      expect(joined).not.toContain("qa-must-not-leak");
      expect(joined).not.toContain("qa-token-must-not-leak-xyz");
    } finally {
      delete process.env.WEBHOOK_CENTRAL_SECRET;
      delete process.env.DATABASE_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    }
  });
});

// =============================================================================
// 7. Internal errors
// =============================================================================

describe("POST /api/open — internal errors", () => {
  it("findUnique throws → 500 internal, body is ONLY { error: 'internal' }", async () => {
    findUniqueMock.mockRejectedValueOnce(new Error("boom-db-error-detail"));
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ error: "internal" });
    expect(Object.keys(body).sort()).toEqual(["error"]);
    // Make sure the error detail did not leak into the response body.
    expect(JSON.stringify(body)).not.toContain("boom-db-error-detail");
  });

  it("updateMany throws → 500 internal, no detail leaked in body", async () => {
    findUniqueMock.mockResolvedValueOnce(codeRowFixture({ packResult: null }));
    updateManyMock.mockRejectedValueOnce(new Error("boom-update-detail"));
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ error: "internal" });
    expect(JSON.stringify(body)).not.toContain("boom-update-detail");
  });
});

// =============================================================================
// 8. Security headers across status codes
// =============================================================================

describe("POST /api/open — security headers across status codes", () => {
  it("200 success carries all security headers", async () => {
    findUniqueMock.mockResolvedValueOnce(
      codeRowFixture({ packResult: VALID_PACK_RESULT }),
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expectSecurityHeaders(res);
  });

  it("400 invalid_input carries all security headers", async () => {
    const res = await POST(makeReq({ rawBody: "garbage" }));
    expect(res.status).toBe(400);
    expectSecurityHeaders(res);
  });

  it("404 not_found_or_unavailable carries all security headers", async () => {
    findUniqueMock.mockResolvedValueOnce(null);
    const res = await POST(makeReq());
    expect(res.status).toBe(404);
    expectSecurityHeaders(res);
  });

  it("429 rate_limited carries all security headers", async () => {
    findUniqueMock.mockResolvedValue(null);
    // Burn the per-code bucket (5/min) then trip a 429.
    for (let i = 0; i < 5; i++) {
      await POST(makeReq({ ip: `12.0.0.${i + 1}`, body: { code: VALID_CODE } }));
    }
    const res = await POST(makeReq({ ip: "12.0.0.99", body: { code: VALID_CODE } }));
    expect(res.status).toBe(429);
    expectSecurityHeaders(res);
  });

  it("500 internal carries all security headers", async () => {
    findUniqueMock.mockRejectedValueOnce(new Error("kaboom"));
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    expectSecurityHeaders(res);
  });
});
