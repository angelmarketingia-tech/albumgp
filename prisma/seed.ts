// Seed: 8 prize_sets — 4 tiers (bronce/plata/oro/platino) × 2 países (SV/GT).
//
// Decisión de producto del 2026-05-28:
//   - Tier visible al usuario ANTES de abrir.
//   - SV: La Selecta es exclusiva. Camisetas locales SV. Cinemark en ambos.
//   - GT: Más énfasis en premios de plataforma (free bets, giros, deposit
//     match grandes). Premio mayor: una moto en el sobre Platino.
//   - Rappi en ambos países.
//   - Camisetas internacionales solo en Platino.
//
// Cada prize_set sigue la misma estructura: 3 garantizados + variable_pool
// que rellena los 2 slots restantes (cards_per_pack=5). Los garantizados
// definen el "piso" del tier; el pool variable inyecta los coleccionables
// y un porcentaje de premios "none" para que la rareza se sienta.
//
// Labels usan copy provisional — sujetos a [CONFIRMAR_TEXTO_LEGAL].

import { PrismaClient } from "@prisma/client";
import {
  packResultSchema,
  prizeSchema,
  variablePoolEntrySchema,
} from "../lib/prizes/schemas";
import type {
  Prize,
  VariablePoolEntry,
  SportsCreditPrize,
  CasinoSpinsPrize,
  DepositMatchPrize,
} from "../lib/prizes/types";

const prisma = new PrismaClient();

// UUIDs fijos por (country, tier) para idempotencia y para que el script
// de importación de códigos pueda apuntar a un prize_set conocido.
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

// ---------- Catálogo de premios reutilizables --------------------------------

const giros = (count: number, game: string): CasinoSpinsPrize => ({
  type: "casino_spins",
  count,
  game_name: game,
  label: `${count} giros gratis en ${game}`,
});

const freeBetUSD = (amount: number): SportsCreditPrize => ({
  type: "sports_credit",
  amount,
  currency: "USD",
  label: `$${amount} USD en free bets para apostar`,
});

const freeBetGTQ = (amount: number): SportsCreditPrize => ({
  type: "sports_credit",
  amount,
  currency: "GTQ",
  label: `Q${amount} en free bets para apostar`,
});

const depositMatch = (mul: number, extras?: string): DepositMatchPrize => {
  const base =
    mul === 2
      ? "2× tu primer depósito"
      : mul === 3
      ? "3× tu primer depósito"
      : `${mul}× tu primer depósito`;
  return {
    type: "deposit_match",
    multiplier: mul,
    ...(extras !== undefined ? { extras } : {}),
    label: extras !== undefined ? `${base} + ${extras}` : base,
  };
};

// ---------- Premios físicos por país/categoría -------------------------------

const rappi = (amountLabel: string): Prize => ({
  type: "external_code",
  provider: "Rappi",
  label: `Código Rappi — ${amountLabel}`,
});

const cinemark = (label: string): Prize => ({
  type: "physical",
  sku: `CINEMARK_${label.replace(/\s+/g, "_").toUpperCase()}`,
  category: "cinema_combo",
  label,
  redemption_instructions:
    "Presentá tu código en boletería Cinemark. Válido por 60 días.",
});

const jerseyLocalSV = (team: string): Prize => ({
  type: "physical",
  sku: `JERSEY_SV_${team.replace(/\s+/g, "_").toUpperCase()}`,
  category: "jersey_local",
  label: `Camiseta oficial — ${team}`,
  redemption_instructions:
    "Coordinamos la entrega contigo dentro de El Salvador. Te contactamos en 5 días hábiles.",
});

const jerseyLocalGT = (team: string): Prize => ({
  type: "physical",
  sku: `JERSEY_GT_${team.replace(/\s+/g, "_").toUpperCase()}`,
  category: "jersey_local",
  label: `Camiseta oficial — ${team}`,
  redemption_instructions:
    "Coordinamos la entrega contigo dentro de Guatemala. Te contactamos en 5 días hábiles.",
});

