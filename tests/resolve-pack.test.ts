import { describe, it, expect } from "vitest";
import { resolvePack, defaultRng } from "../lib/prizes/resolve";
import { packResultSchema } from "../lib/prizes/schemas";
import {
  PACK_VERSION_CURRENT,
  type Prize,
  type VariablePoolEntry,
} from "../lib/prizes/types";

const guaranteed: Prize[] = [
  { type: "sports_credit", amount: 10, currency: "USD", label: "$10 USD" },
  {
    type: "casino_spins",
    count: 200,
    game_name: "Clover Super Pot",
    label: "200 giros",
  },
  { type: "deposit_match", multiplier: 3, label: "Triplica + giros" },
];

const samplePool: VariablePoolEntry[] = [
  {
    prize: { type: "external_code", provider: "partner-a", label: "Cupón A" },
    weight: 1,
  },
  {
    prize: { type: "external_code", provider: "partner-b", label: "Cupón B" },
    weight: 3,
  },
  { prize: { type: "none", label: "No ganaste" }, weight: 1 },
];

/**
 * Deterministic RNG generator from a fixed array of float ∈ [0,1).
 * Cycles if exhausted (so tests that draw many values still work).
 */
function seqRng(values: number[]): () => number {
  let i = 0;
  return () => {
    if (values.length === 0) return 0;
    const v = values[i % values.length] as number;
    i += 1;
    return v;
  };
}

describe("resolvePack — guaranteed slice", () => {
  it("copies the 3 guaranteed prizes verbatim and in order", () => {
    const res = resolvePack(
      { guaranteed, variable_pool: samplePool, cards_per_pack: 5 },
      seqRng([0.1, 0.9]),
    );
    expect(res.guaranteed).toEqual(guaranteed);
    // Identity preservation per slot
    expect(res.guaranteed[0]).toEqual(guaranteed[0]);
    expect(res.guaranteed[1]).toEqual(guaranteed[1]);
    expect(res.guaranteed[2]).toEqual(guaranteed[2]);
  });
});

describe("resolvePack — variable slice", () => {
  it("returns exactly `cards_per_pack - guaranteed.length` variable cards", () => {
    const res = resolvePack(
      { guaranteed, variable_pool: samplePool, cards_per_pack: 5 },
      seqRng([0.5, 0.5]),
    );
    expect(res.variable).toHaveLength(2);
  });

  it("respects weighted distribution with a deterministic RNG", () => {
    // total weight = 1 + 3 + 1 = 5. Boundaries:
    //   [0.0, 0.2) → entry 0 (cupón A)
    //   [0.2, 0.8) → entry 1 (cupón B)
    //   [0.8, 1.0) → entry 2 (none)
    const res = resolvePack(
      { guaranteed, variable_pool: samplePool, cards_per_pack: 5 },
      seqRng([0.0, 0.85]),
    );
    expect(res.variable[0]).toEqual({
      type: "external_code",
      provider: "partner-a",
      label: "Cupón A",
    });
    expect(res.variable[1]).toEqual({ type: "none", label: "No ganaste" });
  });

  it("never returns an entry whose weight is 0", () => {
    const pool: VariablePoolEntry[] = [
      {
        prize: { type: "external_code", provider: "zero", label: "Zero" },
        weight: 0,
      },
      {
        prize: { type: "external_code", provider: "one", label: "One" },
        weight: 1,
      },
      {
        prize: { type: "external_code", provider: "three", label: "Three" },
        weight: 3,
      },
    ];
    // Sweep many deterministic rolls — never should we get 'zero'.
    const rolls = Array.from({ length: 50 }, (_, i) => i / 50);
    const rng = seqRng(rolls);
    for (let i = 0; i < 50; i++) {
      const res = resolvePack(
        { guaranteed, variable_pool: pool, cards_per_pack: 4 },
        rng,
      );
      for (const card of res.variable) {
        if (card.type === "external_code") {
          expect(card.provider).not.toBe("zero");
        }
      }
    }
  });

  it("falls back to `none` cards when the pool is empty", () => {
    const res = resolvePack(
      { guaranteed, variable_pool: [], cards_per_pack: 5 },
      defaultRng,
    );
    expect(res.variable).toHaveLength(2);
    for (const card of res.variable) {
      expect(card).toEqual({ type: "none", label: "No ganaste" });
    }
  });

  it("falls back to `none` cards when all weights are zero", () => {
    const pool: VariablePoolEntry[] = [
      {
        prize: { type: "external_code", provider: "a", label: "A" },
        weight: 0,
      },
      {
        prize: { type: "external_code", provider: "b", label: "B" },
        weight: 0,
      },
    ];
    const res = resolvePack(
      { guaranteed, variable_pool: pool, cards_per_pack: 5 },
      defaultRng,
    );
    for (const card of res.variable) {
      expect(card).toEqual({ type: "none", label: "No ganaste" });
    }
  });
});

