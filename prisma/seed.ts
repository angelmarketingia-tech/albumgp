// Seed: one prize_set per country with the 3 guaranteed prizes as placeholders.
// Labels are explicit PLACEHOLDERS pending [CONFIRMAR_TEXTO_LEGAL].
// The variable_pool entries are intentionally `none` placeholders until
// the variable pool composition is confirmed.

import { PrismaClient } from "@prisma/client";
import {
  packResultSchema,
  prizeSchema,
  variablePoolEntrySchema,
} from "../lib/prizes/schemas";
import type { Prize, VariablePoolEntry } from "../lib/prizes/types";

const prisma = new PrismaClient();

// Fixed UUIDs so the seed is idempotent and the import script can target
// known prize_set IDs in fixtures.
const PRIZE_SET_SV_ID = "11111111-1111-4111-8111-111111111111";
const PRIZE_SET_GT_ID = "22222222-2222-4222-8222-222222222222";

const svGuaranteed: Prize[] = [
  {
    type: "sports_credit",
    amount: 10,
    currency: "USD",
    // TODO: depende de [CONFIRMAR_TEXTO_LEGAL]
    label: "[PLACEHOLDER] $10 USD para pronosticar — pendiente CONFIRMAR_TEXTO_LEGAL",
  },
  {
    type: "casino_spins",
    count: 200,
    game_name: "Clover Super Pot",
    // TODO: depende de [CONFIRMAR_TEXTO_LEGAL]
    label: "[PLACEHOLDER] 200 giros gratis en Clover Super Pot — pendiente CONFIRMAR_TEXTO_LEGAL",
  },
  {
    type: "deposit_match",
    multiplier: 3,
    extras: "giros gratis",
    // TODO: depende de [CONFIRMAR_TEXTO_LEGAL]
    label: "[PLACEHOLDER] Triplicamos tu primer depósito + giros — pendiente CONFIRMAR_TEXTO_LEGAL",
  },
];

const gtGuaranteed: Prize[] = [
  {
    type: "sports_credit",
    amount: 100,
    currency: "GTQ",
    // TODO: depende de [CONFIRMAR_TEXTO_LEGAL]
    label: "[PLACEHOLDER] Q100 para pronosticar — pendiente CONFIRMAR_TEXTO_LEGAL",
  },
  {
    type: "casino_spins",
    count: 200,
    game_name: "Super Tiki Strike",
    // TODO: depende de [CONFIRMAR_TEXTO_LEGAL]
    label: "[PLACEHOLDER] 200 giros gratis en Super Tiki Strike — pendiente CONFIRMAR_TEXTO_LEGAL",
  },
  {
    type: "deposit_match",
    multiplier: 3,
    // TODO: depende de [CONFIRMAR_TEXTO_LEGAL]
    label: "[PLACEHOLDER] Triplicamos tu primer depósito — pendiente CONFIRMAR_TEXTO_LEGAL",
  },
];

// TODO: pool variable real pendiente — composición y pesos por país.
const placeholderVariablePool: VariablePoolEntry[] = [
  {
    prize: { type: "none", label: "[PLACEHOLDER] No ganaste" },
    weight: 1,
  },
  {
    prize: { type: "none", label: "[PLACEHOLDER] No ganaste — variante" },
    weight: 1,
  },
];

function assertValid(
  guaranteed: Prize[],
  pool: VariablePoolEntry[],
): void {
  for (const p of guaranteed) prizeSchema.parse(p);
  for (const e of pool) variablePoolEntrySchema.parse(e);
  // Sanity check: a hypothetical pack would parse correctly.
  packResultSchema.parse({
    guaranteed,
    variable: pool.map((e) => e.prize),
    pack_version: "v1",
  });
}

async function main(): Promise<void> {
  assertValid(svGuaranteed, placeholderVariablePool);
  assertValid(gtGuaranteed, placeholderVariablePool);

  await prisma.prizeSet.upsert({
    where: { id: PRIZE_SET_SV_ID },
    create: {
      id: PRIZE_SET_SV_ID,
      country: "SV",
      guaranteed: svGuaranteed,
      variablePool: placeholderVariablePool,
      cardsPerPack: 5,
    },
    update: {
      guaranteed: svGuaranteed,
      variablePool: placeholderVariablePool,
      cardsPerPack: 5,
    },
  });

  await prisma.prizeSet.upsert({
    where: { id: PRIZE_SET_GT_ID },
    create: {
      id: PRIZE_SET_GT_ID,
      country: "GT",
      guaranteed: gtGuaranteed,
      variablePool: placeholderVariablePool,
      cardsPerPack: 5,
    },
    update: {
      guaranteed: gtGuaranteed,
      variablePool: placeholderVariablePool,
      cardsPerPack: 5,
    },
  });

  // eslint-disable-next-line no-console
  console.log(
    `Seed OK. prize_sets: SV=${PRIZE_SET_SV_ID}, GT=${PRIZE_SET_GT_ID}`,
  );
}

main()
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
