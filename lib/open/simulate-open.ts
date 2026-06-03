// Simulación de apertura de sobre para el preview SIN base de datos.
//
// Activado por SIMULATE_REDEEM=1 (misma flag que el canje simulado). Genera un
// pack auténtico usando `resolvePack` real sobre un catálogo en memoria (espejo
// reducido de prisma/seed.ts), sin tocar Postgres ni Redis. Así el flujo
// completo —abrir sobre → ver premios → canjear → redirect— funciona en la demo.
//
// El tier y país se infieren del código (heurística simple para la demo):
//   - país: termina en "GT" → Guatemala; si no → El Salvador.
//   - tier: por el primer caracter, para que se vean los 4 tipos de sobre.

import {
  resolvePack,
  type EnvelopeTier,
  type Prize,
  type PrizeSetData,
  type VariablePoolEntry,
} from "@/lib/prizes";
import type { OpenSuccessBody } from "./open-code";

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

// Imágenes promocionales de las cartas garantizadas, por país. Guardá los
// archivos en public/assets/cartas/premios/ con EXACTAMENTE estos nombres y
// aparecerán en las cartas. Formatos soportados por next/image: .webp/.png/.jpg.
// (Si no existe el archivo, la carta cae al diseño genérico — no rompe nada.)
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

// Garantizados: bono de bienvenida estándar GanaPlay (igual que el seed).
function guaranteedFor(country: "SV" | "GT"): Prize[] {
  const isSV = country === "SV";
  const symbol = isSV ? "$" : "Q";
  const bet = isSV ? 10 : 100;
  const currency = isSV ? "USD" : "GTQ";
  const game = isSV ? "Clover Super Pot" : "Super Tiki Strike";
  const img = PROMO_IMG[country];
  return [
    { type: "sports_credit", amount: bet, currency, label: `${symbol}${bet} ${currency} en free bets`, image_url: img.freebet },
    { type: "casino_spins", count: 200, game_name: game, label: `200 giros gratis en ${game}`, image_url: img.giros },
    { type: "deposit_match", multiplier: 3, extras: "giros gratis", label: "3× tu primer depósito + giros gratis", image_url: img.deposito },
  ];
}

// Pool variable por tier (cuanto más alto el tier, mejores cartas/premios).
function poolFor(tier: EnvelopeTier, country: "SV" | "GT"): VariablePoolEntry[] {
  const base: VariablePoolEntry[] = [
    { prize: collectible("delantero-estrella", "Delantero estrella", "common", "delantero-estrella.png"), weight: 5 },
    { prize: collectible("mediocampo-creativo", "Mediocampo creativo", "common", "mediocampo-creativo.png"), weight: 5 },
    { prize: collectible("defensor-de-hierro", "Defensor de hierro", "common", "defensor-de-hierro.png"), weight: 4 },
    { prize: collectible("arquero-impasable", "Arquero impasable", "rare", "arquero-impasable.png"), weight: 3 },
    { prize: collectible("capitan", "Capitán", "rare", "capitan.png"), weight: 2 },
    { prize: NONE, weight: 3 },
  ];
  if (tier === "oro" || tier === "platino") {
    base.push({ prize: collectible("joven-promesa", "Joven promesa", "epic", "joven-promesa.png"), weight: 2 });
    base.push({
      prize: { type: "external_code", provider: "Rappi", label: country === "SV" ? "Código Rappi — $15" : "Código Rappi — Q150" },
      weight: 2,
    });
  }
  if (tier === "platino") {
    base.push({
      prize: { type: "physical", sku: "JERSEY_INTL_FC_BARCELONA", category: "jersey_intl", label: "Camiseta internacional — FC Barcelona", redemption_instructions: "Te contactamos para tomar talla y dirección." },
      weight: 2,
    });
    if (country === "GT") {
      base.push({
        prize: { type: "physical", sku: "MOTO_PREMIO_MAYOR_GT", category: "motorcycle", label: "¡MOTO! Premio mayor", redemption_instructions: "Sujeto a verificación de identidad y mayoría de edad." },
        weight: 1,
      });
    }
  }
  return base;
}

const TIER_BY_FIRST_CHAR: Record<string, EnvelopeTier> = {
  // Vocales/dígitos repartidos para que la demo muestre los 4 tipos.
  P: "platino",
  U: "oro",
  R: "oro",
  M: "plata",
};

function inferCountry(code: string): "SV" | "GT" {
  return code.toUpperCase().endsWith("GT") ? "GT" : "SV";
}

function inferTier(code: string): EnvelopeTier {
  const first = code.toUpperCase().charAt(0);
  return TIER_BY_FIRST_CHAR[first] ?? "bronce";
}

/**
 * Devuelve un `OpenSuccessBody` simulado (mismo shape que `openCodeDirect`).
 * Usa `resolvePack` real, así el pack es estructuralmente idéntico al de prod.
 */
export function simulateOpen(code: string): OpenSuccessBody {
  const country = inferCountry(code);
  const tier = inferTier(code);
  const prizeSet: PrizeSetData = {
    guaranteed: guaranteedFor(country),
    variable_pool: poolFor(tier, country),
    cards_per_pack: 5,
  };
  const pack = resolvePack(prizeSet);
  return { pack, country, tier };
}

/** Tier inferido para el "peek" del sobre cerrado (badge antes de abrir). */
export function simulatePeekTier(code: string): EnvelopeTier {
  return inferTier(code);
}
