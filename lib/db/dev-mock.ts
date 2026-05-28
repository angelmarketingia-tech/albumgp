// In-memory mock of the Prisma client for LOCAL DEV ONLY.
//
// Activated by `DEV_MOCK_DB=1` in `.env.local`. Lets the dev server run
// without a real Postgres. Pre-loads the same seed data as
// `prisma/seed.ts` plus 6 demo codes (3 SV + 3 GT) so the full open →
// redeem → album flow works end-to-end against memory.
//
// SECURITY:
//   - Hard-fails if invoked under `NODE_ENV=production`. We do NOT want a
//     deploy that accidentally serves data from a process-local Map.
//   - Implements only the 5 Prisma methods actually called by the app:
//     code.findUnique, code.updateMany, redemption.create,
//     redemption.findMany, redemption.update.
//   - The seed runs idempotently inside `createDevMockPrisma()`.
//
// LIMITATIONS:
//   - Memory only — restarting `next dev` wipes data EXCEPT the seed
//     (which is re-applied on every cold start).
//   - The `Prisma.JsonNull` predicate used in `/api/open` is treated as a
//     plain `null` check (semantically equivalent for our usage).
//   - No transactions / no concurrency control beyond JS single-thread.

import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  type Prize,
  type VariablePoolEntry,
  type PackResult,
} from "@/lib/prizes/types";

type Country = "SV" | "GT";
type CodeStatus = "active" | "redeemed" | "disabled" | "expired";
type WebhookStatus = "pending" | "sent" | "confirmed" | "failed";

