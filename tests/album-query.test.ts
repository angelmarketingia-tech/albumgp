// Unit tests for `lib/album/query.ts`.
//
// We mock `redemption.findMany` directly via a `vi.fn()` passed as the
// Prisma-like client. No DB, no Auth.js — just the shaping logic.
//
// Coverage:
//   - empty input → empty response with zero counters
//   - single happy-path redemption (5 prizes: 3 guaranteed + 2 variable)
//   - multiple redemptions preserve the findMany order (desc by createdAt)
//   - corrupt `result` JSON is skipped, valid rows remain
//   - `unique_collectibles_count` deduplicates by `collectible_id` across rows
//   - `total_cards_count` counts EVERY card incl. duplicates and `none`
//   - empty string accountId is forwarded as-is (validation is the caller's job)

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getAlbumForAccount, type AlbumPrismaClient } from "../lib/album/query";

// ----------------------------------------------------------------------------
// Helpers / fixtures
// ----------------------------------------------------------------------------

const PACK_SV = {
  guaranteed: [
    { type: "sports_credit", amount: 10, currency: "USD", label: "$10 USD" },
    {
      type: "casino_spins",
      count: 200,
      game_name: "Clover Super Pot",
      label: "200 giros",
    },
    { type: "deposit_match", multiplier: 3, label: "3x primer depósito" },
  ],
  variable: [
    { type: "none", label: "No ganaste" },
    { type: "none", label: "No ganaste" },
  ],
  pack_version: "v1",
};

const PACK_GT_WITH_COLLECTIBLE = {
  guaranteed: [
    { type: "sports_credit", amount: 100, currency: "GTQ", label: "Q100" },
    {
      type: "casino_spins",
      count: 200,
      game_name: "Super Tiki Strike",
      label: "200 giros",
    },
    { type: "deposit_match", multiplier: 3, label: "3x primer depósito" },
  ],
  variable: [
    {
      type: "collectible",
      collectible_id: "messi-2026",
      label: "Messi 2026",
      rarity: "rare",
    },
    { type: "none", label: "No ganaste" },
  ],
  pack_version: "v1",
};

const PACK_GT_SAME_COLLECTIBLE = {
  guaranteed: [
    { type: "sports_credit", amount: 100, currency: "GTQ", label: "Q100" },
    {
      type: "casino_spins",
      count: 200,
      game_name: "Super Tiki Strike",
      label: "200 giros",
    },
    { type: "deposit_match", multiplier: 3, label: "3x primer depósito" },
  ],
  variable: [
    {
      type: "collectible",
      collectible_id: "messi-2026", // SAME id as previous row → must dedupe
      label: "Messi 2026",
      rarity: "rare",
    },
    {
      type: "collectible",
      collectible_id: "neymar-2026", // NEW id → distinct count++
      label: "Neymar 2026",
      rarity: "common",
    },
  ],
  pack_version: "v1",
};

interface Row {
  id: string;
  result: unknown;
  createdAt: Date;
  code: { country: "SV" | "GT" };
}

function makePrismaMock(rows: Row[]): {
  prisma: AlbumPrismaClient;
  findMany: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn().mockResolvedValue(rows);
  const prisma: AlbumPrismaClient = {
    redemption: {
      findMany: findMany as unknown as AlbumPrismaClient["redemption"]["findMany"],
    },
  };
  return { prisma, findMany };
}

let warnSpy: ReturnType<typeof vi.spyOn>;
let warnLines: string[];

beforeEach(() => {
  warnLines = [];
  warnSpy = vi
    .spyOn(console, "warn")
    .mockImplementation((...args: unknown[]) => {
      warnLines.push(
        args
          .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
          .join(" "),
      );
    });
});

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe("getAlbumForAccount — basic shape", () => {
  it("returns empty response when the user has no redemptions", async () => {
    const { prisma, findMany } = makePrismaMock([]);
    const out = await getAlbumForAccount(prisma, "mock:abcd0123abcd0123");
    expect(out).toEqual({
      redemptions: [],
      unique_collectibles_count: 0,
      total_cards_count: 0,
    });
    expect(findMany).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("forwards `where.accountId` (and orderBy desc) to Prisma", async () => {
    const { prisma, findMany } = makePrismaMock([]);
    await getAlbumForAccount(prisma, "mock:ffff1111ffff1111");
    expect(findMany).toHaveBeenCalledTimes(1);
    const call = findMany.mock.calls[0]?.[0] as {
      where: { accountId: string };
      orderBy: { createdAt: "desc" };
      select: {
        id: true;
        result: true;
        createdAt: true;
        code: { select: { country: true } };
      };
    };
    expect(call.where.accountId).toBe("mock:ffff1111ffff1111");
    expect(call.orderBy).toEqual({ createdAt: "desc" });
    // Column projection: only the fields the shaper reads, plus the country join.
    expect(call.select).toEqual({
      id: true,
      result: true,
      createdAt: true,
      code: { select: { country: true } },
    });
    warnSpy.mockRestore();
  });

  it("does NOT validate the accountId itself (empty string passes through)", async () => {
    const { prisma, findMany } = makePrismaMock([]);
    const out = await getAlbumForAccount(prisma, "");
    expect(out.redemptions).toEqual([]);
    // Empty string still hits the DB layer (validation lives in requireAccountId).
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { accountId: "" } }),
    );
    warnSpy.mockRestore();
  });
});

