import { describe, it, expect } from "vitest";
import {
  signWebhookPayload,
  verifyWebhookSignature,
  WEBHOOK_HEADER_SIGNATURE,
  WEBHOOK_HEADER_TIMESTAMP,
} from "../lib/security/webhook";

const SECRET = "test-secret-at-least-32-bytes-long-1234567890";
const ALT_SECRET = "another-secret-at-least-32-bytes-1234567890ab";

describe("signWebhookPayload", () => {
  it("is deterministic for same payload + secret + timestamp", () => {
    const t = 1_700_000_000_000;
    const a = signWebhookPayload('{"hello":"world"}', SECRET, t);
    const b = signWebhookPayload('{"hello":"world"}', SECRET, t);
    expect(a.signature).toBe(b.signature);
    expect(a.timestamp).toBe(b.timestamp);
  });

  it("produces a different signature with a different secret", () => {
    const t = 1_700_000_000_000;
    const a = signWebhookPayload('{"x":1}', SECRET, t);
    const b = signWebhookPayload('{"x":1}', ALT_SECRET, t);
    expect(a.signature).not.toBe(b.signature);
  });

  it("produces a different signature with a different payload", () => {
    const t = 1_700_000_000_000;
    const a = signWebhookPayload('{"x":1}', SECRET, t);
    const b = signWebhookPayload('{"x":2}', SECRET, t);
    expect(a.signature).not.toBe(b.signature);
  });

  it("emits hex lowercase signature of length 64 (sha256)", () => {
    const { signature } = signWebhookPayload("body", SECRET);
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it("timestamp is decimal epoch seconds", () => {
    const t = 1_700_000_000_000;
    const { timestamp } = signWebhookPayload("body", SECRET, t);
    expect(timestamp).toBe("1700000000");
  });

  it("throws if secret is missing or too short", () => {
    expect(() => signWebhookPayload("body", "")).toThrow();
    expect(() => signWebhookPayload("body", "short")).toThrow();
  });
});

describe("verifyWebhookSignature", () => {
  it("verifies a signature produced by signWebhookPayload", () => {
    const payload = '{"event":"redeem","code_id":"u-1"}';
    const t = 1_700_000_000_000;
    const { signature, timestamp } = signWebhookPayload(payload, SECRET, t);
    const ok = verifyWebhookSignature(payload, SECRET, signature, timestamp, {
      now: t,
    });
    expect(ok).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const t = 1_700_000_000_000;
    const { signature, timestamp } = signWebhookPayload("original", SECRET, t);
    expect(
      verifyWebhookSignature("tampered", SECRET, signature, timestamp, {
        now: t,
      }),
    ).toBe(false);
  });

  it("rejects with the wrong secret", () => {
    const t = 1_700_000_000_000;
    const { signature, timestamp } = signWebhookPayload("payload", SECRET, t);
    expect(
      verifyWebhookSignature(
        "payload",
        ALT_SECRET,
        signature,
        timestamp,
        { now: t },
      ),
    ).toBe(false);
  });

  it("rejects when timestamp is outside tolerance window", () => {
    const t = 1_700_000_000_000;
    const { signature, timestamp } = signWebhookPayload("payload", SECRET, t);
    // 1 hour later, tolerance 5 min → reject
    expect(
      verifyWebhookSignature("payload", SECRET, signature, timestamp, {
        now: t + 60 * 60 * 1000,
        toleranceSeconds: 300,
      }),
    ).toBe(false);
  });

  it("accepts when within tolerance window", () => {
    const t = 1_700_000_000_000;
    const { signature, timestamp } = signWebhookPayload("payload", SECRET, t);
    expect(
      verifyWebhookSignature("payload", SECRET, signature, timestamp, {
        now: t + 60 * 1000, // 1 min later
        toleranceSeconds: 300,
      }),
    ).toBe(true);
  });

  it("rejects invalid timestamp formats", () => {
    expect(
      verifyWebhookSignature("payload", SECRET, "deadbeef", "not-a-number"),
    ).toBe(false);
    expect(
      verifyWebhookSignature("payload", SECRET, "deadbeef", "-100"),
    ).toBe(false);
  });

  it("rejects signatures of different length without crashing", () => {
    const t = 1_700_000_000_000;
    const { timestamp } = signWebhookPayload("payload", SECRET, t);
    expect(
      verifyWebhookSignature("payload", SECRET, "tooshort", timestamp, {
        now: t,
      }),
    ).toBe(false);
  });
});

describe("header constants", () => {
  it("exports canonical header names", () => {
    expect(WEBHOOK_HEADER_TIMESTAMP).toBe("X-AlbumGP-Timestamp");
    expect(WEBHOOK_HEADER_SIGNATURE).toBe("X-AlbumGP-Signature");
  });
});