interface MockCode {
  id: string;
  code: string;
  country: Country;
  prizeSetId: string;
  status: CodeStatus;
  packResult: PackResult | null;
  openedAt: Date | null;
  redeemedAt: Date | null;
  redeemedBy: string | null;
  redeemedIp: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

interface MockPrizeSet {
  id: string;
  country: Country;
  guaranteed: Prize[];
  variablePool: VariablePoolEntry[];
  cardsPerPack: number;
  createdAt: Date;
}

interface MockRedemption {
  id: string;
  codeId: string;
  accountId: string;
  result: PackResult;
  webhookStatus: WebhookStatus;
  webhookAttempts: number;
  webhookLastError: string | null;
  createdAt: Date;
}

interface MockJoinedCode extends MockCode {
  prizeSet: MockPrizeSet;
}

const PRIZE_SET_SV_ID = "11111111-1111-4111-8111-111111111111";
const PRIZE_SET_GT_ID = "22222222-2222-4222-8222-222222222222";

const svGuaranteed: Prize[] = [
  {
    type: "sports_credit",
    amount: 10,
    currency: "USD",
    label: "$10 USD para apostar en eventos deportivos",
  },
  {
    type: "casino_spins",
    count: 200,
    game_name: "Clover Super Pot",
    label: "200 giros gratis en Clover Super Pot",
  },
  {
    type: "deposit_match",
    multiplier: 3,
    extras: "giros gratis",
    label: "Triplicamos tu primer depósito + giros gratis",
  },
];

const gtGuaranteed: Prize[] = [
  {
    type: "sports_credit",
    amount: 100,
    currency: "GTQ",
    label: "Q100 para apostar en eventos deportivos",
  },
  {
    type: "casino_spins",
    count: 200,
    game_name: "Super Tiki Strike",
    label: "200 giros gratis en Super Tiki Strike",
  },
  {
    type: "deposit_match",
    multiplier: 3,
    label: "Triplicamos tu primer depósito",
  },
];

// Demo pool: PNG assets generated with Higgsfield Z Image live under
// /public/assets/cartas/. Same pool for SV and GT.
const demoCollectiblesPool: VariablePoolEntry[] = [
  {
    prize: {
      type: "collectible",
      collectible_id: "delantero-estrella",
      label: "Delantero estrella",
      rarity: "common",
      image_url: "/assets/cartas/delantero-estrella.png",
    },
    weight: 5,
  },
  {
    prize: {
      type: "collectible",
      collectible_id: "mediocampo-creativo",
      label: "Mediocampo creativo",
      rarity: "common",
      image_url: "/assets/cartas/mediocampo-creativo.png",
    },
    weight: 5,
  },
  {
    prize: {
      type: "collectible",
      collectible_id: "defensor-de-hierro",
      label: "Defensor de hierro",
      rarity: "common",
      image_url: "/assets/cartas/defensor-de-hierro.png",
    },
    weight: 4,
  },
  {
    prize: {
      type: "collectible",
      collectible_id: "arquero-impasable",
      label: "Arquero impasable",
      rarity: "rare",
      image_url: "/assets/cartas/arquero-impasable.png",
    },
    weight: 3,
  },
  {
    prize: {
      type: "collectible",
      collectible_id: "capitan",
      label: "Capitán",
      rarity: "rare",
      image_url: "/assets/cartas/capitan.png",
    },
    weight: 2,
  },
  {
    prize: {
      type: "collectible",
      collectible_id: "joven-promesa",
      label: "Joven promesa",
      rarity: "epic",
      image_url: "/assets/cartas/joven-promesa.png",
    },
    weight: 1,
  },
  {
    prize: { type: "none", label: "No ganaste" },
    weight: 4,
  },
];

// Demo codes — 3 per country. Format matches the public regex:
//   [A-HJ-NP-Z2-9]{16}
// (Excludes I, O, 0, 1 to avoid visual ambiguity, so "DEMO"/"SV"/"GT" can't
// be used literally. We pick mnemonics that fit the alphabet.)
const DEMO_CODES_SV: ReadonlyArray<string> = [
  "ABCD2345EFGH2345",
  "BCDE3456FGHJ3456",
  "CDEF4567GHJK4567",
];
const DEMO_CODES_GT: ReadonlyArray<string> = [
  "KLMN5678PQRS5678",
  "LMNP6789QRST6789",
  "MNPQ7892RSTU7892",
];

interface DevMockState {
  prizeSets: Map<string, MockPrizeSet>;
  codes: Map<string, MockCode>;          // keyed by `code` value (unique)
  codesById: Map<string, string>;         // id -> code value
  redemptions: Map<string, MockRedemption>;
}

function buildSeededState(): DevMockState {
  const state: DevMockState = {
    prizeSets: new Map(),
    codes: new Map(),
    codesById: new Map(),
    redemptions: new Map(),
  };

  const now = new Date();

  state.prizeSets.set(PRIZE_SET_SV_ID, {
    id: PRIZE_SET_SV_ID,
    country: "SV",
    guaranteed: svGuaranteed,
    variablePool: demoCollectiblesPool,
    cardsPerPack: 5,
    createdAt: now,
  });

  state.prizeSets.set(PRIZE_SET_GT_ID, {
    id: PRIZE_SET_GT_ID,
    country: "GT",
    guaranteed: gtGuaranteed,
    variablePool: demoCollectiblesPool,
    cardsPerPack: 5,
    createdAt: now,
  });

  for (const code of DEMO_CODES_SV) {
    const id = randomUUID();
    state.codes.set(code, {
      id,
      code,
      country: "SV",
      prizeSetId: PRIZE_SET_SV_ID,
      status: "active",
      packResult: null,
      openedAt: null,
      redeemedAt: null,
      redeemedBy: null,
      redeemedIp: null,
      expiresAt: null,
      createdAt: now,
    });
    state.codesById.set(id, code);
  }
  for (const code of DEMO_CODES_GT) {
    const id = randomUUID();
    state.codes.set(code, {
      id,
      code,
      country: "GT",
      prizeSetId: PRIZE_SET_GT_ID,
      status: "active",
      packResult: null,
      openedAt: null,
      redeemedAt: null,
      redeemedBy: null,
      redeemedIp: null,
      expiresAt: null,
      createdAt: now,
    });
    state.codesById.set(id, code);
  }

  return state;
}

// We attach the state to globalThis so HMR doesn't wipe it between
// reloads. The seed is reapplied if the singleton is fresh.
const globalForMock = globalThis as unknown as {
  __albumgpDevMockState?: DevMockState;
};

function getState(): DevMockState {
  if (globalForMock.__albumgpDevMockState === undefined) {
    globalForMock.__albumgpDevMockState = buildSeededState();
    // eslint-disable-next-line no-console
    console.warn(
      "[dev-mock-db] In-memory mock DB initialized. " +
        `Demo codes — SV: ${DEMO_CODES_SV.join(", ")} | GT: ${DEMO_CODES_GT.join(", ")}`,
    );
  }
  return globalForMock.__albumgpDevMockState;
}

// ---------- Query implementations ------------------------------------------

interface CodeFindUniqueArgs {
  where: { code?: string; id?: string };
  include?: { prizeSet?: boolean };
  select?: Record<string, boolean>;
}

interface CodeUpdateManyArgs {
  where: {
    code?: string;
    id?: string;
    status?: CodeStatus;
    packResult?: { equals: unknown };
    OR?: ReadonlyArray<{ expiresAt: null | { gt: Date } }>;
  };
  data: Partial<MockCode>;
}

interface RedemptionCreateArgs {
  data: {
    codeId: string;
    accountId: string;
    result: PackResult;
    webhookStatus?: WebhookStatus;
    webhookAttempts?: number;
  };
  select?: { id?: boolean; createdAt?: boolean };
}

interface RedemptionUpdateArgs {
  where: { id: string };
  data: Partial<MockRedemption>;
}

interface RedemptionFindManyArgs {
  where: { accountId: string };
  orderBy?: { createdAt: "asc" | "desc" };
  include?: { code?: { select?: { country?: boolean } } };
}

function evaluateExpiresAtClause(
  code: MockCode,
  clause: ReadonlyArray<{ expiresAt: null | { gt: Date } }> | undefined,
): boolean {
  if (clause === undefined) return true;
  // OR clause: at least one must match.
  return clause.some((entry) => {
    if (entry.expiresAt === null) {
      return code.expiresAt === null;
    }
    return code.expiresAt !== null && code.expiresAt.getTime() > entry.expiresAt.gt.getTime();
  });
}

interface MockPrismaShape {
  code: {
    findUnique: (args: CodeFindUniqueArgs) => Promise<MockJoinedCode | Partial<MockJoinedCode> | null>;
    updateMany: (args: CodeUpdateManyArgs) => Promise<{ count: number }>;
  };
  redemption: {
    create: (args: RedemptionCreateArgs) => Promise<{ id: string; createdAt: Date }>;
    update: (args: RedemptionUpdateArgs) => Promise<MockRedemption>;
    findMany: (args: RedemptionFindManyArgs) => Promise<
      Array<MockRedemption & { code: { country: Country } }>
    >;
  };
  $disconnect: () => Promise<void>;
}

function buildMockClient(): MockPrismaShape {
  return {
    code: {
      async findUnique(args) {
        const state = getState();
        let row: MockCode | undefined;
        if (args.where.code !== undefined) {
          row = state.codes.get(args.where.code);
        } else if (args.where.id !== undefined) {
          const code = state.codesById.get(args.where.id);
          if (code !== undefined) row = state.codes.get(code);
        }
        if (row === undefined) return null;
        if (args.select !== undefined) {
          const out: Record<string, unknown> = {};
          for (const key of Object.keys(args.select)) {
            if (args.select[key] === true) {
              out[key] = (row as unknown as Record<string, unknown>)[key];
            }
          }
          return out as Partial<MockJoinedCode>;
        }
        if (args.include?.prizeSet === true) {
          const prizeSet = state.prizeSets.get(row.prizeSetId);
          if (prizeSet === undefined) return null;
          return { ...row, prizeSet };
        }
        return row as MockJoinedCode;
      },

      async updateMany(args) {
        const state = getState();
        const where = args.where;
        let target: MockCode | undefined;
        if (where.code !== undefined) {
          target = state.codes.get(where.code);
        } else if (where.id !== undefined) {
          const code = state.codesById.get(where.id);
          if (code !== undefined) target = state.codes.get(code);
        }
        if (target === undefined) return { count: 0 };

        // status predicate
        if (where.status !== undefined && target.status !== where.status) {
          return { count: 0 };
        }
        // pack_result IS NULL predicate (from /api/open)
        if (where.packResult !== undefined && target.packResult !== null) {
          return { count: 0 };
        }
        // expires_at OR-clause (from /api/redeem)
        if (!evaluateExpiresAtClause(target, where.OR)) {
          return { count: 0 };
        }

        // Apply data
        Object.assign(target, args.data);
        return { count: 1 };
      },
    },

    redemption: {
      async create(args) {
        const state = getState();
        const id = randomUUID();
        const createdAt = new Date();
        const row: MockRedemption = {
          id,
          codeId: args.data.codeId,
          accountId: args.data.accountId,
          result: args.data.result,
          webhookStatus: args.data.webhookStatus ?? "pending",
          webhookAttempts: args.data.webhookAttempts ?? 0,
          webhookLastError: null,
          createdAt,
        };
        // Unique constraint on codeId — emulate
        for (const existing of state.redemptions.values()) {
          if (existing.codeId === args.data.codeId) {
            const err = new Error("Unique constraint failed: codeId") as Error & {
              code: string;
            };
            err.code = "P2002";
            throw err;
          }
        }
        state.redemptions.set(id, row);
        return { id, createdAt };
      },

      async update(args) {
        const state = getState();
        const row = state.redemptions.get(args.where.id);
        if (row === undefined) {
          throw new Error(`Redemption not found: ${args.where.id}`);
        }
        Object.assign(row, args.data);
        return row;
      },

      async findMany(args) {
        const state = getState();
        const list: Array<MockRedemption & { code: { country: Country } }> = [];
        for (const row of state.redemptions.values()) {
          if (row.accountId !== args.where.accountId) continue;
          const codeValue = state.codesById.get(row.codeId);
          const codeRow = codeValue !== undefined ? state.codes.get(codeValue) : undefined;
          if (codeRow === undefined) continue;
          list.push({ ...row, code: { country: codeRow.country } });
        }
        // Default order: descending by createdAt (most recent first)
        list.sort((a, b) => {
          const dir = args.orderBy?.createdAt === "asc" ? 1 : -1;
          return (a.createdAt.getTime() - b.createdAt.getTime()) * dir;
        });
        return list;
      },
    },

    async $disconnect() {
      // no-op for mock
    },
  };
}

/**
 * Build a Prisma-shaped mock. Hard-fails in production to ensure no deploy
 * accidentally uses the in-memory store.
 *
 * The return type is cast to `PrismaClient` because emulating Prisma's
 * generated types is intractable. The 5 methods this app actually calls
 * are typed accurately above; everything else throws by absence.
 */
export function createDevMockPrisma(): PrismaClient {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[dev-mock-db] Refusing to instantiate the in-memory mock in production.",
    );
  }
  return buildMockClient() as unknown as PrismaClient;
}

/** Demo codes exposed so the dev server logs them at startup. */
export const DEV_MOCK_DEMO_CODES = {
  SV: DEMO_CODES_SV,
  GT: DEMO_CODES_GT,
} as const;