describe("getAlbumForAccount — single redemption", () => {
  it("flattens guaranteed + variable into 5 AlbumPrize entries", async () => {
    const createdAt = new Date("2026-05-28T12:34:56.000Z");
    const { prisma } = makePrismaMock([
      {
        id: "r-1",
        result: PACK_SV,
        createdAt,
        code: { country: "SV" },
      },
    ]);

    const out = await getAlbumForAccount(prisma, "mock:aaaa1111aaaa1111");
    expect(out.redemptions).toHaveLength(1);
    const r0 = out.redemptions[0];
    expect(r0?.country).toBe("SV");
    expect(r0?.redeemed_at).toBe("2026-05-28T12:34:56.000Z");
    expect(r0?.prizes).toHaveLength(5);
    // Order: 3 guaranteed first, then 2 variable.
    expect(r0?.prizes[0]?.prize.type).toBe("sports_credit");
    expect(r0?.prizes[1]?.prize.type).toBe("casino_spins");
    expect(r0?.prizes[2]?.prize.type).toBe("deposit_match");
    expect(r0?.prizes[3]?.prize.type).toBe("none");
    expect(r0?.prizes[4]?.prize.type).toBe("none");

    expect(out.total_cards_count).toBe(5);
    expect(out.unique_collectibles_count).toBe(0);
    warnSpy.mockRestore();
  });

  it("preserves the exact Prize shape in the AlbumPrize wrapper", async () => {
    const { prisma } = makePrismaMock([
      {
        id: "r-1",
        result: PACK_GT_WITH_COLLECTIBLE,
        createdAt: new Date("2026-05-28T00:00:00.000Z"),
        code: { country: "GT" },
      },
    ]);
    const out = await getAlbumForAccount(prisma, "mock:bbbb2222bbbb2222");
    const collectible = out.redemptions[0]?.prizes[3]?.prize;
    expect(collectible).toEqual({
      type: "collectible",
      collectible_id: "messi-2026",
      label: "Messi 2026",
      rarity: "rare",
    });
    warnSpy.mockRestore();
  });
});

