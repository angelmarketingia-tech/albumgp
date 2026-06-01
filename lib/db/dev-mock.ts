// In-memory mock of the Prisma client for LOCAL DEV ONLY.
//
// Activated by `DEV_MOCK_DB=1` in `.env.local`. Lets the dev server run
// without a real Postgres. Pre-loads 8 prize_sets (4 tiers × 2 países) +
// 8 demo codes (1 por tier-país) para testear el flow completo open →
// redeem → album contra memoria.
//
// SECURITY:
//   - Hard-fails if invoked under `NODE_ENV=production`.
//   - Implements only the 5 Prisma methods actually called by the app.
//   - El seed corre idempotente desde `createDevMockPrisma()`.
//
// LIMITATIONS:
//   - Memory only — restarting `next dev` wipes data EXCEPT the seed.
//   - El predicado `Prisma.JsonNull` se trata como `null` plano.

import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  type EnvelopeTier,
  type PackResult,
  type Prize,
  type VariablePoolEntry,
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
  tier: EnvelopeTier;
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

// ---------- Catálogo (espejo reducido de prisma/seed.ts) ---------------------
//
// No importamos directamente del seed para evitar acoplar el ciclo de vida del
// proceso del dev-server al de Prisma. Mantenemos espejos minimalistas — si el
// seed canónico cambia, actualizar acá también.

const collectible = (
  id: string,
  label: string,
  rarity: "common" | "rare" | "epic" | "legendary",
  img: string,
): Prize => ({
  type: "collectible",
  collectible_id: id,
  label,
  rarity,
  image_url: `/assets/cartas/${img}`,
});

const NONE: Prize = { type: "none", label: "No ganaste" };

const basePool: VariablePoolEntry[] = [
  { prize: collectible("delantero-estrella", "Delantero estrella", "common", "delantero-estrella.png"), weight: 5 },
  { prize: collectible("mediocampo-creativo", "Mediocampo creativo", "common", "mediocampo-creativo.png"), weight: 5 },
  { prize: collectible("defensor-de-hierro", "Defensor de hierro", "common", "defensor-de-hierro.png"), weight: 4 },
  { prize: collectible("arquero-impasable", "Arquero impasable", "rare", "arquero-impasable.png"), weight: 3 },
  { prize: collectible("capitan", "Capitán", "rare", "capitan.png"), weight: 2 },
  { prize: collectible("joven-promesa", "Joven promesa", "epic", "joven-promesa.png"), weight: 1 },
  { prize: NONE, weight: 4 },
];

// Garantizados — iguales en TODOS los tiers porque son el bono de bienvenida
// estándar de GanaPlay ($10 USD / 200 giros / 3× depósito + giros gratis).
// Lo que diferencia los tiers es el variablePool (premios físicos + cartas).
// Decisión 2026-05-29.
const guaranteedFor = (country: Country, _tier: EnvelopeTier): Prize[] => {
  void _tier;
  const isSV = country === "SV";
  const currency = isSV ? "USD" : "GTQ";
  const symbol = isSV ? "$" : "Q";
  const bet = isSV ? 10 : 100;
  const game = isSV ? "Clover Super Pot" : "Super Tiki Strike";
  return [
    {
      type: "sports_credit",
      amount: bet,
      currency,
      label: `${symbol}${bet} ${currency} en free bets`,
    },
    {
      type: "casino_spins",
      count: 200,
      game_name: game,
      label: `200 giros gratis en ${game}`,
    },
    {
      type: "deposit_match",
      multiplier: 3,
      extras: "giros gratis",
      label: "3× tu primer depósito + giros gratis",
    },
  ];
};

const PRIZE_SET_IDS = {
  SV: {
    bronce:  "11111111-1111-4111-8111-111111111101",
    plata:   "11111111-1111-4111-8111-111111111102",
    oro:     "11111111-1111-4111-8111-111111111103",
    platino: "11111111-1111-4111-8111-111111111104",
  },
  GT: {
    bronce:  "22222222-2222-4222-8222-222222222201",
    plata:   "22222222-2222-4222-8222-222222222202",
    oro:     "22222222-2222-4222-8222-222222222203",
    platino: "22222222-2222-4222-8222-222222222204",
  },
} as const;

// Compat: alias del set "default" SV original (`...111`) — algunos tests
// importan por este UUID viejo y esperan resolución no-nula.
const LEGACY_SV_PRIZE_SET = "11111111-1111-4111-8111-111111111111";
const LEGACY_GT_PRIZE_SET = "22222222-2222-4222-8222-222222222222";

// Demo codes — 1 por tier-país. Formato [A-HJ-NP-Z2-9]{16}.
// Excluye I, O, 0, 1 (ambigüedad visual). NO usar `O` ni `I`.
const DEMO_CODES: ReadonlyArray<{
  code: string;
  country: Country;
  tier: EnvelopeTier;
}> = [
  { code: "BRSV2345BRSV2345", country: "SV", tier: "bronce" },
  { code: "PLSV3456PLSV3456", country: "SV", tier: "plata" },
  { code: "URSV4567URSV4567", country: "SV", tier: "oro" },
  { code: "PTSV5678PTSV5678", country: "SV", tier: "platino" },
  { code: "BRGT2345BRGT2345", country: "GT", tier: "bronce" },
  { code: "PLGT3456PLGT3456", country: "GT", tier: "plata" },
  { code: "URGT4567URGT4567", country: "GT", tier: "oro" },
  { code: "PTGT5678PTGT5678", country: "GT", tier: "platino" },
];