const jerseyIntl = (team: string): Prize => ({
  type: "physical",
  sku: `JERSEY_INTL_${team.replace(/\s+/g, "_").toUpperCase()}`,
  category: "jersey_intl",
  label: `Camiseta internacional — ${team}`,
  redemption_instructions:
    "Tiempo de entrega 2-4 semanas. Te contactamos para tomar talla y dirección.",
});

const selectaMerch = (item: string): Prize => ({
  type: "physical",
  sku: `SELECTA_${item.replace(/\s+/g, "_").toUpperCase()}`,
  category: "selecta_merch",
  label: `La Selecta oficial — ${item}`,
  redemption_instructions:
    "Producto oficial de patrocinio. Te contactamos para coordinar entrega en El Salvador.",
});

const motoGT: Prize = {
  type: "physical",
  sku: "MOTO_PREMIO_MAYOR_GT",
  category: "motorcycle",
  label: "¡MOTO! Premio mayor",
  redemption_instructions:
    "Premio mayor sujeto a verificación de identidad y mayoría de edad. Te contactamos en 24h.",
};

const NONE: Prize = { type: "none", label: "No ganaste" };

// ---------- Coleccionables base (compartido entre tiers) ---------------------
//
// Los coleccionables son los mismos para todos los tiers — su rareza es lo
// que cambia el peso. Mantener el set chico para que el álbum se sienta
// completable (ver AGENTS.md §4 — gamificación de álbum de cromos).

const collectible = (
  id: string,
  label: string,
  rarity: "common" | "rare" | "epic" | "legendary",
  imgFile: string,
): Prize => ({
  type: "collectible",
  collectible_id: id,
  label,
  rarity,
  image_url: `/assets/cartas/${imgFile}`,
});

// ---------- Pools variables por tier -----------------------------------------
//
// Filosofía:
//   - BRONCE: mayoría coleccionables comunes + un poco de "none". Sin
//     premios físicos en el pool variable (los garantizados ya dan algo).
//   - PLATA: agrega rares + chance de jersey local / Selecta (SV).
//   - ORO: agrega cinemark + Rappi grande + chance de epic.
//   - PLATINO: agrega jersey intl + (GT only) chance de moto + legendary.

const poolBronce = (): VariablePoolEntry[] => [
  { prize: collectible("delantero-estrella", "Delantero estrella", "common", "delantero-estrella.png"), weight: 6 },
  { prize: collectible("mediocampo-creativo", "Mediocampo creativo", "common", "mediocampo-creativo.png"), weight: 6 },
  { prize: collectible("defensor-de-hierro", "Defensor de hierro", "common", "defensor-de-hierro.png"), weight: 5 },
  { prize: collectible("arquero-impasable", "Arquero impasable", "rare", "arquero-impasable.png"), weight: 1 },
  { prize: NONE, weight: 6 },
];

const poolPlataSV = (): VariablePoolEntry[] => [
  { prize: collectible("delantero-estrella", "Delantero estrella", "common", "delantero-estrella.png"), weight: 5 },
  { prize: collectible("mediocampo-creativo", "Mediocampo creativo", "common", "mediocampo-creativo.png"), weight: 5 },
  { prize: collectible("defensor-de-hierro", "Defensor de hierro", "common", "defensor-de-hierro.png"), weight: 4 },
  { prize: collectible("arquero-impasable", "Arquero impasable", "rare", "arquero-impasable.png"), weight: 3 },
  { prize: collectible("capitan", "Capitán", "rare", "capitan.png"), weight: 2 },
  { prize: jerseyLocalSV("Alianza FC"), weight: 1 },
  { prize: selectaMerch("Bufanda"), weight: 1 },
  { prize: NONE, weight: 4 },
];

const poolPlataGT = (): VariablePoolEntry[] => [
  { prize: collectible("delantero-estrella", "Delantero estrella", "common", "delantero-estrella.png"), weight: 5 },
  { prize: collectible("mediocampo-creativo", "Mediocampo creativo", "common", "mediocampo-creativo.png"), weight: 5 },
  { prize: collectible("defensor-de-hierro", "Defensor de hierro", "common", "defensor-de-hierro.png"), weight: 4 },
  { prize: collectible("arquero-impasable", "Arquero impasable", "rare", "arquero-impasable.png"), weight: 3 },
  { prize: collectible("capitan", "Capitán", "rare", "capitan.png"), weight: 2 },
  { prize: jerseyLocalGT("Comunicaciones"), weight: 1 },
  { prize: rappi("Q75"), weight: 2 },
  { prize: NONE, weight: 4 },
];

