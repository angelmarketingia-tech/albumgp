// QA — E2E adversarial tests for POST /api/redeem.
//
// The endpoint chains: auth gate → body parse → rate-limit → atomic update
// → re-read → audit row insert → webhook → webhook-status persist. Every
// hop has its own failure mode and we test each one explicitly.
//
// Mocking strategy (mirrors api-open.test.ts plus extra surface for redeem):
//   - `@/lib/db/client`: mock `prisma.code.{updateMany,findUnique}` and
//     `prisma.redemption.{create,update}`. We never touch a real DB.
//   - `@/lib/auth/auth-config`: stub out so the `next-auth` ESM/CJS bug
//     under Vitest doesn't bite (same trick as auth-require.test.ts).
//   - `@/lib/auth/identity`: stub `getIdentityProvider()` so we can swap
//     between "no session", "session OK", and "provider throws" per test.
//   - `@/lib/webhook/sender`: stub `sendRedemptionWebhook` — the real sender
//     has its own 15 tests; here we only care that the route invokes it
//     correctly and persists its result.
//   - `_resetRedisForTests` to keep rate-limit deterministic per test.
//   - `vi.spyOn(console, …)` to assert log content / leak hygiene.

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import {
  InMemoryRedis,
  _resetRedisForTests,
} from "../lib/redis/client";
import { redemptionWebhookPayloadSchema } from "../lib/webhook/types";
import type { WebhookDeliveryResult } from "../lib/webhook/sender";

// ----------------------------------------------------------------------------
// Mocks — declared BEFORE the route import.
// ----------------------------------------------------------------------------

// Prisma mock — declared via factories that create their own mocks, then we
// fish them out via `vi.mocked(...)` after the import so `vi.mock`'s hoisting
// doesn't trip over top-level references.
vi.mock("@/lib/db/client", () => {
  const updateMany = vi.fn();
  const findUnique = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  return {
    prisma: {
      code: { updateMany, findUnique },
      redemption: { create, update },
    },
  };
});
vi.mock("../lib/db/client", () => {
  const updateMany = vi.fn();
  const findUnique = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  return {
    prisma: {
      code: { updateMany, findUnique },
      redemption: { create, update },
    },
  };
});

// next-auth ESM/CJS interop blows up under Vitest — neutralize it.
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

// Identity — `getIdentityProvider()` is what `requireAccountId(req)` calls
// by default. We swap it for a stub controlled via a `vi.fn()` on the
// provider object that we mutate per test.
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

// Webhook sender — capture invocations and steer the result per test.
vi.mock("@/lib/webhook/sender", () => ({
  sendRedemptionWebhook: vi.fn(),
}));
vi.mock("../lib/webhook/sender", () => ({
  sendRedemptionWebhook: vi.fn(),
}));

// Safe to import the route now — its dependencies resolve to the mocks.
import { POST } from "../app/api/redeem/route";
// Pull the live `vi.fn()` instances out of the mocked modules so we can
// configure them per-test. The route imports via the `@/` alias path, so
// THAT is the canonical module instance Vitest binds.
import { prisma as prismaFromMock } from "@/lib/db/client";
import { getIdentityProvider } from "@/lib/auth/identity";
import { sendRedemptionWebhook as sendWebhookFromMock } from "@/lib/webhook/sender";

const updateManyMock = prismaFromMock.code.updateMany as ReturnType<
  typeof vi.fn
>;
const findUniqueMock = prismaFromMock.code.findUnique as ReturnType<
  typeof vi.fn
>;
const redemptionCreateMock = prismaFromMock.redemption.create as ReturnType<
  typeof vi.fn
>;
const redemptionUpdateMock = prismaFromMock.redemption.update as ReturnType<
  typeof vi.fn
>;
const resolveAccountIdMock = getIdentityProvider().resolveAccountId as ReturnType<
  typeof vi.fn
>;
const sendRedemptionWebhookMock = sendWebhookFromMock as unknown as ReturnType<
  typeof vi.fn
>;

