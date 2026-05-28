// Unit tests for the outbound webhook sender.
//
// We never make real HTTP calls — every test injects `fetchImpl` and
// `sleepImpl` so timing is deterministic and we don't burn CPU on real
// backoff waits.
//
// Logs are captured via console spies so we can assert the secret never
// leaks and the structured log shape is preserved.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  sendRedemptionWebhook,
  type WebhookDeliveryResult,
} from "../lib/webhook/sender";
import type { RedemptionWebhookPayload } from "../lib/webhook/types";
import {
  WEBHOOK_HEADER_SIGNATURE,
  WEBHOOK_HEADER_TIMESTAMP,
} from "../lib/security/webhook";

const REAL_URL = "https://central.example.test/webhooks/redemption";
const SECRET = "test-secret-at-least-32-bytes-long-1234567890";
const PAYLOAD: RedemptionWebhookPayload = {
  event: "redemption",
  code_id: "11111111-1111-4111-8111-111111111111",
  code_hash:
    "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
  country: "SV",
  account_id: "mock:abcdef0123456789",
  prizes: {
    guaranteed: [
      { type: "sports_credit", amount: 10, currency: "USD", label: "$10" },
    ],
    variable: [{ type: "none", label: "No ganaste" }],
    pack_version: "v1",
  },
  redeemed_at: "2025-01-01T00:00:00.000Z",
  delivery_id: "22222222-2222-4222-8222-222222222222",
};

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

function makeOkResponse(): Response {
  return new Response("{}", { status: 200 });
}

function makeFailResponse(status = 500): Response {
  return new Response("oops", { status });
}

beforeEach(() => {
  delete process.env.WEBHOOK_CENTRAL_URL;
  delete process.env.WEBHOOK_CENTRAL_SECRET;
  captureConsole();
});

afterEach(() => {
  restoreConsole();
  delete process.env.WEBHOOK_CENTRAL_URL;
  delete process.env.WEBHOOK_CENTRAL_SECRET;
});

// =============================================================================
// 1. Dry-run mode (no URL configured)
// =============================================================================

