// Tests for `redemptionWebhookPayloadSchema` — the published shape of the
// outbound webhook payload. QA reuses this to validate the exact wire
// contract documented in SECURITY.md §6.

import { describe, it, expect } from "vitest";
import { redemptionWebhookPayloadSchema } from "../lib/webhook/types";
import type { RedemptionWebhookPayload } from "../lib/webhook/types";

const VALID: RedemptionWebhookPayload = {
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

describe("redemptionWebhookPayloadSchema — accepts valid payloads", () => {
  it("accepts a fully-formed SV payload", () => {
    expect(redemptionWebhookPayloadSchema.safeParse(VALID).success).toBe(true);
  });

  it("accepts country=GT", () => {
    const p = { ...VALID, country: "GT" as const };
    expect(redemptionWebhookPayloadSchema.safeParse(p).success).toBe(true);
  });

  it("accepts uppercased hex in UUID fields", () => {
    const p = {
      ...VALID,
      code_id: "11111111-1111-4111-8111-111111111111".toUpperCase(),
    };
    expect(redemptionWebhookPayloadSchema.safeParse(p).success).toBe(true);
  });
});

describe("redemptionWebhookPayloadSchema — rejects malformed payloads", () => {
  it("rejects event != 'redemption'", () => {
    const p = { ...VALID, event: "open" as unknown as "redemption" };
    expect(redemptionWebhookPayloadSchema.safeParse(p).success).toBe(false);
  });

  it("rejects an unknown country", () => {
    const p = { ...VALID, country: "MX" as unknown as "SV" };
    expect(redemptionWebhookPayloadSchema.safeParse(p).success).toBe(false);
  });

  it("rejects a code_id that is not a UUID", () => {
    const p = { ...VALID, code_id: "not-a-uuid" };
    expect(redemptionWebhookPayloadSchema.safeParse(p).success).toBe(false);
  });

  it("rejects a code_hash that is not 64 hex chars", () => {
    const p = { ...VALID, code_hash: "abc123" };
    expect(redemptionWebhookPayloadSchema.safeParse(p).success).toBe(false);
  });

  it("rejects an empty account_id", () => {
    const p = { ...VALID, account_id: "" };
    expect(redemptionWebhookPayloadSchema.safeParse(p).success).toBe(false);
  });

  it("rejects a redeemed_at that is not ISO 8601", () => {
    const p = { ...VALID, redeemed_at: "yesterday" };
    expect(redemptionWebhookPayloadSchema.safeParse(p).success).toBe(false);
  });

  it("rejects a delivery_id that is not a UUID", () => {
    const p = { ...VALID, delivery_id: "abc" };
    expect(redemptionWebhookPayloadSchema.safeParse(p).success).toBe(false);
  });

  it("rejects a payload missing required fields", () => {
    const partial: Record<string, unknown> = { ...VALID };
    delete partial.delivery_id;
    expect(redemptionWebhookPayloadSchema.safeParse(partial).success).toBe(false);
  });

  it("rejects a malformed prizes.pack_version (must be non-empty)", () => {
    const p = {
      ...VALID,
      prizes: { ...VALID.prizes, pack_version: "" },
    };
    expect(redemptionWebhookPayloadSchema.safeParse(p).success).toBe(false);
  });

  it("rejects a malformed prize entry (unknown type)", () => {
    const p = {
      ...VALID,
      prizes: {
        ...VALID.prizes,
        guaranteed: [{ type: "nope", label: "x" }],
      },
    };
    expect(redemptionWebhookPayloadSchema.safeParse(p).success).toBe(false);
  });
});