// ----------------------------------------------------------------------------
// Fixtures + helpers
// ----------------------------------------------------------------------------

const VALID_CODE = "ABCDEFGHJKLMNPQR";
const VALID_CODE_2 = "ZYXWVUTSRQPNMLKJ";
const VALID_ACCOUNT_ID = "mock:abcdef0123456789";
const VALID_CODE_ID = "11111111-1111-4111-8111-111111111111";
const VALID_REDEMPTION_ID = "33333333-3333-4333-8333-333333333333";

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

interface MakeReqOpts {
  body?: unknown;
  rawBody?: string;
  ip?: string;
  headers?: Record<string, string>;
}

// Simulate Vercel so `extractClientIp` honors `x-vercel-forwarded-for` (else
// it falls back to a UA-hashed bucket and per-IP isolation tests collapse).
process.env.VERCEL = "1";

function makeReq(opts: MakeReqOpts = {}): Request {
  let bodyStr: string;
  if (opts.rawBody !== undefined) {
    bodyStr = opts.rawBody;
  } else if (opts.body !== undefined) {
    bodyStr = JSON.stringify(opts.body);
  } else {
    bodyStr = JSON.stringify({ code: VALID_CODE });
  }
  // Same-origin gate + explicit Content-Length are both required by the
  // route (SECURITY.md §2). Without them the request is rejected at 403/413
  // before reaching the validation we're actually testing.
  const ip = opts.ip ?? "1.2.3.4";
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": ip,
    "x-vercel-forwarded-for": ip,
    host: "x.test",
    origin: "http://x.test",
    "content-length": String(Buffer.byteLength(bodyStr, "utf8")),
    ...(opts.headers ?? {}),
  };
  return new Request("http://x.test/api/redeem", {
    method: "POST",
    headers,
    body: bodyStr,
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
}

/** Wire all four prisma mocks to a happy-path canonical canje. */
function happyPathMocks(overrides?: {
  packResult?: unknown;
  country?: "SV" | "GT";
  delivery?: WebhookDeliveryResult;
}): void {
  resolveAccountIdMock.mockResolvedValue(VALID_ACCOUNT_ID);
  updateManyMock.mockResolvedValue({ count: 1 });
  findUniqueMock.mockResolvedValue({
    id: VALID_CODE_ID,
    country: overrides?.country ?? "SV",
    packResult: overrides?.packResult ?? VALID_PACK_RESULT,
  });
  redemptionCreateMock.mockResolvedValue({
    id: VALID_REDEMPTION_ID,
    createdAt: new Date("2026-05-28T00:00:00.000Z"),
  });
  redemptionUpdateMock.mockResolvedValue({});
  sendRedemptionWebhookMock.mockResolvedValue({
    status: "sent",
    attempts: 1,
  });
}

// Captured console output.
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
  updateManyMock.mockReset();
  findUniqueMock.mockReset();
  redemptionCreateMock.mockReset();
  redemptionUpdateMock.mockReset();
  sendRedemptionWebhookMock.mockReset();
  _resetRedisForTests(new InMemoryRedis());
  captureConsole();
});

afterEach(() => {
  restoreConsole();
});

// =============================================================================
// A. Authentication
// =============================================================================