describe("sendRedemptionWebhook — dry-run (WEBHOOK_CENTRAL_URL unset)", () => {
  it("returns { status: 'sent', attempts: 0 } when URL is missing", async () => {
    process.env.WEBHOOK_CENTRAL_SECRET = SECRET;
    const fetchImpl = vi.fn();
    const result = await sendRedemptionWebhook(PAYLOAD, { fetchImpl });
    expect(result).toEqual<WebhookDeliveryResult>({
      status: "sent",
      attempts: 0,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns { status: 'sent', attempts: 0 } even when WEBHOOK_CENTRAL_URL is the empty string", async () => {
    process.env.WEBHOOK_CENTRAL_URL = "";
    process.env.WEBHOOK_CENTRAL_SECRET = SECRET;
    const fetchImpl = vi.fn();
    const result = await sendRedemptionWebhook(PAYLOAD, { fetchImpl });
    expect(result.status).toBe("sent");
    expect(result.attempts).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("logs dry-run event with delivery_id, code_id, and an 8-char signature preview", async () => {
    process.env.WEBHOOK_CENTRAL_SECRET = SECRET;
    await sendRedemptionWebhook(PAYLOAD);
    const joined = allLogLines().join("\n");
    expect(joined).toContain('"event":"webhook.dry_run"');
    expect(joined).toContain(`"delivery_id":"${PAYLOAD.delivery_id}"`);
    expect(joined).toContain(`"code_id":"${PAYLOAD.code_id}"`);
    // Signature preview is exactly 8 hex chars.
    expect(joined).toMatch(/signature_preview=[0-9a-f]{8}/);
  });

  it("dry-run still works when no secret is configured (preview shows 'unsigned')", async () => {
    // No secret → can't sign — dry-run logs `unsigned` instead of an 8-char hex.
    const result = await sendRedemptionWebhook(PAYLOAD);
    expect(result).toEqual({ status: "sent", attempts: 0 });
    const joined = allLogLines().join("\n");
    expect(joined).toContain("signature_preview=unsigned");
  });
});

// =============================================================================
// 2. Real send — success cases
// =============================================================================

describe("sendRedemptionWebhook — real send (URL configured)", () => {
  beforeEach(() => {
    process.env.WEBHOOK_CENTRAL_URL = REAL_URL;
    process.env.WEBHOOK_CENTRAL_SECRET = SECRET;
  });

  it("returns sent/attempts=1 on first-try 200", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(makeOkResponse());
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const result = await sendRedemptionWebhook(PAYLOAD, {
      fetchImpl,
      sleepImpl,
    });
    expect(result).toEqual<WebhookDeliveryResult>({
      status: "sent",
      attempts: 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(sleepImpl).not.toHaveBeenCalled();
  });

  it("retries on 500 then succeeds on 2nd attempt → sent/attempts=2", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(makeFailResponse(500))
      .mockResolvedValueOnce(makeOkResponse());
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const result = await sendRedemptionWebhook(PAYLOAD, {
      fetchImpl,
      sleepImpl,
    });
    expect(result.status).toBe("sent");
    expect(result.attempts).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    // One sleep between attempt 1 and attempt 2.
    expect(sleepImpl).toHaveBeenCalledTimes(1);
    expect(sleepImpl).toHaveBeenNthCalledWith(1, 1000);
  });

  it("sends the expected headers (signature/timestamp/idempotency-key/content-type)", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(makeOkResponse());
    await sendRedemptionWebhook(PAYLOAD, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(url).toBe(REAL_URL);
    expect(init.method).toBe("POST");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(init.headers["idempotency-key"]).toBe(PAYLOAD.delivery_id);
    // Signature header — canonical name from the security module.
    expect(init.headers[WEBHOOK_HEADER_SIGNATURE]).toMatch(/^[0-9a-f]{64}$/);
    // Timestamp header — decimal epoch seconds.
    expect(init.headers[WEBHOOK_HEADER_TIMESTAMP]).toMatch(/^\d+$/);
    // Body is the exact JSON.stringify of the payload (signing canonical form).
    expect(init.body).toBe(JSON.stringify(PAYLOAD));
  });
});

// =============================================================================
// 3. Real send — failure / retry / backoff
// =============================================================================

describe("sendRedemptionWebhook — failure modes", () => {
  beforeEach(() => {
    process.env.WEBHOOK_CENTRAL_URL = REAL_URL;
    process.env.WEBHOOK_CENTRAL_SECRET = SECRET;
  });

  it("3x failure → failed/attempts=3 with lastError set", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(makeFailResponse(503))
      .mockResolvedValueOnce(makeFailResponse(502))
      .mockResolvedValueOnce(makeFailResponse(500));
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const result = await sendRedemptionWebhook(PAYLOAD, {
      fetchImpl,
      sleepImpl,
    });
    expect(result.status).toBe("failed");
    expect(result.attempts).toBe(3);
    expect(result.lastError).toBe("http_500");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    // Two sleeps: between 1→2 and 2→3.
    expect(sleepImpl).toHaveBeenCalledTimes(2);
    expect(sleepImpl).toHaveBeenNthCalledWith(1, 1000);
    expect(sleepImpl).toHaveBeenNthCalledWith(2, 5000);
  });

  it("backoff between retries follows the documented schedule [1000, 5000]", async () => {
    // Force all 3 attempts to fail so we exercise both backoff slots.
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(makeFailResponse(500));
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    await sendRedemptionWebhook(PAYLOAD, { fetchImpl, sleepImpl });
    const callArgs = sleepImpl.mock.calls.map((c) => c[0] as number);
    expect(callArgs).toEqual([1000, 5000]);
  });

  it("fetch throwing (network error) is caught and retried; final lastError is truncated and present", async () => {
    const longMsg = "x".repeat(2000);
    const err = new Error(longMsg);
    const fetchImpl = vi.fn().mockRejectedValue(err);
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const result = await sendRedemptionWebhook(PAYLOAD, {
      fetchImpl,
      sleepImpl,
    });
    expect(result.status).toBe("failed");
    expect(result.attempts).toBe(3);
    expect(result.lastError).toBeDefined();
    // 500-char truncation guard.
    expect((result.lastError ?? "").length).toBeLessThanOrEqual(500);
  });

  it("4xx is treated as a failure and retried (lastError captures the status)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(makeFailResponse(400));
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    const result = await sendRedemptionWebhook(PAYLOAD, {
      fetchImpl,
      sleepImpl,
    });
    expect(result.status).toBe("failed");
    expect(result.lastError).toBe("http_400");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("blocks send (and returns failed/attempts=0) when URL is set but secret is missing", async () => {
    delete process.env.WEBHOOK_CENTRAL_SECRET;
    const fetchImpl = vi.fn();
    const result = await sendRedemptionWebhook(PAYLOAD, { fetchImpl });
    expect(result.status).toBe("failed");
    expect(result.attempts).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

// =============================================================================
// 4. Timeout per attempt
// =============================================================================

describe("sendRedemptionWebhook — per-attempt timeout (10s)", () => {
  beforeEach(() => {
    process.env.WEBHOOK_CENTRAL_URL = REAL_URL;
    process.env.WEBHOOK_CENTRAL_SECRET = SECRET;
  });

  it("aborts an attempt when the AbortSignal fires", async () => {
    // Simulate a fetch that respects AbortSignal: it never resolves but
    // rejects when aborted. We resolve it ourselves on abort.
    const fetchImpl = vi.fn().mockImplementation((_url, init: RequestInit) => {
      const sig = init.signal;
      return new Promise<Response>((_resolve, reject) => {
        if (sig) {
          sig.addEventListener("abort", () => {
            const e = new Error("aborted");
            (e as Error & { name: string }).name = "AbortError";
            reject(e);
          });
        }
      });
    });
    const sleepImpl = vi.fn().mockResolvedValue(undefined);

    vi.useFakeTimers();
    const promise = sendRedemptionWebhook(PAYLOAD, { fetchImpl, sleepImpl });
    // Advance enough to trip the 10s timeout for all 3 attempts.
    await vi.advanceTimersByTimeAsync(35_000);
    const result = await promise;
    vi.useRealTimers();

    expect(result.status).toBe("failed");
    expect(result.attempts).toBe(3);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result.lastError).toBeDefined();
  });
});

// =============================================================================
// 5. Secret hygiene
// =============================================================================

describe("sendRedemptionWebhook — secret hygiene", () => {
  it("never logs WEBHOOK_CENTRAL_SECRET, in either dry-run or send mode", async () => {
    const distinctiveSecret = "DO-NOT-LEAK-secret-XYZ-1234567890-abcdefghij";
    // --- dry-run case ---
    process.env.WEBHOOK_CENTRAL_SECRET = distinctiveSecret;
    await sendRedemptionWebhook(PAYLOAD);
    // --- send case (all attempts fail) ---
    process.env.WEBHOOK_CENTRAL_URL = REAL_URL;
    const fetchImpl = vi.fn().mockResolvedValue(makeFailResponse(500));
    const sleepImpl = vi.fn().mockResolvedValue(undefined);
    await sendRedemptionWebhook(PAYLOAD, { fetchImpl, sleepImpl });

    const joined = allLogLines().join("\n");
    expect(joined).not.toContain(distinctiveSecret);
  });

  it("never logs the full signature — only the first 8 hex chars in dry-run", async () => {
    process.env.WEBHOOK_CENTRAL_SECRET = SECRET;
    await sendRedemptionWebhook(PAYLOAD);
    const joined = allLogLines().join("\n");
    // There must NOT be a full 64-hex-char signature anywhere in the logs.
    expect(joined).not.toMatch(/[0-9a-f]{64}/);
  });
});
