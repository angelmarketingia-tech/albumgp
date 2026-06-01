// Unit tests for `lib/album/group.ts`. Pure helper — no DOM, no fetch.

import { describe, it, expect } from "vitest";
import {
  categorizePrize,
  groupAlbumByRarity,
} from "../lib/album/group";
import type { AlbumResponse } from "../lib/album/types";
import type { Prize } from "../lib/prizes/types";

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function makeAlbum(
  redemptions: AlbumResponse["redemptions"],
  overrides: Partial<Pick<AlbumResponse, "total_cards_count" | "unique_collectibles_count">> = {},
): AlbumResponse {
  // Reasonable defaults so individual tests stay short. Callers can override
  // when they need to assert pass-through behaviour.
  const totalDefault = redemptions.reduce((sum, r) => sum + r.prizes.length, 0);
  const uniqueDefault = new Set(
    redemptions.flatMap((r) =>
      r.prizes
        .map((p) => (p.prize.type === "collectible" ? p.prize.collectible_id : null))
        .filter((id): id is string => id !== null),
    ),
  ).size;
  return {
    redemptions,
    total_cards_count: overrides.total_cards_count ?? totalDefault,
    unique_collectibles_count:
      overrides.unique_collectibles_count ?? uniqueDefault,
  };
}

const SPORTS: Prize = {
  type: "sports_credit",
  amount: 10,
  currency: "USD",
  label: "$10 USD",
};
const SPINS: Prize = {
  type: "casino_spins",
  count: 200,
  game_name: "Clover Super Pot",
  label: "200 giros",
};
const MATCH: Prize = {
  type: "deposit_match",
  multiplier: 3,
  label: "3x primer depósito",
};
const PHYSICAL: Prize = {
  type: "physical",
  sku: "MUG-001",
  category: "other",
  label: "Taza GanaPlay",
  redemption_instructions: "Retirar en oficinas",
};
const EXTERNAL: Prize = {
  type: "external_code",
  provider: "Steam",
  label: "Steam $5",
};
const NONE: Prize = { type: "none", label: "No ganaste" };

function collectible(
  id: string,
  rarity: "common" | "rare" | "epic" | "legendary",
  label: string,
  image_url?: string,
): Prize {
  if (image_url !== undefined) {
    return {
      type: "collectible",
      collectible_id: id,
      label,
      rarity,
      image_url,
    };
  }
  return {
    type: "collectible",
    collectible_id: id,
    label,
    rarity,
  };
}

// ----------------------------------------------------------------------------
// categorizePrize
// ----------------------------------------------------------------------------

describe("categorizePrize", () => {
  it("classifies sports_credit as real_prizes", () => {
    expect(categorizePrize(SPORTS)).toBe("real_prizes");
  });

  it("classifies casino_spins as real_prizes", () => {
    expect(categorizePrize(SPINS)).toBe("real_prizes");
  });

  it("classifies deposit_match as real_prizes", () => {
    expect(categorizePrize(MATCH)).toBe("real_prizes");
  });

  it("classifies physical as real_prizes", () => {
    expect(categorizePrize(PHYSICAL)).toBe("real_prizes");
  });

  it("classifies external_code as real_prizes", () => {
    expect(categorizePrize(EXTERNAL)).toBe("real_prizes");
  });

  it("classifies collectible as collectibles regardless of rarity", () => {
    expect(categorizePrize(collectible("c-1", "common", "A"))).toBe(
      "collectibles",
    );
    expect(categorizePrize(collectible("c-2", "legendary", "B"))).toBe(
      "collectibles",
    );
  });

  it("classifies none as empty", () => {
    expect(categorizePrize(NONE)).toBe("empty");
  });
});

// ----------------------------------------------------------------------------
// groupAlbumByRarity
// ----------------------------------------------------------------------------

