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
};

export type CasinoSpinsPrize = {
  type: "casino_spins";
  count: number;
  game_name: string;
  label: string;
};

export type DepositMatchPrize = {
  type: "deposit_match";
  multiplier: number;
  // `extras` is optional but, under `exactOptionalPropertyTypes`, must be
  // declared `| undefined` to align with Zod's `.optional()` inference.
  extras?: string | undefined;
  label: string;
};

export type PhysicalPrize = {
  type: "physical";
  sku: string;
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