describe("POST /api/redeem — authentication", () => {
  it("401 unauthenticated when provider resolves to null; updateMany NOT called", async () => {
    resolveAccountIdMock.mockResolvedValueOnce(null);
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ error: "unauthenticated" });
    expect(Object.keys(body)).toEqual(["error"]);
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(redemptionCreateMock).not.toHaveBeenCalled();
    expectSecurityHeaders(res);
  });

  it("500 internal when the identity provider throws (no detail leaked)", async () => {
    resolveAccountIdMock.mockRejectedValueOnce(
      new Error("session-store-down-secret-detail"),
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ error: "internal" });
    expect(Object.keys(body)).toEqual(["error"]);
    expect(JSON.stringify(body)).not.toContain("session-store-down");
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("session OK but body invalid → 400 invalid_input", async () => {
    resolveAccountIdMock.mockResolvedValueOnce(VALID_ACCOUNT_ID);
    const res = await POST(makeReq({ body: { code: "short" } }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
    expect(updateManyMock).not.toHaveBeenCalled();
  });
});

// =============================================================================
// B. Input validation
// =============================================================================

describe("POST /api/redeem — input validation (with auth)", () => {
  beforeEach(() => {
    resolveAccountIdMock.mockResolvedValue(VALID_ACCOUNT_ID);
  });

  it("400 on body that is not JSON", async () => {
    const res = await POST(makeReq({ rawBody: "not-json-at-all" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("413 on empty body (size gate rejects 0-length before JSON parse)", async () => {
    // The route's `readJsonBody` gate rejects content-length <= 0 with 413
    // (defense-in-depth on body size). An empty body therefore never reaches
    // the JSON parser. Either 413 or 400 is acceptable per SECURITY.md — both
    // surface the same generic `invalid_input` body to clients.
    const res = await POST(makeReq({ rawBody: "" }));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "invalid_input" });
  });

  it("400 on JSON null body", async () => {
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
    const bads = [
      "ABCDEFGHJKLMNPQI",
      "ABCDEFGHJKLMNPQ1",
      "ABCDEFGHJKLMNPQ0",
      "ABCDEFGHJKLMNPQO",
    ];
    // Distinct IPs per case so the per-IP rate-limit (3/min) can't mask a
    // validation failure once we exceed 3 iterations — this is a format test.
    for (let i = 0; i < bads.length; i++) {
      const bad = bads[i];
      const res = await POST(makeReq({ ip: `4.4.4.${i + 1}`, body: { code: bad } }));
      expect(res.status, `code ${bad} should be rejected`).toBe(400);
    }
  });
});

// =============================================================================
// C. Atomic update
// =============================================================================

describe("POST /api/redeem — atomic update", () => {
  beforeEach(() => {
    resolveAccountIdMock.mockResolvedValue(VALID_ACCOUNT_ID);
  });

  it("happy path: updateMany count=1 + valid pack → 200 with { status, prizes, country }", async () => {
    happyPathMocks({ country: "GT" });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({
      status: "redeemed",
      prizes: VALID_PACK_RESULT,
      country: "GT",
    });
  });

  it("updateMany count=0 → 404 not_found_or_unavailable; redemption.create NOT called", async () => {
    resolveAccountIdMock.mockResolvedValue(VALID_ACCOUNT_ID);
    updateManyMock.mockResolvedValueOnce({ count: 0 });
    // Pipeline now does an idempotency-replay findUnique on count=0 to detect
    // the "same account retrying its own already-redeemed code" case. Here we
    // return null so it falls through to the generic 404.
    findUniqueMock.mockResolvedValueOnce(null);
    const res = await POST(makeReq());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found_or_unavailable" });
    expect(redemptionCreateMock).not.toHaveBeenCalled();
  });

  it("updateMany throws → 500 internal, no DB detail leaked", async () => {
    updateManyMock.mockRejectedValueOnce(
      new Error("pg-connection-refused-detail"),
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ error: "internal" });
    expect(JSON.stringify(body)).not.toContain("pg-connection-refused");
  });

  it("updateMany WHERE includes status='active' AND expires_at OR-clause", async () => {
    happyPathMocks();
    await POST(makeReq());
    expect(updateManyMock).toHaveBeenCalledTimes(1);
    const call = updateManyMock.mock.calls[0]?.[0] as {
      where: {
        code: string;
        status: string;
        OR: Array<{ expiresAt: null | { gt: Date } }>;
      };
      data: {
        status: string;
        redeemedAt: Date;
        redeemedBy: string;
        redeemedIp: string;
      };
    };
    expect(call.where.code).toBe(VALID_CODE);
    expect(call.where.status).toBe("active");
    expect(Array.isArray(call.where.OR)).toBe(true);
    expect(call.where.OR).toHaveLength(2);
    expect(call.where.OR[0]).toEqual({ expiresAt: null });
    // Second branch: { expiresAt: { gt: <Date> } }
    const second = call.where.OR[1] as { expiresAt: { gt: Date } };
    expect(second.expiresAt.gt).toBeInstanceOf(Date);
    // data flip
    expect(call.data.status).toBe("redeemed");
    expect(call.data.redeemedBy).toBe(VALID_ACCOUNT_ID);
    expect(call.data.redeemedAt).toBeInstanceOf(Date);
    expect(typeof call.data.redeemedIp).toBe("string");
  });
});

// =============================================================================
// D. Re-read post-update
// =============================================================================

describe("POST /api/redeem — re-read post-update", () => {
  beforeEach(() => {
    resolveAccountIdMock.mockResolvedValue(VALID_ACCOUNT_ID);
  });

  it("findUnique returns null after a successful update → 409 conflict + anomaly log", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 1 });
    findUniqueMock.mockResolvedValueOnce(null);
    const res = await POST(makeReq());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "conflict" });
    expect(redemptionCreateMock).not.toHaveBeenCalled();
    expect(allLogLines().join("\n")).toContain("redeem.anomaly_row_missing");
  });

  it("findUnique returns row with packResult=null → 409 conflict; redemption.create NOT called", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 1 });
    findUniqueMock.mockResolvedValueOnce({
      id: VALID_CODE_ID,
      country: "SV",
      packResult: null,
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "conflict" });
    expect(redemptionCreateMock).not.toHaveBeenCalled();
    expect(allLogLines().join("\n")).toContain("redeem.anomaly_pack_missing");
  });

  it("findUnique returns row with corrupt packResult → 409 conflict; redemption.create NOT called", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 1 });
    findUniqueMock.mockResolvedValueOnce({
      id: VALID_CODE_ID,
      country: "SV",
      packResult: { totally: "wrong shape" },
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "conflict" });
    expect(redemptionCreateMock).not.toHaveBeenCalled();
    expect(allLogLines().join("\n")).toContain("redeem.pack_invalid");
  });

  it("findUnique throws → 500 internal; no detail leaked", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 1 });
    findUniqueMock.mockRejectedValueOnce(
      new Error("findUnique-secret-detail-X"),
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ error: "internal" });
    expect(JSON.stringify(body)).not.toContain("findUnique-secret-detail-X");
    expect(redemptionCreateMock).not.toHaveBeenCalled();
  });
});

