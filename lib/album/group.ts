// Pure helper that reshapes the flat `AlbumResponse` into a view model the
// `/album` page can render directly: a real-prize counter, four rarity
// buckets of deduplicated collectibles, and a "sin premio" counter.
//
// SAFE TO IMPORT FROM SERVER AND CLIENT: no I/O, no env, no Prisma. Just
// `AlbumResponse -> AlbumGroupedView`.
//
// Design notes:
//   - Works off the `Prize` discriminated union (lib/prizes/types.ts) so any
//     new prize type lights up the exhaustive switch at compile time.
//   - Collectibles are deduplicated by `collectible_id`. The first occurrence
//     wins for `label` / `rarity`; `image_url` is preferred from the first
//     redemption that defines it (any subsequent value is ignored, but a
//     `defined > undefined` upgrade is allowed so a later redemption can fill
//     in an asset that the earlier one was missing).
//   - The four rarity buckets always exist (even when empty) so the caller
//     can iterate without optional-chaining.
//   - Within each bucket, slots are sorted alphabetically by label using
//     `localeCompare` with the Spanish locale for stable ordering of accents.

import type { AlbumResponse } from "./types";
import type { CollectiblePrize, Prize } from "@/lib/prizes/types";

export type AlbumCategory =
  | "real_prizes" // sports_credit | casino_spins | deposit_match | physical | external_code
  | "collectibles" // collectible (any rarity)
  | "empty"; // none

export interface CollectibleSlot {
  collectible_id: string;
  label: string;
  rarity: CollectiblePrize["rarity"];
  /** How many times this collectible was awarded across all redemptions. */
  count: number;
  /**
   * Optional asset URL. Preserved from the first redemption that defined it
   * — so a collectible that ships an image in only one of its appearances
   * still renders with the image in the album view.
   */
  image_url?: string;
}

export interface AlbumGroupedView {
  /** Count of real (redeemable) prizes obtained — not collectibles, not "none". */
  real_prizes_count: number;
  /** Collectibles deduplicated by `collectible_id`, grouped by rarity. */
  collectibles_by_rarity: {
    legendary: CollectibleSlot[];
    epic: CollectibleSlot[];
    rare: CollectibleSlot[];
    common: CollectibleSlot[];
  };
  /** Count of `type: "none"` cards across all redemptions. */
  empty_count: number;
  /** Pass-through of `AlbumResponse.total_cards_count`. */
  total_cards: number;
  /** Pass-through of `AlbumResponse.unique_collectibles_count`. */
  unique_collectibles: number;
}

/**
 * Classify a `Prize` into the three high-level buckets used by the album UI.
 * Exported separately so callers (e.g. unit tests, future filters) can reason
 * about a single prize without recomputing the full view.
 */
export function categorizePrize(prize: Prize): AlbumCategory {
  switch (prize.type) {
    case "collectible":
      return "collectibles";
    case "none":
      return "empty";
    case "sports_credit":
    case "casino_spins":
    case "deposit_match":
    case "physical":
    case "external_code":
      return "real_prizes";
    default: {
      // Exhaustiveness guard — a new PrizeType lights up here at compile time.
      const _exhaustive: never = prize;
      void _exhaustive;
      return "real_prizes";
    }
  }
}

function emptyBuckets(): AlbumGroupedView["collectibles_by_rarity"] {
  return {
    legendary: [],
    epic: [],
    rare: [],
    common: [],
  };
}

export function groupAlbumByRarity(album: AlbumResponse): AlbumGroupedView {
  let realPrizesCount = 0;
  let emptyCount = 0;

  // Accumulate collectibles by id first; bucket + sort at the end so we don't
  // resort on every increment.
  const byId = new Map<string, CollectibleSlot>();

  for (const redemption of album.redemptions) {
    for (const item of redemption.prizes) {
      const prize = item.prize;
      const category = categorizePrize(prize);

      if (category === "real_prizes") {
        realPrizesCount += 1;
        continue;
      }
      if (category === "empty") {
        emptyCount += 1;
        continue;
      }

      // category === "collectibles" — narrow the union for `collectible_id`.
      if (prize.type !== "collectible") {
        continue;
      }
      const existing = byId.get(prize.collectible_id);
      if (existing === undefined) {
        const slot: CollectibleSlot = {
          collectible_id: prize.collectible_id,
          label: prize.label,
          rarity: prize.rarity,
          count: 1,
        };
        if (prize.image_url !== undefined) {
          slot.image_url = prize.image_url;
        }
        byId.set(prize.collectible_id, slot);
      } else {
        existing.count += 1;
        // Upgrade `undefined -> defined`. We never overwrite an already-set
        // URL — first defined wins, downstream values are ignored.
        if (existing.image_url === undefined && prize.image_url !== undefined) {
          existing.image_url = prize.image_url;
        }
      }
    }
  }

  const buckets = emptyBuckets();
  for (const slot of byId.values()) {
    buckets[slot.rarity].push(slot);
  }

  const sortByLabel = (a: CollectibleSlot, b: CollectibleSlot): number =>
    a.label.localeCompare(b.label, "es", { sensitivity: "base" });

  buckets.legendary.sort(sortByLabel);
  buckets.epic.sort(sortByLabel);
  buckets.rare.sort(sortByLabel);
  buckets.common.sort(sortByLabel);

  return {
    real_prizes_count: realPrizesCount,
    collectibles_by_rarity: buckets,
    empty_count: emptyCount,
    total_cards: album.total_cards_count,
    unique_collectibles: album.unique_collectibles_count,
  };
}