const poolOroSV = (): VariablePoolEntry[] => [
  { prize: collectible("arquero-impasable", "Arquero impasable", "rare", "arquero-impasable.png"), weight: 4 },
  { prize: collectible("capitan", "Capitán", "rare", "capitan.png"), weight: 3 },
  { prize: collectible("joven-promesa", "Joven promesa", "epic", "joven-promesa.png"), weight: 2 },
  { prize: cinemark("Combo 2 entradas + palomitas"), weight: 2 },
  { prize: rappi("$15"), weight: 2 },
  { prize: jerseyLocalSV("FAS"), weight: 1 },
  { prize: selectaMerch("Jersey edición patrocinio"), weight: 1 },
  { prize: NONE, weight: 3 },
];

const poolOroGT = (): VariablePoolEntry[] => [
  { prize: collectible("arquero-impasable", "Arquero impasable", "rare", "arquero-impasable.png"), weight: 4 },
  { prize: collectible("capitan", "Capitán", "rare", "capitan.png"), weight: 3 },
  { prize: collectible("joven-promesa", "Joven promesa", "epic", "joven-promesa.png"), weight: 2 },
  { prize: cinemark("Combo 2 entradas + palomitas"), weight: 2 },
  { prize: rappi("Q150"), weight: 2 },
  { prize: jerseyLocalGT("Municipal"), weight: 1 },
  // GT: énfasis en premios de plataforma — empuja al usuario al casino/sportsbook.
  { prize: giros(300, "Super Tiki Strike"), weight: 2 },
  { prize: NONE, weight: 3 },
];

const poolPlatinoSV = (): VariablePoolEntry[] => [
  { prize: collectible("capitan", "Capitán", "rare", "capitan.png"), weight: 3 },
  { prize: collectible("joven-promesa", "Joven promesa", "epic", "joven-promesa.png"), weight: 3 },
  { prize: jerseyIntl("FC Barcelona"), weight: 2 },
  { prize: jerseyIntl("Real Madrid"), weight: 2 },
  { prize: selectaMerch("Jersey firmado"), weight: 1 },
  { prize: cinemark("Combo VIP 4 entradas"), weight: 2 },
  { prize: NONE, weight: 2 },
];

const poolPlatinoGT = (): VariablePoolEntry[] => [
  { prize: collectible("capitan", "Capitán", "rare", "capitan.png"), weight: 3 },
  { prize: collectible("joven-promesa", "Joven promesa", "epic", "joven-promesa.png"), weight: 3 },
  { prize: jerseyIntl("FC Barcelona"), weight: 2 },
  { prize: jerseyIntl("Real Madrid"), weight: 2 },
  { prize: cinemark("Combo VIP 4 entradas"), weight: 2 },
  // El premio mayor. Peso bajo a propósito — apariciones contadas.
  { prize: motoGT, weight: 1 },
  { prize: NONE, weight: 2 },
];

// ---------- Garantizados (iguales en todos los tiers) ------------------------
//
// Decisión 2026-05-29: los 3 garantizados son EXACTAMENTE el bono de bienvenida
// estándar de GanaPlay ($10 / 200 giros / 3× depósito + giros gratis). Lo que
// diferencia los tiers (Bronce / Plata / Oro / Diamante) es el POOL VARIABLE
// — las 2 cartas extra pueden ser camisetas, Selecta, combos de cine, moto, o
// coleccionables. Así el sobre del Mundial le da al usuario el mismo bono
// que ya conoce de la plataforma + la sorpresa de los premios extra.