// =============================================================================
// E. Audit row in `redemptions`
// =============================================================================

describe("POST /api/redeem — audit row in `redemptions`", () => {
  beforeEach(() => {
    resolveAccountIdMock.mockResolvedValue(VALID_ACCOUNT_ID);
    updateManyMock.mockResolvedValue({ count: 1 });
    findUniqueMock.mockResolvedValue({
      id: VALID_CODE_ID,
      country: "SV",
      packResult: VALID_PACK_RESULT,
    });
  });

  it("redemption.create generic failure → 500 internal; no detail leaked", async () => {
    redemptionCreateMock.mockRejectedValueOnce(
      new Error("redemption-create-detail-XYZ"),
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toEqual({ error: "internal" });
    expect(JSON.stringify(body)).not.toContain("redemption-create-detail-XYZ");
  });

  it("redemption.create P2002 → 409 conflict + duplicate log", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "5.0.0",
      },
    );
    redemptionCreateMock.mockRejectedValueOnce(p2002);
    const res = await POST(makeReq());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "conflict" });
    expect(allLogLines().join("\n")).toContain("redeem.duplicate_redemption");
    // Webhook should NOT have been called — we bailed before fire.
    expect(sendRedemptionWebhookMock).not.toHaveBeenCalled();
  });

  it("redemption.create receives codeId, accountId, result, webhookStatus=pending, webhookAttempts=0", async () => {
    redemptionCreateMock.mockResolvedValueOnce({
      id: VALID_REDEMPTION_ID,
      createdAt: new Date("2026-05-28T00:00:00.000Z"),
    });
    redemptionUpdateMock.mockResolvedValueOnce({});
    sendRedemptionWebhookMock.mockResolvedValueOnce({
      status: "sent",
      attempts: 1,
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const call = redemptionCreateMock.mock.calls[0]?.[0] as {
      data: {
        codeId: string;
        accountId: string;
        result: unknown;
        webhookStatus: string;
        webhookAttempts: number;
      };
    };
    expect(call.data.codeId).toBe(VALID_CODE_ID);
    expect(call.data.accountId).toBe(VALID_ACCOUNT_ID);
    expect(call.data.result).toEqual(VALID_PACK_RESULT);
    expect(call.data.webhookStatus).toBe("pending");
    expect(call.data.webhookAttempts).toBe(0);
  });
});

