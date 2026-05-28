// Unit tests for `lib/ui/format.ts`. Pure helpers — no DOM, no fetch.

import { describe, it, expect } from "vitest";
import {
  formatCodeDisplay,
  formatRedeemedAt,
  prizeShortDescription,
  rarityLabel,
} from "../lib/ui/format";
import type { Prize } from "../lib/prizes/types";

describe("formatCodeDisplay", () => {
  it("inserts spaces every 4 chars on a canonical 16-char code", () => {
    expect(formatCodeDisplay("ABCDEFGHJKLMNPQR")).toBe("ABCD EFGH JKLM NPQR");
  });

  it("returns the input unchanged when length is not 16", () => {
    expect(formatCodeDisplay("ABCD")).toBe("ABCD");
    expect(formatCodeDisplay("")).toBe("");
    expect(formatCodeDisplay("ABCDEFGHJKLMNPQRS")).toBe("ABCDEFGHJKLMNPQRS");
  });

  it("does not throw on non-string inputs (defensive)", () => {
    // @ts-expect-error — intentionally exercising the runtime guard.
    expect(formatCodeDisplay(undefined)).toBe("");
    // @ts-expect-error — intentionally exercising the runtime guard.
    expect(formatCodeDisplay(null)).toBe("");
  });
});

describe("formatRedeemedAt", () => {
  it("formats an ISO-8601 string as a short Spanish date", () => {
    const out = formatRedeemedAt("2026-03-27T15:30:00.000Z", "es");
    // Spanish short month for March is "mar" — strip the trailing period.
    expect(out).toMatch(/^\d{1,2} mar(zo)? 2026$/);
    expect(out).not.toContain(".");
  });

  it("returns an empty string for invalid input", () => {
    expect(formatRedeemedAt("")).toBe("");
    expect(formatRedeemedAt("not-a-date")).toBe("");
  });

  it("supports an override locale", () => {
    const out = formatRedeemedAt("2026-03-27T00:00:00.000Z", "en");
    // English short month is "Mar". Just assert presence — exact format is
    // ICU-implementation-dependent across Node versions.
    expect(out.toLowerCase()).toContain("mar");
    expect(out).toContain("2026");
  });
});

describe("prizeShortDescription", () => {
  it("uses the prize label when present (sports_credit)", () => {
    const prize: Prize = {
      type: "sports_credit",
      amount: 10,
      currency: "USD",
      label: "$10 USD deportivo",
    };
    expect(prizeShortDescription(prize)).toBe("$10 USD deportivo");
  });

  it("falls back to a canonical form when the label is empty (casino_spins)", () => {
    const prize: Prize = {
      type: "casino_spins",
      count: 200,
      game_name: "Clover Super Pot",
      label: "",
    };
    expect(prizeShortDescription(prize)).toBe("200 giros Clover Super Pot");
  });

  it("formats deposit_match with a multiplier fallback", () => {
    const prize: Prize = {
      type: "deposit_match",
      multiplier: 3,
      label: "",
    };
    expect(prizeShortDescription(prize)).toBe("x3 en tu depósito");
  });

  it("returns the label for physical prizes", () => {
    const prize: Prize = {
      type: "physical",
      sku: "T-001",
      label: "Camiseta GanaPlay",
      redemption_instructions: "Retirar en oficina",
    };
    expect(prizeShortDescription(prize)).toBe("Camiseta GanaPlay");
  });

  it("returns the label for external_code prizes", () => {
    const prize: Prize = {
      type: "external_code",
      provider: "PartnerX",
      label: "Cupón Partner",
    };
    expect(prizeShortDescription(prize)).toBe("Cupón Partner");
  });

  it("prefixes the rarity for collectibles", () => {
    const prize: Prize = {
      type: "collectible",
      collectible_id: "card-1",
      label: "Delantero estrella",
      rarity: "rare",
    };
    expect(prizeShortDescription(prize)).toBe("Rara: Delantero estrella");
  });

  it('returns "Sin premio" when none has empty label', () => {
    const prize: Prize = { type: "none", label: "" };
    expect(prizeShortDescription(prize)).toBe("Sin premio");
  });

  it("uses the explicit label of a none prize when provided", () => {
    const prize: Prize = { type: "none", label: "Sigue intentando" };
    expect(prizeShortDescription(prize)).toBe("Sigue intentando");
  });
});

describe("rarityLabel", () => {
  it("maps each rarity to its Spanish label", () => {
    expect(rarityLabel("common")).toBe("Común");
    expect(rarityLabel("rare")).toBe("Rara");
    expect(rarityLabel("epic")).toBe("Épica");
    expect(rarityLabel("legendary")).toBe("Legendaria");
  });
});
