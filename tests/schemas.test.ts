import { describe, it, expect } from "vitest";
import {
  prizeSchema,
  packResultSchema,
  variablePoolEntrySchema,
} from "../lib/prizes/schemas";

describe("prizeSchema — sports_credit", () => {
  it("accepts valid USD prize", () => {
    expect(
      prizeSchema.safeParse({
        type: "sports_credit",
        amount: 10,
        currency: "USD",
        label: "$10 USD",
      }).success,
    ).toBe(true);
  });
  it("accepts valid GTQ prize", () => {
    expect(
      prizeSchema.safeParse({
        type: "sports_credit",
        amount: 100,
        currency: "GTQ",
        label: "Q100",
      }).success,
    ).toBe(true);
  });
  it("rejects negative amount", () => {
    expect(
      prizeSchema.safeParse({
        type: "sports_credit",
        amount: -1,
        currency: "USD",
        label: "x",
      }).success,
    ).toBe(false);
  });
  it("rejects unknown currency", () => {
    expect(
      prizeSchema.safeParse({
        type: "sports_credit",
        amount: 10,
        currency: "EUR",
        label: "x",
      }).success,
    ).toBe(false);
  });
});

describe("prizeSchema — casino_spins", () => {
  it("accepts valid spins prize", () => {
    expect(
      prizeSchema.safeParse({
        type: "casino_spins",
        count: 200,
        game_name: "Clover Super Pot",
        label: "200 spins",
      }).success,
    ).toBe(true);
  });
  it("accepts minimal valid", () => {
    expect(
      prizeSchema.safeParse({
        type: "casino_spins",
        count: 1,
        game_name: "x",
        label: "y",
      }).success,
    ).toBe(true);
  });
  it("rejects zero count", () => {
    expect(
      prizeSchema.safeParse({
        type: "casino_spins",
        count: 0,
        game_name: "x",
        label: "y",
      }).success,
    ).toBe(false);
  });
  it("rejects empty game_name", () => {
    expect(
      prizeSchema.safeParse({
        type: "casino_spins",
        count: 10,
        game_name: "",
        label: "y",
      }).success,
    ).toBe(false);
  });
});

describe("prizeSchema — deposit_match", () => {
  it("accepts with extras", () => {
    expect(
      prizeSchema.safeParse({
        type: "deposit_match",
        multiplier: 3,
        extras: "spins",
        label: "3x",
      }).success,
    ).toBe(true);
  });
  it("accepts without extras (optional)", () => {
    expect(
      prizeSchema.safeParse({
        type: "deposit_match",
        multiplier: 2,
        label: "2x",
      }).success,
    ).toBe(true);
  });
  it("rejects zero multiplier", () => {
    expect(
      prizeSchema.safeParse({
        type: "deposit_match",
        multiplier: 0,
        label: "x",
      }).success,
    ).toBe(false);
  });
  it("rejects empty label", () => {
    expect(
      prizeSchema.safeParse({
        type: "deposit_match",
        multiplier: 2,
        label: "",
      }).success,
    ).toBe(false);
  });
});

describe("prizeSchema — physical", () => {
  it("accepts cinema combo", () => {
    expect(
      prizeSchema.safeParse({
        type: "physical",
        sku: "CINEMA_COMBO_1",
        category: "cinema_combo",
        label: "Entrada de cine + combo",
        redemption_instructions: "Presenta el código en taquilla",
      }).success,
    ).toBe(true);
  });
  it("accepts merch", () => {
    expect(
      prizeSchema.safeParse({
        type: "physical",
        sku: "MERCH_JERSEY",
        category: "jersey_local",
        label: "Jersey",
        redemption_instructions: "Envío a domicilio",
      }).success,
    ).toBe(true);
  });
  it("rejects missing sku", () => {
    expect(
      prizeSchema.safeParse({
        type: "physical",
        sku: "",
        category: "other",
        label: "x",
        redemption_instructions: "y",
      }).success,
    ).toBe(false);
  });
  it("rejects missing redemption_instructions", () => {
    expect(
      prizeSchema.safeParse({
        type: "physical",
        sku: "X",
        category: "other",
        label: "x",
      }).success,
    ).toBe(false);
  });
  it("rejects missing category", () => {
    expect(
      prizeSchema.safeParse({
        type: "physical",
        sku: "X",
        label: "x",
        redemption_instructions: "y",
      }).success,
    ).toBe(false);
  });
});

describe("prizeSchema — external_code", () => {
  it("accepts Rappi code", () => {
    expect(
      prizeSchema.safeParse({
        type: "external_code",
        provider: "Rappi",
        label: "Rappi $5",
      }).success,
    ).toBe(true);
  });
  it("accepts arbitrary provider", () => {
    expect(
      prizeSchema.safeParse({
        type: "external_code",
        provider: "Uber",
        label: "Uber credit",
      }).success,
    ).toBe(true);
  });
  it("rejects empty provider", () => {
    expect(
      prizeSchema.safeParse({
        type: "external_code",
        provider: "",
        label: "x",
      }).success,
    ).toBe(false);
  });
  it("rejects missing label", () => {
    expect(
      prizeSchema.safeParse({
        type: "external_code",
        provider: "Rappi",
      }).success,
    ).toBe(false);
  });
});