describe("groupAlbumByRarity", () => {
  it("returns zero counts and four empty buckets for an empty album", () => {
    const album = makeAlbum([], {
      total_cards_count: 0,
      unique_collectibles_count: 0,
    });
    const view = groupAlbumByRarity(album);

    expect(view.real_prizes_count).toBe(0);
    expect(view.empty_count).toBe(0);
    expect(view.total_cards).toBe(0);
    expect(view.unique_collectibles).toBe(0);
    expect(view.collectibles_by_rarity).toEqual({
      legendary: [],
      epic: [],
      rare: [],
      common: [],
    });
  });

  it("counts 3 real prizes + 2 collectibles + 0 none for a single redemption", () => {
    const album = makeAlbum([
      {
        redeemed_at: "2026-03-27T12:00:00.000Z",
        country: "SV",
        prizes: [
          { prize: SPORTS },
          { prize: SPINS },
          { prize: MATCH },
          { prize: collectible("c-1", "rare", "Zulu") },
          { prize: collectible("c-2", "common", "Alpha") },
        ],
      },
    ]);

    const view = groupAlbumByRarity(album);
    expect(view.real_prizes_count).toBe(3);
    expect(view.empty_count).toBe(0);
    expect(view.collectibles_by_rarity.rare).toHaveLength(1);
    expect(view.collectibles_by_rarity.common).toHaveLength(1);
    expect(view.collectibles_by_rarity.epic).toHaveLength(0);
    expect(view.collectibles_by_rarity.legendary).toHaveLength(0);
  });

  it("dedupes the same collectible_id across redemptions and sums count", () => {
    const album = makeAlbum([
      {
        redeemed_at: "2026-03-27T12:00:00.000Z",
        country: "SV",
        prizes: [{ prize: collectible("c-1", "epic", "Fenix") }],
      },
      {
        redeemed_at: "2026-04-01T12:00:00.000Z",
        country: "SV",
        prizes: [{ prize: collectible("c-1", "epic", "Fenix") }],
      },
    ]);

    const view = groupAlbumByRarity(album);
    expect(view.collectibles_by_rarity.epic).toHaveLength(1);
    expect(view.collectibles_by_rarity.epic[0]?.count).toBe(2);
    expect(view.collectibles_by_rarity.epic[0]?.collectible_id).toBe("c-1");
  });

  it("places each rarity in its own bucket when all 4 are present", () => {
    const album = makeAlbum([
      {
        redeemed_at: "2026-03-27T12:00:00.000Z",
        country: "SV",
        prizes: [
          { prize: collectible("c-c", "common", "Común carta") },
          { prize: collectible("c-r", "rare", "Rara carta") },
          { prize: collectible("c-e", "epic", "Épica carta") },
          { prize: collectible("c-l", "legendary", "Legendaria carta") },
        ],
      },
    ]);

    const view = groupAlbumByRarity(album);
    expect(view.collectibles_by_rarity.common).toHaveLength(1);
    expect(view.collectibles_by_rarity.rare).toHaveLength(1);
    expect(view.collectibles_by_rarity.epic).toHaveLength(1);
    expect(view.collectibles_by_rarity.legendary).toHaveLength(1);
    expect(view.collectibles_by_rarity.common[0]?.rarity).toBe("common");
    expect(view.collectibles_by_rarity.legendary[0]?.rarity).toBe("legendary");
  });

  it("preserves image_url when only one redemption defines it", () => {
    const album = makeAlbum([
      {
        redeemed_at: "2026-03-27T12:00:00.000Z",
        country: "SV",
        prizes: [{ prize: collectible("c-1", "rare", "Tigre") }],
      },
      {
        redeemed_at: "2026-04-01T12:00:00.000Z",
        country: "SV",
        prizes: [
          {
            prize: collectible(
              "c-1",
              "rare",
              "Tigre",
              "/img/c-1.png",
            ),
          },
        ],
      },
    ]);

    const view = groupAlbumByRarity(album);
    expect(view.collectibles_by_rarity.rare).toHaveLength(1);
    const slot = view.collectibles_by_rarity.rare[0];
    expect(slot?.count).toBe(2);
    expect(slot?.image_url).toBe("/img/c-1.png");
  });

  it("preserves the first image_url when a later redemption is missing it", () => {
    const album = makeAlbum([
      {
        redeemed_at: "2026-03-27T12:00:00.000Z",
        country: "SV",
        prizes: [
          {
            prize: collectible(
              "c-1",
              "rare",
              "Tigre",
              "/img/c-1.png",
            ),
          },
        ],
      },
      {
        redeemed_at: "2026-04-01T12:00:00.000Z",
        country: "SV",
        prizes: [{ prize: collectible("c-1", "rare", "Tigre") }],
      },
    ]);

    const view = groupAlbumByRarity(album);
    const slot = view.collectibles_by_rarity.rare[0];
    expect(slot?.image_url).toBe("/img/c-1.png");
  });

  it("sorts each rarity bucket alphabetically by label", () => {
    const album = makeAlbum([
      {
        redeemed_at: "2026-03-27T12:00:00.000Z",
        country: "SV",
        prizes: [
          { prize: collectible("z", "rare", "Zorro") },
          { prize: collectible("a", "rare", "Aguila") },
          { prize: collectible("m", "rare", "Mango") },
        ],
      },
    ]);

    const view = groupAlbumByRarity(album);
    expect(view.collectibles_by_rarity.rare.map((s) => s.label)).toEqual([
      "Aguila",
      "Mango",
      "Zorro",
    ]);
  });

  it("counts `none` prizes as empty_count", () => {
    const album = makeAlbum([
      {
        redeemed_at: "2026-03-27T12:00:00.000Z",
        country: "SV",
        prizes: [{ prize: NONE }, { prize: NONE }, { prize: SPORTS }],
      },
    ]);

    const view = groupAlbumByRarity(album);
    expect(view.empty_count).toBe(2);
    expect(view.real_prizes_count).toBe(1);
  });

  it("passes through total_cards and unique_collectibles from the AlbumResponse", () => {
    const album: AlbumResponse = {
      redemptions: [
        {
          redeemed_at: "2026-03-27T12:00:00.000Z",
          country: "SV",
          prizes: [{ prize: SPORTS }],
        },
      ],
      total_cards_count: 42,
      unique_collectibles_count: 7,
    };

    const view = groupAlbumByRarity(album);
    expect(view.total_cards).toBe(42);
    expect(view.unique_collectibles).toBe(7);
  });

  it("aggregates across multiple redemptions with a mix of categories", () => {
    const album = makeAlbum([
      {
        redeemed_at: "2026-03-27T12:00:00.000Z",
        country: "SV",
        prizes: [
          { prize: SPORTS },
          { prize: SPINS },
          { prize: MATCH },
          { prize: collectible("c-1", "legendary", "Astro") },
          { prize: NONE },
        ],
      },
      {
        redeemed_at: "2026-04-01T12:00:00.000Z",
        country: "GT",
        prizes: [
          { prize: SPORTS },
          { prize: PHYSICAL },
          { prize: EXTERNAL },
          { prize: collectible("c-2", "common", "Brisa") },
          { prize: collectible("c-1", "legendary", "Astro") },
        ],
      },
    ]);

    const view = groupAlbumByRarity(album);
    expect(view.real_prizes_count).toBe(6);
    expect(view.empty_count).toBe(1);
    expect(view.collectibles_by_rarity.legendary).toHaveLength(1);
    expect(view.collectibles_by_rarity.legendary[0]?.count).toBe(2);
    expect(view.collectibles_by_rarity.common).toHaveLength(1);
    expect(view.collectibles_by_rarity.common[0]?.count).toBe(1);
  });

  it("always returns the four rarity buckets even when none are populated", () => {
    const album = makeAlbum([
      {
        redeemed_at: "2026-03-27T12:00:00.000Z",
        country: "SV",
        prizes: [{ prize: SPORTS }, { prize: NONE }],
      },
    ]);

    const view = groupAlbumByRarity(album);
    expect(Object.keys(view.collectibles_by_rarity).sort()).toEqual([
      "common",
      "epic",
      "legendary",
      "rare",
    ]);
    expect(view.collectibles_by_rarity.common).toEqual([]);
    expect(view.collectibles_by_rarity.rare).toEqual([]);
    expect(view.collectibles_by_rarity.epic).toEqual([]);
    expect(view.collectibles_by_rarity.legendary).toEqual([]);
  });
});
