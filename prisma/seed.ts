// Seed: one prize_set per country with the 3 guaranteed prizes + a demo
// pool of decorative collectible cards (NOT redeemable — they populate the
// user's album for completion-style gamification).
//
// Labels use provisional marketing copy (no "PLACEHOLDER" wording exposed
// to the user). The exact legal text is still pending [CONFIRMAR_TEXTO_LEGAL].

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
    // TODO: copy provisional — sujeto a [CONFIRMAR_TEXTO_LEGAL] del Manual.
    label: "$10 USD para apostar en eventos deportivos",
  },
  {
    type: "casino_spins",
    count: 200,
    game_name: "Clover Super Pot",
    // TODO: copy provisional — sujeto a [CONFIRMAR_TEXTO_LEGAL] del Manual.
    label: "200 giros gratis en Clover Super Pot",
  },
  {
    type: "deposit_match",
    multiplier: 3,
    extras: "giros gratis",
    // TODO: copy provisional — sujeto a [CONFIRMAR_TEXTO_LEGAL] del Manual.
    label: "Triplicamos tu primer depósito + giros gratis",
  },
];

const gtGuaranteed: Prize[] = [
  {
    type: "sports_credit",
    amount: 100,
    currency: "GTQ",
    // TODO: copy provisional — sujeto a [CONFIRMAR_TEXTO_LEGAL] del Manual.
    label: "Q100 para apostar en eventos deportivos",
  },
  {
    type: "casino_spins",
    count: 200,
    game_name: "Super Tiki Strike",
    // TODO: copy provisional — sujeto a [CONFIRMAR_TEXTO_LEGAL] del Manual.
    label: "200 giros gratis en Super Tiki Strike",
  },
  {
    type: "deposit_match",
    multiplier: 3,
    // TODO: copy provisional — sujeto a [CONFIRMAR_TEXTO_LEGAL] del Manual.
    label: "Triplicamos tu primer depósito",
  },
];

// Demo pool of decorative collectibles — same set for SV and GT for now.
// `image_url` points to PNG assets under `/public/assets/cartas/`
// (generated with Higgsfield Z Image, see brand/README.md). Reemplazar
// con arte oficial cuando llegue. The `none` entry exists so some slots
// come up empty, which makes rarer collectibles feel rarer.
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
  assertValid(svGuaranteed, demoCollectiblesPool);
  assertValid(gtGuaranteed, demoCollectiblesPool);

  await prisma.prizeSet.upsert({
    where: { id: PRIZE_SET_SV_ID },
    create: {
      id: PRIZE_SET_SV_ID,
      country: "SV",
      guaranteed: svGuaranteed,
      variablePool: demoCollectiblesPool,
      cardsPerPack: 5,
    },
    update: {
      guaranteed: svGuaranteed,
      variablePool: demoCollectiblesPool,
      cardsPerPack: 5,
    },
  });

  await prisma.prizeSet.upsert({
    where: { id: PRIZE_SET_GT_ID },
    create: {
      id: PRIZE_SET_GT_ID,
      country: "GT",
      guaranteed: gtGuaranteed,
      variablePool: demoCollectiblesPool,
      cardsPerPack: 5,
    },
    update: {
      guaranteed: gtGuaranteed,
      variablePool: demoCollectiblesPool,
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