// =============================================================================
// F. Webhook invocation
// =============================================================================

describe("POST /api/redeem — webhook invocation", () => {
  beforeEach(() => {
    resolveAccountIdMock.mockResolvedValue(VALID_ACCOUNT_ID);
    updateManyMock.mockResolvedValue({ count: 1 });
    findUniqueMock.mockResolvedValue({
      id: VALID_CODE_ID,
      country: "SV",
      packResult: VALID_PACK_RESULT,
    });
    redemptionCreateMock.mockResolvedValue({
      id: VALID_REDEMPTION_ID,
      createdAt: new Date("2026-05-28T00:00:00.000Z"),
    });
    redemptionUpdateMock.mockResolvedValue({});
  });

  it("sender returns sent/attempts=1 → 200; redemption.update called with sent/1/null", async () => {
    sendRedemptionWebhookMock.mockResolvedValueOnce({
      status: "sent",
      attempts: 1,
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(redemptionUpdateMock).toHaveBeenCalledTimes(1);
    const call = redemptionUpdateMock.mock.calls[0]?.[0] as {
      where: { id: string };
      data: {
        webhookStatus: string;
        webhookAttempts: number;
        webhookLastError: string | null;
      };
    };
    expect(call.where.id).toBe(VALID_REDEMPTION_ID);
    expect(call.data.webhookStatus).toBe("sent");
    expect(call.data.webhookAttempts).toBe(1);
    expect(call.data.webhookLastError).toBeNull();
  });

  it("sender returns sent/attempts=0 (dry-run) → 200; persisted as 'pending' with attempts=0", async () => {
    // Convention: a dry-run (sender returns sent+attempts=0 because the
    // upstream webhook URL is unset) is recorded as `pending`, NOT `sent`,
    // so historical audits can tell real deliveries apart from no-ops.
    sendRedemptionWebhookMock.mockResolvedValueOnce({
      status: "sent",
      attempts: 0,
    });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const call = redemptionUpdateMock.mock.calls[0]?.[0] as {
      data: { webhookStatus: string; webhookAttempts: number };
    };
    expect(call.data.webhookStatus).toBe("pending");
    expect(call.data.webhookAttempts).toBe(0);
  });

  it("sender returns failed/attempts=3/lastError=http_503 → 200; redemption.update reflects failure; warn logged", async () => {
    sendRedemptionWebhookMock.mockResolvedValueOnce({
      status: "failed",
      attempts: 3,
      lastError: "http_503",
    });
    const res = await POST(makeReq());
    // From the user's POV the canje succeeded — the webhook is re-driveable.
    expect(res.status).toBe(200);
    const call = redemptionUpdateMock.mock.calls[0]?.[0] as {
      data: {
        webhookStatus: string;
        webhookAttempts: number;
        webhookLastError: string | null;
      };
    };
    expect(call.data.webhookStatus).toBe("failed");
    expect(call.data.webhookAttempts).toBe(3);
    expect(call.data.webhookLastError).toBe("http_503");
    expect(allLogLines().join("\n")).toContain("redeem.webhook_failed");
  });

  it("redemption.update failure after webhook → still 200; anomaly logged", async () => {
    sendRedemptionWebhookMock.mockResolvedValueOnce({
      status: "sent",
      attempts: 1,
    });
    redemptionUpdateMock.mockReset();
    redemptionUpdateMock.mockRejectedValueOnce(
      new Error("update-persist-detail"),
    );
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe("redeemed");
    expect(allLogLines().join("\n")).toContain(
      "redeem.webhook_status_persist_failed",
    );
  });
});

// =============================================================================
// G. Webhook payload contract
// =============================================================================

describe("POST /api/redeem — webhook payload", () => {
  beforeEach(() => {
    happyPathMocks();
  });

  it("sender invoked with a payload conforming to redemptionWebhookPayloadSchema", async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expect(sendRedemptionWebhookMock).toHaveBeenCalledTimes(1);
    const payload = sendRedemptionWebhookMock.mock.calls[0]?.[0];
    // .parse throws if invalid; success is the assertion.
    const parsed = redemptionWebhookPayloadSchema.parse(payload);
    expect(parsed.event).toBe("redemption");
    expect(parsed.code_id).toBe(VALID_CODE_ID);
    expect(parsed.code_hash).toBe(sha256Hex(VALID_CODE));
    expect(parsed.country).toBe("SV");
    expect(parsed.account_id).toBe(VALID_ACCOUNT_ID);
    expect(parsed.prizes).toEqual(VALID_PACK_RESULT);
    // delivery_id is a UUID generated by the route.
    expect(parsed.delivery_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    // redeemed_at is ISO 8601.
    expect(parsed.redeemed_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });

  it("plaintext code NEVER appears in the webhook payload (only code_hash)", async () => {
    await POST(makeReq());
    const payload = sendRedemptionWebhookMock.mock.calls[0]?.[0];
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(VALID_CODE);
    // But the hash is there.
    expect(serialized).toContain(sha256Hex(VALID_CODE));
  });
});

// =============================================================================
// H. Response shape — anti-leak
// =============================================================================

describe("POST /api/redeem — response shape (anti-leak)", () => {
  it("200 success body has EXACTLY { status, prizes, country }", async () => {
    happyPathMocks({ country: "SV" });
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["country", "prizes", "status"]);
    expect(body.status).toBe("redeemed");
    expect(body.country).toBe("SV");
    expect(body.prizes).toEqual(VALID_PACK_RESULT);
  });

  it("200 response does NOT include code, id, code_id, account_id, prize_set_id, delivery_id, webhook_status, etc.", async () => {
    happyPathMocks();
    const res = await POST(makeReq());
    const body = (await res.json()) as Record<string, unknown>;
    for (const key of [
      "code",
      "id",
      "code_id",
      "codeId",
      "account_id",
      "accountId",
      "prize_set_id",
      "prizeSetId",
      "delivery_id",
      "deliveryId",
      "webhook_status",
      "webhookStatus",
      "redeemed_at",
      "redeemedAt",
      "redeemed_by",
      "redeemedBy",
      "redeemed_ip",
      "redeemedIp",
    ]) {
      expect(body, `must not leak ${key}`).not.toHaveProperty(key);
    }
  });

  it("plaintext code never appears in JSON.stringify of the response body", async () => {
    happyPathMocks();
    const res = await POST(makeReq());
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain(VALID_CODE);
  });
});

// =============================================================================
// I. Rate limit (post-auth)
// =============================================================================

describe("POST /api/redeem — rate limiting", () => {
  beforeEach(() => {
    resolveAccountIdMock.mockResolvedValue(VALID_ACCOUNT_ID);
  });

  it("4th request from the same IP within 1 minute → 429; auth keeps passing", async () => {
    // Per-IP cap is 3/min. 3 fresh requests with DIFFERENT valid codes (so the
    // per-code 1/min limit never trips) on the same IP each respond 404
    // (updateMany count=0); the 4th trips the IP bucket. Auth runs on every one
    // (it's checked BEFORE rate limit), including the blocked request.
    updateManyMock.mockResolvedValue({ count: 0 });
    const codes = [
      "ABCDEFGHJKLMNPQR",
      "ABCDEFGHJKLMNPQS",
      "ABCDEFGHJKLMNPQT",
    ];
    for (const c of codes) {
      const r = await POST(makeReq({ ip: "5.5.5.5", body: { code: c } }));
      expect(r.status).toBe(404);
    }
    const blocked = await POST(
      makeReq({ ip: "5.5.5.5", body: { code: "ABCDEFGHJKLMNPQU" } }),
    );
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "rate_limited" });
    // Auth still ran on the blocked request — it's checked BEFORE rate limit.
    expect(resolveAccountIdMock).toHaveBeenCalledTimes(codes.length + 1);
  });

  it("2nd request on the same code within 1 minute → 429", async () => {
    updateManyMock.mockResolvedValue({ count: 0 });
    const r1 = await POST(
      makeReq({ ip: "10.0.0.1", body: { code: VALID_CODE } }),
    );
    expect(r1.status).toBe(404);
    const r2 = await POST(
      makeReq({ ip: "10.0.0.2", body: { code: VALID_CODE } }),
    );
    expect(r2.status).toBe(429);
    expect(await r2.json()).toEqual({ error: "rate_limited" });
  });

  it("different accounts on different IPs do NOT interfere", async () => {
    // Account A on IP 7.7.7.7 hits its per-IP cap (3). A *different* account on
    // a fresh IP must still pass — its IP bucket and account bucket are clean.
    updateManyMock.mockResolvedValue({ count: 0 });
    const codesA = [
      "ABCDEFGHJKLMNPQR",
      "ABCDEFGHJKLMNPQS",
      "ABCDEFGHJKLMNPQT",
    ];
    for (const c of codesA) {
      const r = await POST(makeReq({ ip: "7.7.7.7", body: { code: c } }));
      expect(r.status).not.toBe(429);
    }
    const blockedA = await POST(
      makeReq({ ip: "7.7.7.7", body: { code: "ABCDEFGHJKLMNPQU" } }),
    );
    expect(blockedA.status).toBe(429);
    // Fresh IP AND a different account → both buckets clean → must not 429.
    resolveAccountIdMock.mockResolvedValueOnce("mock:fedcba9876543210");
    const freshB = await POST(
      makeReq({ ip: "8.8.8.8", body: { code: VALID_CODE_2 } }),
    );
    expect(freshB.status).not.toBe(429);
  });

  it("per-account cap spans IPs: one account spraying across many IPs is throttled", async () => {
    // The whole point of the per-account rule: a botnet rotating IPs but reusing
    // one account can't exceed 10 redeems/min. We fire 10 requests, each from a
    // DISTINCT IP and a DISTINCT code (so neither the per-IP 3/min nor the
    // per-code 1/min trips), all on the SAME account. The 11th must 429 purely
    // on the per-account bucket.
    updateManyMock.mockResolvedValue({ count: 0 });
    const codes = [
      "ABCDEFGHJKLMNP22",
      "ABCDEFGHJKLMNP23",
      "ABCDEFGHJKLMNP24",
      "ABCDEFGHJKLMNP25",
      "ABCDEFGHJKLMNP26",
      "ABCDEFGHJKLMNP27",
      "ABCDEFGHJKLMNP28",
      "ABCDEFGHJKLMNP29",
      "ABCDEFGHJKLMNP32",
      "ABCDEFGHJKLMNP33",
    ];
    for (let i = 0; i < codes.length; i++) {
      const r = await POST(
        makeReq({ ip: `9.0.0.${i + 1}`, body: { code: codes[i] } }),
      );
      expect(r.status).not.toBe(429);
    }
    const blocked = await POST(
      makeReq({ ip: "9.0.0.250", body: { code: "ABCDEFGHJKLMNP34" } }),
    );
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: "rate_limited" });
  });
});

