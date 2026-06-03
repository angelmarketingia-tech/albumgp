// Canonical domain types for prizes. See AGENTS.md §4.
// All fields are validated at the boundary via `lib/prizes/schemas.ts`.

export type PrizeType =
  | "sports_credit"
  | "casino_spins"
  | "deposit_match"
  | "physical"
  | "external_code"
  | "collectible"
  | "none";

export type Currency = "USD" | "GTQ";

export type SportsCreditPrize = {
  type: "sports_credit";
  amount: number;
  currency: Currency;
  label: string;
  // Imagen promocional opcional. Si está, la carta la muestra full-bleed en
  // lugar del diseño genérico (ícono + monto). `| undefined` para alinear con
  // la inferencia de Zod bajo `exactOptionalPropertyTypes`.
  image_url?: string | undefined;
};

export type CasinoSpinsPrize = {
  type: "casino_spins";
  count: number;
  game_name: string;
  label: string;
  // Imagen promocional opcional (ver SportsCreditPrize).
  image_url?: string | undefined;
};

export type DepositMatchPrize = {
  type: "deposit_match";
  multiplier: number;
  // `extras` is optional but, under `exactOptionalPropertyTypes`, must be
  // declared `| undefined` to align with Zod's `.optional()` inference.
  extras?: string | undefined;
  label: string;
  // Imagen promocional opcional (ver SportsCreditPrize).
  image_url?: string | undefined;
};

/**
 * Categoría de premio físico — define qué icono usa la carta y cómo el equipo
 * de operaciones procesa el canje.
 *
 *  - `cinema_combo`    Combo Cinemark (entradas + comida).
 *  - `jersey_local`    Camiseta de equipo local (patrocinado por GanaPlay SV/GT).
 *  - `jersey_intl`     Camiseta de club internacional (no patrocinado).
 *  - `selecta_merch`   Producto oficial de La Selecta (SV únicamente).
 *  - `motorcycle`      Premio mayor — moto (sobres Diamante, key 'platino').
 *  - `other`           SKU físico que no encaja arriba; usar con label claro.
 */
export type PhysicalCategory =
  | "cinema_combo"
  | "jersey_local"
  | "jersey_intl"
  | "selecta_merch"
  | "motorcycle"
  | "other";

export type PhysicalPrize = {
  type: "physical";
  sku: string;
  category: PhysicalCategory;
  label: string;
  redemption_instructions: string;
};

export type ExternalCodePrize = {
  type: "external_code";
  provider: string;
  label: string;
};

/**
 * Cartas coleccionables decorativas que pasan al álbum del usuario.
 * NO son canjeables; el atractivo es completar la colección
 * (gamificación tipo álbum de cromos). Su rareza modula la probabilidad
 * y el feedback visual al usuario, pero no representa un valor monetario.
 *
 * - `collectible_id`: identificador estable para deduplicar en el álbum.
 * - `image_url`: opcional hasta que Diseño provea los assets finales
 *   (Fase 4-6). Mientras tanto se renderiza un placeholder genérico.
 */
export type CollectiblePrize = {
  type: "collectible";
  collectible_id: string;
  label: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  // Optional under `exactOptionalPropertyTypes` — must be `| undefined`
  // to align with Zod's `.optional()` inference.
  image_url?: string | undefined;
};

export type NonePrize = {
  type: "none";
  label: string;
};

export type Prize =
  | SportsCreditPrize
  | CasinoSpinsPrize
  | DepositMatchPrize
  | PhysicalPrize
  | ExternalCodePrize
  // Order: premio (canjeable) → coleccionable (decorativo) → nada.
  | CollectiblePrize
  | NonePrize;

export type VariablePoolEntry = {
  prize: Prize;
  weight: number;
};

// `pack_version` lets us evolve resolution logic without invalidating
// previously-fixed pack_result values stored on `codes.pack_result`.
export type PackResult = {
  guaranteed: Prize[];
  variable: Prize[];
  pack_version: string;
};

export const PACK_VERSION_CURRENT = "v1";

/**
 * Clasificación de sobres por valor del mix de premios.
 *
 * - `bronce`  → entrada — free bets pequeñas, giros, Rappi chico.
 * - `plata`   → + camisetas de equipos locales, merch de La Selecta (SV only).
 * - `oro`     → + combos Cinemark, free bets medianos, Rappi grande.
 * - `platino` → top tier — camisetas internacionales, moto (GT), free bet máxima.
 *
 * El tier vive en `prize_sets.tier` y se propaga a la UI para diferenciar el
 * sobre cerrado y la entry screen. El usuario lo conoce ANTES de abrir para
 * generar anticipación (decisión de producto, 2026-05-28).
 */
export type EnvelopeTier = "bronce" | "plata" | "oro" | "platino";

export const ENVELOPE_TIERS: readonly EnvelopeTier[] = [
  "bronce",
  "plata",
  "oro",
  "platino",
] as const;