// Imágenes promocionales de las cartas garantizadas (mismas rutas que el
// simulador, lib/open/simulate-open.ts). Guardá los archivos en
// public/assets/cartas/premios/ con estos nombres.
const PROMO_IMG = {
  SV: {
    freebet: "/assets/cartas/premios/sv-freebet-10.webp",
    giros: "/assets/cartas/premios/sv-giros-200.webp",
    deposito: "/assets/cartas/premios/sv-deposito-3x.webp",
  },
  GT: {
    freebet: "/assets/cartas/premios/gt-freebet-100.webp",
    giros: "/assets/cartas/premios/gt-giros-200.webp",
    deposito: "/assets/cartas/premios/gt-deposito-3x.webp",
  },
} as const;

const guaranteedSV: Prize[] = [
  { ...freeBetUSD(10), image_url: PROMO_IMG.SV.freebet },
  { ...giros(200, "Clover Super Pot"), image_url: PROMO_IMG.SV.giros },
  { ...depositMatch(3, "giros gratis"), image_url: PROMO_IMG.SV.deposito },
];

const guaranteedGT: Prize[] = [
  { ...freeBetGTQ(100), image_url: PROMO_IMG.GT.freebet },
  { ...giros(200, "Super Tiki Strike"), image_url: PROMO_IMG.GT.giros },
  { ...depositMatch(3, "giros gratis"), image_url: PROMO_IMG.GT.deposito },
];

// ---------- Validación + persistencia ----------------------------------------

function assertValid(
  guaranteed: Prize[],
  pool: VariablePoolEntry[],
): void {
  for (const p of guaranteed) prizeSchema.parse(p);
  for (const e of pool) variablePoolEntrySchema.parse(e);
  packResultSchema.parse({
    guaranteed,
    variable: pool.map((e) => e.prize),
    pack_version: "v1",
  });
}

type Country = "SV" | "GT";
type Tier = "bronce" | "plata" | "oro" | "platino";

interface PrizeSetSpec {
  id: string;
  country: Country;
  tier: Tier;
  guaranteed: Prize[];
  variablePool: VariablePoolEntry[];
}

const SPECS: PrizeSetSpec[] = [
  // SV — todos los tiers comparten el guaranteed (bono de bienvenida estándar);
  // varía solo el variablePool (premios físicos + coleccionables por tier).
  { id: PRIZE_SET_IDS.SV.bronce,  country: "SV", tier: "bronce",  guaranteed: guaranteedSV, variablePool: poolBronce() },
  { id: PRIZE_SET_IDS.SV.plata,   country: "SV", tier: "plata",   guaranteed: guaranteedSV, variablePool: poolPlataSV() },
  { id: PRIZE_SET_IDS.SV.oro,     country: "SV", tier: "oro",     guaranteed: guaranteedSV, variablePool: poolOroSV() },
  { id: PRIZE_SET_IDS.SV.platino, country: "SV", tier: "platino", guaranteed: guaranteedSV, variablePool: poolPlatinoSV() },
  // GT
  { id: PRIZE_SET_IDS.GT.bronce,  country: "GT", tier: "bronce",  guaranteed: guaranteedGT, variablePool: poolBronce() },
  { id: PRIZE_SET_IDS.GT.plata,   country: "GT", tier: "plata",   guaranteed: guaranteedGT, variablePool: poolPlataGT() },
  { id: PRIZE_SET_IDS.GT.oro,     country: "GT", tier: "oro",     guaranteed: guaranteedGT, variablePool: poolOroGT() },
  { id: PRIZE_SET_IDS.GT.platino, country: "GT", tier: "platino", guaranteed: guaranteedGT, variablePool: poolPlatinoGT() },
];

async function main(): Promise<void> {
  for (const spec of SPECS) {
    assertValid(spec.guaranteed, spec.variablePool);
    await prisma.prizeSet.upsert({
      where: { id: spec.id },
      create: {
        id: spec.id,
        country: spec.country,
        tier: spec.tier,
        guaranteed: spec.guaranteed,
        variablePool: spec.variablePool,
        cardsPerPack: 5,
      },
      update: {
        country: spec.country,
        tier: spec.tier,
        guaranteed: spec.guaranteed,
        variablePool: spec.variablePool,
        cardsPerPack: 5,
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`Seed OK. ${SPECS.length} prize_sets (4 tiers × 2 países).`);
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