// =============================================================================
// J. Security headers across status codes
// =============================================================================

describe("POST /api/redeem — security headers across status codes", () => {
  it("200 carries all security headers", async () => {
    happyPathMocks();
    const res = await POST(makeReq());
    expect(res.status).toBe(200);
    expectSecurityHeaders(res);
  });

  it("401 carries all security headers", async () => {
    resolveAccountIdMock.mockResolvedValueOnce(null);
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
    expectSecurityHeaders(res);
  });

  it("400 carries all security headers", async () => {
    resolveAccountIdMock.mockResolvedValueOnce(VALID_ACCOUNT_ID);
    const res = await POST(makeReq({ rawBody: "garbage" }));
    expect(res.status).toBe(400);
    expectSecurityHeaders(res);
  });

  it("404 carries all security headers", async () => {
    resolveAccountIdMock.mockResolvedValueOnce(VALID_ACCOUNT_ID);
    updateManyMock.mockResolvedValueOnce({ count: 0 });
    const res = await POST(makeReq());
    expect(res.status).toBe(404);
    expectSecurityHeaders(res);
  });

  it("409 carries all security headers", async () => {
    resolveAccountIdMock.mockResolvedValueOnce(VALID_ACCOUNT_ID);
    updateManyMock.mockResolvedValueOnce({ count: 1 });
    findUniqueMock.mockResolvedValueOnce(null);
    const res = await POST(makeReq());
    expect(res.status).toBe(409);
    expectSecurityHeaders(res);
  });

  it("429 carries all security headers", async () => {
    resolveAccountIdMock.mockResolvedValue(VALID_ACCOUNT_ID);
    updateManyMock.mockResolvedValue({ count: 0 });
    for (let i = 0; i < 5; i++) {
      await POST(
        makeReq({
          ip: "12.0.0.1",
          body: { code: `ABCDEFGHJKLMNPQ${"RSTUV"[i]}` },
        }),
      );
    }
    const res = await POST(
      makeReq({ ip: "12.0.0.1", body: { code: "ABCDEFGHJKLMNPQW" } }),
    );
    expect(res.status).toBe(429);
    expectSecurityHeaders(res);
  });

  it("500 carries all security headers", async () => {
    resolveAccountIdMock.mockResolvedValueOnce(VALID_ACCOUNT_ID);
    updateManyMock.mockRejectedValueOnce(new Error("boom"));
    const res = await POST(makeReq());
    expect(res.status).toBe(500);
    expectSecurityHeaders(res);
  });
});