interface DevMockState {
  prizeSets: Map<string, MockPrizeSet>;
  codes: Map<string, MockCode>;
  codesById: Map<string, string>;
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
  const tiers: EnvelopeTier[] = ["bronce", "plata", "oro", "platino"];

  for (const country of ["SV", "GT"] as const) {
    for (const tier of tiers) {
      const id = PRIZE_SET_IDS[country][tier];
      state.prizeSets.set(id, {
        id,
        country,
        tier,
        guaranteed: guaranteedFor(country, tier),
        variablePool: basePool,
        cardsPerPack: 5,
        createdAt: now,
      });
    }
  }
  // Aliases para tests legacy que apuntan a los UUIDs antiguos.
  state.prizeSets.set(LEGACY_SV_PRIZE_SET, {
    ...state.prizeSets.get(PRIZE_SET_IDS.SV.bronce)!,
    id: LEGACY_SV_PRIZE_SET,
  });
  state.prizeSets.set(LEGACY_GT_PRIZE_SET, {
    ...state.prizeSets.get(PRIZE_SET_IDS.GT.bronce)!,
    id: LEGACY_GT_PRIZE_SET,
  });

  for (const demo of DEMO_CODES) {
    const id = randomUUID();
    state.codes.set(demo.code, {
      id,
      code: demo.code,
      country: demo.country,
      prizeSetId: PRIZE_SET_IDS[demo.country][demo.tier],
      status: "active",
      packResult: null,
      openedAt: null,
      redeemedAt: null,
      redeemedBy: null,
      redeemedIp: null,
      expiresAt: null,
      createdAt: now,
    });
    state.codesById.set(id, demo.code);
  }

  return state;
}

const globalForMock = globalThis as unknown as {
  __albumgpDevMockState?: DevMockState;
};

function getState(): DevMockState {
  if (globalForMock.__albumgpDevMockState === undefined) {
    globalForMock.__albumgpDevMockState = buildSeededState();
    // eslint-disable-next-line no-console
    console.warn(
      "[dev-mock-db] In-memory mock DB initialized. Demo codes: " +
        DEMO_CODES.map((d) => `${d.country}/${d.tier}=${d.code}`).join(" | "),
    );
  }
  return globalForMock.__albumgpDevMockState;
}

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
  return clause.some((entry) => {
    if (entry.expiresAt === null) {
      return code.expiresAt === null;
    }
    return (
      code.expiresAt !== null &&
      code.expiresAt.getTime() > entry.expiresAt.gt.getTime()
    );
  });
}

interface MockPrismaShape {
  code: {
    findUnique: (
      args: CodeFindUniqueArgs,
    ) => Promise<MockJoinedCode | Partial<MockJoinedCode> | null>;
    updateMany: (args: CodeUpdateManyArgs) => Promise<{ count: number }>;
  };
  redemption: {
    create: (
      args: RedemptionCreateArgs,
    ) => Promise<{ id: string; createdAt: Date }>;
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
            const sel = args.select[key];
            if (sel === true) {
              out[key] = (row as unknown as Record<string, unknown>)[key];
            } else if (
              key === "prizeSet" &&
              sel !== false &&
              typeof sel === "object" &&
              sel !== null
            ) {
              // Soporte para nested select sobre la relación `prizeSet`
              // (p. ej. select: { prizeSet: { select: { tier: true } } }).
              // Sin esto, openCodeDirect ve lookup.prizeSet === undefined
              // y crashea en `lookup.prizeSet.tier`.
              const ps = state.prizeSets.get(row.prizeSetId);
              if (ps === undefined) {
                out.prizeSet = null;
              } else {
                const inner = (sel as { select?: Record<string, boolean> })
                  .select;
                if (inner !== undefined) {
                  const psOut: Record<string, unknown> = {};
                  for (const psKey of Object.keys(inner)) {
                    if (inner[psKey] === true) {
                      psOut[psKey] =
                        (ps as unknown as Record<string, unknown>)[psKey];
                    }
                  }
                  out.prizeSet = psOut;
                } else {
                  out.prizeSet = ps;
                }
              }
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

        if (where.status !== undefined && target.status !== where.status) {
          return { count: 0 };
        }
        if (where.packResult !== undefined && target.packResult !== null) {
          return { count: 0 };
        }
        if (!evaluateExpiresAtClause(target, where.OR)) {
          return { count: 0 };
        }

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
        for (const existing of state.redemptions.values()) {
          if (existing.codeId === args.data.codeId) {
            const err = new Error(
              "Unique constraint failed: codeId",
            ) as Error & { code: string };
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
          const codeRow =
            codeValue !== undefined ? state.codes.get(codeValue) : undefined;
          if (codeRow === undefined) continue;
          list.push({ ...row, code: { country: codeRow.country } });
        }
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
  SV: DEMO_CODES.filter((d) => d.country === "SV").map((d) => d.code),
  GT: DEMO_CODES.filter((d) => d.country === "GT").map((d) => d.code),
} as const;
