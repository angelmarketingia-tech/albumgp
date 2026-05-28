// Server-only — `lib/album/query.ts`
//
// Pure data-access for the album endpoint. Takes a Prisma client + an
// `account_id` and returns the shape the wire endpoint serializes.
//
// AGENTS.md §6, §11; SECURITY.md §5.
//
// Design notes:
//   - The function NEVER throws on a single corrupt row. It logs and skips
//     that row, so one bad redemption can't take down the whole album for a
//     user. Hard infra failures (e.g. DB down) DO propagate; the caller maps
//     them to 500.
//   - Country comes from the related `Code` row via `include: { code: ... }`.
//     We deliberately do NOT denormalize country onto `Redemption`: codes are
//     the source of truth and Prisma's join is cheap on the `account_id` index.
//   - Prizes are flattened (guaranteed + variable) into one ordered array.
//     The album UI does not care about the guaranteed/variable distinction.
//   - `unique_collectibles_count` only counts cards with
//     `prize.type === 'collectible'`. Monetary prizes, "none", etc. do not
//     contribute.

import type { PrismaClient } from "@prisma/client";
import { packResultSchema } from "@/lib/prizes/schemas";
import type { Prize } from "@/lib/prizes/types";
import type {
  AlbumPrize,
  AlbumRedemption,
  AlbumResponse,
} from "./types";

function logWarn(event: string, fields: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.warn(JSON.stringify({ level: "warn", event, ...fields }));
}

/**
 * Subset of `PrismaClient` used by `getAlbumForAccount`. Declaring this
 * explicitly lets tests pass a minimal mock without having to satisfy the
 * full Prisma type.
 */
export interface AlbumPrismaClient {
  redemption: {
    findMany: PrismaClient["redemption"]["findMany"];
  };
}

/**
 * Fetch + shape the album for a single account.
 *
 * @param prisma     a Prisma client (or any object exposing the same
 *                   `redemption.findMany` signature).
 * @param accountId  opaque account identifier from the IdentityProvider.
 *                   We do NOT validate it here — that's the caller's job
 *                   (typically `requireAccountId`).
 *
 * @returns the assembled `AlbumResponse`. May be empty (`redemptions: []`).
 */
export async function getAlbumForAccount(
  prisma: AlbumPrismaClient,
  accountId: string,
): Promise<AlbumResponse> {
  const rows = await prisma.redemption.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    include: {
      code: { select: { country: true } },
    },
  });

  const redemptions: AlbumRedemption[] = [];
  let totalCards = 0;
  const uniqueCollectibleIds = new Set<string>();

  for (const row of rows) {
    // `result` is `Prisma.JsonValue`. Validate defensively — a row whose JSON
    // doesn't match `packResultSchema` is corrupt audit data and we skip it
    // rather than 500 the whole album.
    const parsed = packResultSchema.safeParse(row.result);
    if (!parsed.success) {
      logWarn("album.row_skipped_pack_invalid", {
        account_id: accountId,
        redemption_id: row.id,
      });
      continue;
    }

    const pack = parsed.data;
    const allPrizes: Prize[] = [...pack.guaranteed, ...pack.variable];
    const prizes: AlbumPrize[] = allPrizes.map((prize) => ({ prize }));

    totalCards += prizes.length;
    for (const prize of allPrizes) {
      if (prize.type === "collectible") {
        uniqueCollectibleIds.add(prize.collectible_id);
      }
    }

    redemptions.push({
      redeemed_at: row.createdAt.toISOString(),
      country: row.code.country,
      prizes,
    });
  }

  return {
    redemptions,
    unique_collectibles_count: uniqueCollectibleIds.size,
    total_cards_count: totalCards,
  };
}