// =============================================================================
// K. Logging hygiene
// =============================================================================

describe("POST /api/redeem — logging hygiene", () => {
  it("no captured log contains the plaintext code; code_hash IS present", async () => {
    happyPathMocks();
    await POST(makeReq());
    const joined = allLogLines().join("\n");
    expect(joined.length).toBeGreaterThan(0);
    expect(joined).not.toContain(VALID_CODE);
    expect(joined).toContain(sha256Hex(VALID_CODE));
  });

  it("logs never contain WEBHOOK_CENTRAL_SECRET / MOCK_AUTH_PASSWORD / AUTH_SECRET values", async () => {
    const SENTINEL = "sentinel-secret-do-not-log-ZZQQXX";
    process.env.WEBHOOK_CENTRAL_SECRET = `webhook-${SENTINEL}-w`;
    process.env.MOCK_AUTH_PASSWORD = `mock-${SENTINEL}-m`;
    process.env.AUTH_SECRET = `auth-${SENTINEL}-a`;
    try {
      happyPathMocks();
      await POST(makeReq());
      const joined = allLogLines().join("\n");
      expect(joined).not.toContain(SENTINEL);
    } finally {
      delete process.env.WEBHOOK_CENTRAL_SECRET;
      delete process.env.MOCK_AUTH_PASSWORD;
      delete process.env.AUTH_SECRET;
    }
  });

  it("logs include account_id and code_hash for correlation; no email leaks", async () => {
    happyPathMocks();
    await POST(makeReq());
    const joined = allLogLines().join("\n");
    expect(joined).toContain(VALID_ACCOUNT_ID);
    expect(joined).toContain(sha256Hex(VALID_CODE));
    // The mock provider returns an OPAQUE `mock:` identifier — no real email
    // should appear because the route never sees one.
    expect(joined).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  });
});
