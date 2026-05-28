// Domain types for the `/api/album` response.
//
// The "album" is the per-user list of historical redemptions. Each item is a
// snapshot of the 5 cards delivered when the user redeemed a code (frozen at
// canje time; never re-aleatorizes — see AGENTS.md §3, §11).
//
// SECURITY (AGENTS.md §8, SECURITY.md §5):
//   - This shape is what the CLIENT sees. It MUST NOT carry: internal
//     `code_id`, `redemption.id`, plaintext `code`, `account_id`,
//     `webhook_status`/`webhook_attempts`, `redeemed_ip`, etc. Only what the
//     album UI needs to render is exposed.
//   - `prize` is the same `Prize` discriminated union the rest of the domain
//     uses (`lib/prizes/types.ts`) — its fields are safe by construction (they
//     are persisted snapshots of what the resolver produced).

import type { Prize } from "@/lib/prizes/types";

/**
 * One card slot inside a historical redemption. We wrap the `Prize` in an
 * object (instead of inlining) so the shape stays forward-compatible — future
 * per-card metadata (e.g. a `obtained_at` for staggered animations) can be
 * added without renaming the field.
 */
export interface AlbumPrize {
  /** Snapshot of the Prize delivered at redemption time. */
  prize: Prize;
}

export interface AlbumRedemption {
  /** ISO-8601 timestamp of the canje. Used to sort and to render the date. */
  redeemed_at: string;
  /** Country of the code redeemed — drives currency / labels in the UI. */
  country: "SV" | "GT";
  /**
   * The 5 cards as they were delivered (immutable snapshot).
   * Order matches the persisted `pack_result` — guaranteed first, then
   * variable. UIs that want a different order must reorder client-side.
   */
  prizes: AlbumPrize[];
}

export interface AlbumResponse {
  /** Ordered by redemption date, most recent first. */
  redemptions: AlbumRedemption[];
  /**
   * Unique collectible cards owned across ALL redemptions.
   * Deduplicated by `Prize.collectible_id`. Only `type='collectible'` cards
   * contribute — `none`, monetary prizes, etc. do not count here.
   */
  unique_collectibles_count: number;
  /**
   * Grand total of cards across ALL redemptions (including duplicates and
   * including `none`). Equals `Σ redemption.prizes.length`.
   */
  total_cards_count: number;
}