describe("prizeSchema — collectible", () => {
  it("accepts a common collectible without image_url", () => {
    expect(
      prizeSchema.safeParse({
        type: "collectible",
        collectible_id: "delantero-estrella",
        label: "Delantero estrella",
        rarity: "common",
      }).success,
    ).toBe(true);
  });
  it("accepts a rare collectible", () => {
    expect(
      prizeSchema.safeParse({
        type: "collectible",
        collectible_id: "arquero-impasable",
        label: "Arquero impasable",
        rarity: "rare",
      }).success,
    ).toBe(true);
  });
  it("accepts an epic collectible", () => {
    expect(
      prizeSchema.safeParse({
        type: "collectible",
        collectible_id: "joven-promesa",
        label: "Joven promesa",
        rarity: "epic",
      }).success,
    ).toBe(true);
  });
  it("accepts a legendary collectible with image_url", () => {
    expect(
      prizeSchema.safeParse({
        type: "collectible",
        collectible_id: "leyenda-01",
        label: "Leyenda",
        rarity: "legendary",
        image_url: "https://cdn.example.com/cartas/leyenda-01.png",
      }).success,
    ).toBe(true);
  });
  it("rejects rarity outside the enum", () => {
    expect(
      prizeSchema.safeParse({
        type: "collectible",
        collectible_id: "x",
        label: "x",
        rarity: "mythic",
      }).success,
    ).toBe(false);
  });
  it("rejects collectible_id with a space", () => {
    expect(
      prizeSchema.safeParse({
        type: "collectible",
        collectible_id: "delantero estrella",
        label: "x",
        rarity: "common",
      }).success,
    ).toBe(false);
  });
  it("rejects collectible_id with uppercase characters", () => {
    expect(
      prizeSchema.safeParse({
        type: "collectible",
        collectible_id: "Delantero-Estrella",
        label: "x",
        rarity: "common",
      }).success,
    ).toBe(false);
  });
  it("rejects collectible_id with disallowed punctuation", () => {
    expect(
      prizeSchema.safeParse({
        type: "collectible",
        collectible_id: "delantero_estrella",
        label: "x",
        rarity: "common",
      }).success,
    ).toBe(false);
  });
  it("rejects empty collectible_id", () => {
    expect(
      prizeSchema.safeParse({
        type: "collectible",
        collectible_id: "",
        label: "x",
        rarity: "common",
      }).success,
    ).toBe(false);
  });
  it("rejects empty label", () => {
    expect(
      prizeSchema.safeParse({
        type: "collectible",
        collectible_id: "ok-id",
        label: "",
        rarity: "common",
      }).success,
    ).toBe(false);
  });
  it("rejects image_url that is not a URL", () => {
    expect(
      prizeSchema.safeParse({
        type: "collectible",
        collectible_id: "ok-id",
        label: "ok",
        rarity: "common",
        image_url: "not-a-url",
      }).success,
    ).toBe(false);
  });
});

describe("prizeSchema — none", () => {
  it("accepts No ganaste", () => {
    expect(
      prizeSchema.safeParse({ type: "none", label: "No ganaste" }).success,
    ).toBe(true);
  });
  it("accepts alternate label", () => {
    expect(
      prizeSchema.safeParse({ type: "none", label: "Sigue intentando" }).success,
    ).toBe(true);
  });
  it("rejects missing label", () => {
    expect(prizeSchema.safeParse({ type: "none" }).success).toBe(false);
  });
  it("rejects unknown type discriminator", () => {
    expect(
      prizeSchema.safeParse({ type: "mystery", label: "x" }).success,
    ).toBe(false);
  });
});

describe("variablePoolEntrySchema", () => {
  it("accepts valid entry", () => {
    expect(
      variablePoolEntrySchema.safeParse({
        prize: { type: "none", label: "No ganaste" },
        weight: 1,
      }).success,
    ).toBe(true);
  });
  it("rejects negative weight", () => {
    expect(
      variablePoolEntrySchema.safeParse({
        prize: { type: "none", label: "x" },
        weight: -1,
      }).success,
    ).toBe(false);
  });
});

describe("packResultSchema", () => {
  it("accepts a full pack", () => {
    const ok = packResultSchema.safeParse({
      guaranteed: [
        {
          type: "sports_credit",
          amount: 10,
          currency: "USD",
          label: "$10",
        },
        { type: "casino_spins", count: 200, game_name: "g", label: "200" },
        { type: "deposit_match", multiplier: 3, label: "3x" },
      ],
      variable: [
        { type: "none", label: "No ganaste" },
        { type: "external_code", provider: "Rappi", label: "Rappi" },
      ],
      pack_version: "v1",
    });
    expect(ok.success).toBe(true);
  });
  it("rejects missing pack_version", () => {
    expect(
      packResultSchema.safeParse({
        guaranteed: [],
        variable: [],
      }).success,
    ).toBe(false);
  });
});