describe("resolvePack — versioning + schema", () => {
  it("returns pack_version='v1'", () => {
    const res = resolvePack(
      { guaranteed, variable_pool: samplePool, cards_per_pack: 5 },
      seqRng([0.1]),
    );
    expect(res.pack_version).toBe(PACK_VERSION_CURRENT);
    expect(res.pack_version).toBe("v1");
  });

  it("returned result validates against packResultSchema", () => {
    const res = resolvePack(
      { guaranteed, variable_pool: samplePool, cards_per_pack: 5 },
      seqRng([0.5, 0.5]),
    );
    expect(packResultSchema.safeParse(res).success).toBe(true);
  });

  it("handles malformed pool entries by falling back to none", () => {
    // Pool with NaN/negative weights and an OK one.
    const pool = [
      { prize: { type: "none", label: "X" }, weight: Number.NaN },
      { prize: { type: "none", label: "Y" }, weight: -1 },
    ] as unknown as VariablePoolEntry[];
    const res = resolvePack(
      { guaranteed, variable_pool: pool, cards_per_pack: 5 },
      defaultRng,
    );
    for (const card of res.variable) {
      expect(card).toEqual({ type: "none", label: "No ganaste" });
    }
  });
});

describe("resolvePack — collectibles pool", () => {
  it("pool with collectibles + none returns only entries from the configured pool", () => {
    const pool: VariablePoolEntry[] = [
      {
        prize: {
          type: "collectible",
          collectible_id: "delantero-estrella",
          label: "Delantero estrella",
          rarity: "common",
        },
        weight: 5,
      },
      {
        prize: {
          type: "collectible",
          collectible_id: "joven-promesa",
          label: "Joven promesa",
          rarity: "epic",
        },
        weight: 1,
      },
      {
        prize: { type: "none", label: "No ganaste" },
        weight: 4,
      },
    ];

    const allowedIds = new Set(["delantero-estrella", "joven-promesa"]);
    const seenTypes = new Set<string>();
    const seenCollectibleIds = new Set<string>();

    // Sweep the [0,1) interval across many rolls so each weighted band is hit.
    const rolls = Array.from({ length: 200 }, (_, i) => i / 200);
    const rng = seqRng(rolls);

    for (let i = 0; i < 200; i++) {
      const res = resolvePack(
        { guaranteed, variable_pool: pool, cards_per_pack: 5 },
        rng,
      );
      expect(res.variable).toHaveLength(2);
      for (const card of res.variable) {
        seenTypes.add(card.type);
        if (card.type === "collectible") {
          // Stays inside the configured pool — never invents an id.
          expect(allowedIds.has(card.collectible_id)).toBe(true);
          seenCollectibleIds.add(card.collectible_id);
        } else {
          // The only non-collectible allowed by this pool is `none`.
          expect(card.type).toBe("none");
        }
      }
    }

    // Both collectible variants AND the none entry must have been drawn
    // at least once across the deterministic sweep.
    expect(seenTypes.has("collectible")).toBe(true);
    expect(seenTypes.has("none")).toBe(true);
    expect(seenCollectibleIds.has("delantero-estrella")).toBe(true);
    expect(seenCollectibleIds.has("joven-promesa")).toBe(true);
  });
});

describe("resolvePack — defaultRng", () => {
  it("default RNG produces floats in [0, 1)", () => {
    for (let i = 0; i < 100; i++) {
      const v = defaultRng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