describe("getAlbumForAccount — multiple redemptions", () => {
  it("preserves the order returned by findMany (most recent first)", async () => {
    // Mock returns rows in the desired order — the query passes
    // orderBy:'desc' to Prisma, so we hand it pre-sorted data and verify the
    // function doesn't re-sort or reverse it.
    const newer = new Date("2026-05-28T10:00:00.000Z");
    const older = new Date("2026-04-01T08:00:00.000Z");
    const { prisma } = makePrismaMock([
      {
        id: "r-newer",
        result: PACK_GT_WITH_COLLECTIBLE,
        createdAt: newer,
        code: { country: "GT" },
      },
      {
        id: "r-older",
        result: PACK_SV,
        createdAt: older,
        code: { country: "SV" },
      },
    ]);

    const out = await getAlbumForAccount(prisma, "mock:cccc3333cccc3333");
    expect(out.redemptions).toHaveLength(2);
    expect(out.redemptions[0]?.redeemed_at).toBe("2026-05-28T10:00:00.000Z");
    expect(out.redemptions[0]?.country).toBe("GT");
    expect(out.redemptions[1]?.redeemed_at).toBe("2026-04-01T08:00:00.000Z");
    expect(out.redemptions[1]?.country).toBe("SV");
    warnSpy.mockRestore();
  });

  it("total_cards_count sums prizes across ALL redemptions (incl. none)", async () => {
    const { prisma } = makePrismaMock([
      {
        id: "r-1",
        result: PACK_SV,
        createdAt: new Date("2026-05-28T10:00:00.000Z"),
        code: { country: "SV" },
      },
      {
        id: "r-2",
        result: PACK_GT_WITH_COLLECTIBLE,
        createdAt: new Date("2026-05-27T10:00:00.000Z"),
        code: { country: "GT" },
      },
      {
        id: "r-3",
        result: PACK_GT_SAME_COLLECTIBLE,
        createdAt: new Date("2026-05-26T10:00:00.000Z"),
        code: { country: "GT" },
      },
    ]);
    const out = await getAlbumForAccount(prisma, "mock:dddd4444dddd4444");
    // 3 redemptions × 5 cards = 15.
    expect(out.total_cards_count).toBe(15);
    warnSpy.mockRestore();
  });

  it("unique_collectibles_count dedupes by collectible_id across redemptions", async () => {
    const { prisma } = makePrismaMock([
      {
        id: "r-1",
        result: PACK_SV, // no collectibles
        createdAt: new Date("2026-05-28T10:00:00.000Z"),
        code: { country: "SV" },
      },
      {
        id: "r-2",
        result: PACK_GT_WITH_COLLECTIBLE, // messi-2026
        createdAt: new Date("2026-05-27T10:00:00.000Z"),
        code: { country: "GT" },
      },
      {
        id: "r-3",
        // messi-2026 (DUPLICATE) + neymar-2026 (NEW)
        result: PACK_GT_SAME_COLLECTIBLE,
        createdAt: new Date("2026-05-26T10:00:00.000Z"),
        code: { country: "GT" },
      },
    ]);
    const out = await getAlbumForAccount(prisma, "mock:eeee5555eeee5555");
    // 2 unique collectible_ids: messi-2026 and neymar-2026.
    expect(out.unique_collectibles_count).toBe(2);
    warnSpy.mockRestore();
  });
});

describe("getAlbumForAccount — corrupt rows", () => {
  it("skips a row whose `result` does not match packResultSchema and logs a warn", async () => {
    const { prisma } = makePrismaMock([
      {
        id: "r-good",
        result: PACK_SV,
        createdAt: new Date("2026-05-28T10:00:00.000Z"),
        code: { country: "SV" },
      },
      {
        id: "r-corrupt",
        result: { totally: "wrong shape" },
        createdAt: new Date("2026-05-27T10:00:00.000Z"),
        code: { country: "SV" },
      },
      {
        id: "r-good-2",
        result: PACK_GT_WITH_COLLECTIBLE,
        createdAt: new Date("2026-05-26T10:00:00.000Z"),
        code: { country: "GT" },
      },
    ]);
    const out = await getAlbumForAccount(prisma, "mock:ffff6666ffff6666");
    expect(out.redemptions).toHaveLength(2);
    expect(out.redemptions.map((r) => r.country)).toEqual(["SV", "GT"]);
    expect(out.total_cards_count).toBe(10);
    expect(out.unique_collectibles_count).toBe(1);

    expect(warnLines.join("\n")).toContain("album.row_skipped_pack_invalid");
    expect(warnLines.join("\n")).toContain("r-corrupt");
    warnSpy.mockRestore();
  });

  it("ALL rows corrupt → empty response, no throw", async () => {
    const { prisma } = makePrismaMock([
      {
        id: "r-bad-1",
        result: null,
        createdAt: new Date("2026-05-28T10:00:00.000Z"),
        code: { country: "SV" },
      },
      {
        id: "r-bad-2",
        result: { random: "junk" },
        createdAt: new Date("2026-05-27T10:00:00.000Z"),
        code: { country: "SV" },
      },
    ]);
    const out = await getAlbumForAccount(prisma, "mock:gggg7777gggg7777");
    expect(out).toEqual({
      redemptions: [],
      unique_collectibles_count: 0,
      total_cards_count: 0,
    });
    warnSpy.mockRestore();
  });

  it("propagates an infrastructure error from findMany (NOT swallowed)", async () => {
    const findMany = vi
      .fn()
      .mockRejectedValueOnce(new Error("pg-down"));
    const prisma: AlbumPrismaClient = {
      redemption: {
        findMany: findMany as unknown as AlbumPrismaClient["redemption"]["findMany"],
      },
    };
    await expect(
      getAlbumForAccount(prisma, "mock:hhhh8888hhhh8888"),
    ).rejects.toThrow("pg-down");
    warnSpy.mockRestore();
  });
});
