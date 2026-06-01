// Tema visual y copy por tier de sobre.
//
// Centralizado acá para que la UI (entry, sobre cerrado, banners, badges) no
// hardcodee colores ni copy en N lugares. Si cambia un HEX o un label,
// se cambia acá y se propaga.

import type { EnvelopeTier } from "./types";

export interface TierTheme {
  tier: EnvelopeTier;
  /** Label corto en mayúsculas para chips/badges. */
  label: string;
  /** Frase breve que describe el tier (entry / sobre cerrado). */
  tagline: string;
  /** Clase Tailwind para el badge de fondo. */
  badgeClass: string;
  /** Clase Tailwind para el borde decorativo del sobre cerrado. */
  envelopeBorderClass: string;
  /** Color rgba() para el halo del sobre cerrado. */
  envelopeGlow: string;
  /** Color HEX dominante (uso ad-hoc en estilos inline). */
  accentHex: string;
}

// ALL tier themes stay inside the official brand palette (brand/README.md):
// green #00783E, green-deep #034419, grays #6D6E71/#A7A9AC, white, and the
// approved gold accent #D4A017 + gold gradient. No off-brand amber/slate/cyan.
// The four tiers read as a deliberate progression: deep green (entry) →
// brand silver-gray → gold → green+gold premium. Distinct, yet coherent.
export const TIER_THEME: Readonly<Record<EnvelopeTier, TierTheme>> = Object.freeze({
  bronce: {
    tier: "bronce",
    // Display case — CSS `text-transform: uppercase` handles visual styling
    // so screen readers read "Bronce" instead of spelling B-R-O-N-C-E.
    label: "Bronce",
    tagline: "Tu pase de entrada al álbum",
    // Entry tier: deep brand green base, understated. On-palette.
    badgeClass:
      "bg-gradient-to-br from-gp-green-deep via-gp-green to-gp-green-deep text-gp-white shadow-md shadow-gp-green-deep/40 ring-1 ring-inset ring-gp-white/15",
    envelopeBorderClass: "border-gp-green",
    envelopeGlow: "rgba(3, 68, 25, 0.55)",
    accentHex: "#034419",
  },
  plata: {
    tier: "plata",
    label: "Plata",
    // Honest copy — universal variable_pool ships free bets + spins + match
    // bonus, not camisetas/merch.
    tagline: "Tu bienvenida con bono ampliado",
    // Silver = official brand grays (#A7A9AC / #6D6E71). On-palette.
    badgeClass:
      "bg-gradient-to-br from-gp-gray-light via-white to-gp-gray-dark-1 text-gp-gray-dark-2 shadow-md shadow-gp-gray-dark-1/30 ring-1 ring-inset ring-white/50",
    envelopeBorderClass: "border-gp-gray-light",
    envelopeGlow: "rgba(167, 169, 172, 0.55)",
    accentHex: "#A7A9AC",
  },
  oro: {
    tier: "oro",
    label: "Oro",
    // Honest copy — pool delivers bonus/free bets/spins, no cine experiences.
    tagline: "Bono premium para apostadores activos",
    // Official approved gold gradient (#B8860B → #D4A017 → #F4D03F). On-palette.
    badgeClass:
      "bg-[linear-gradient(135deg,#B8860B_0%,#D4A017_50%,#F4D03F_100%)] text-gp-green-deep shadow-lg shadow-gp-gold/40 ring-1 ring-inset ring-gp-gold/50",
    envelopeBorderClass: "border-gp-gold",
    envelopeGlow: "rgba(212, 160, 23, 0.65)",
    accentHex: "#D4A017",
  },
  platino: {
    tier: "platino",
    // Visible label "Diamante" (artwork shows green+gold diamond theme).
    // Internal key stays `platino` for DB/seed/type compat.
    label: "Diamante",
    tagline: "Sobre Diamante — el premio mayor",
    // Top tier: brand green core with a gold shimmer accent — the premium
    // green+gold lockup from the artwork. Fully on-palette.
    badgeClass:
      "bg-gradient-to-br from-gp-green via-gp-green-core to-gp-green-deep text-gp-gold shadow-lg shadow-gp-gold/40 ring-1 ring-inset ring-gp-gold/60 animate-shimmer bg-[length:200%_100%]",
    envelopeBorderClass: "border-gp-gold",
    envelopeGlow: "rgba(212, 160, 23, 0.7)",
    accentHex: "#00783E",
  },
});

/**
 * Color spine por rarity para RarityShelf y otros tier indicators.
 *
 * common/rare/legendary son colores oficiales del Manual (gris secundario,
 * verde principal, dorado de acento). `epic` es el ÚNICO valor fuera de paleta:
 * el Manual no define un color para esta categoría. `#5A3E9F` es la propuesta
 * de Diseño [CONFIRMAR_EPIC_COLOR] (brand/README.md). Consolidado acá como
 * única fuente de verdad — antes había dos morados distintos (#7C3AED aquí y
 * rgba(168,85,247) en globals.css). Sustituir por el oficial cuando llegue.
 */
export const EPIC_COLOR = "#5A3E9F";

export const RARITY_BAR_COLOR: Readonly<Record<"common" | "rare" | "epic" | "legendary", string>> =
  Object.freeze({
    common: "#A7A9AC",
    rare: "#00783E",
    epic: EPIC_COLOR,
    legendary: "#D4A017",
  });

export function formatTier(tier: EnvelopeTier): string {
  return TIER_THEME[tier].label;
}

/**
 * Parse defensivo — usado al leer la columna `tier` de Prisma (string crudo).
 * Devuelve null si el valor no es un tier conocido (en cuyo caso el caller
 * decide qué hacer: fallback a `bronce` o tratar como tier desconocido).
 */
export function tierFromValue(value: unknown): EnvelopeTier | null {
  if (value === "bronce" || value === "plata" || value === "oro" || value === "platino") {
    return value;
  }
  return null;
}
