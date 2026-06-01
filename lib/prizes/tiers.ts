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

export const TIER_THEME: Readonly<Record<EnvelopeTier, TierTheme>> = Object.freeze({
  bronce: {
    tier: "bronce",
    // Display case — CSS `text-transform: uppercase` handles visual styling
    // so screen readers read "Bronce" instead of spelling B-R-O-N-C-E.
    label: "Bronce",
    tagline: "Tu pase de entrada al álbum",
    badgeClass:
      "bg-gradient-to-br from-amber-800 via-amber-600 to-amber-900 text-amber-50 shadow-md shadow-amber-900/40 ring-1 ring-inset ring-amber-300/30",
    envelopeBorderClass: "border-amber-700",
    envelopeGlow: "rgba(180, 83, 9, 0.55)",
    accentHex: "#B45309",
  },
  plata: {
    tier: "plata",
    label: "Plata",
    // Honest copy — universal variable_pool ships free bets + spins + match
    // bonus, not camisetas/merch.
    tagline: "Tu bienvenida con bono ampliado",
    badgeClass:
      "bg-gradient-to-br from-slate-200 via-white to-slate-400 text-slate-800 shadow-md shadow-slate-400/30 ring-1 ring-inset ring-white/50",
    envelopeBorderClass: "border-slate-300",
    envelopeGlow: "rgba(203, 213, 225, 0.55)",
    accentHex: "#CBD5E1",
  },
  oro: {
    tier: "oro",
    label: "Oro",
    // Honest copy — pool delivers bonus/free bets/spins, no cine experiences.
    tagline: "Bono premium para apostadores activos",
    badgeClass:
      "bg-[linear-gradient(135deg,#B8860B_0%,#D4A017_50%,#F4D03F_100%)] text-amber-950 shadow-lg shadow-amber-500/40 ring-1 ring-inset ring-amber-200/50",
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
    badgeClass:
      "bg-gradient-to-br from-cyan-100 via-white to-cyan-200 text-cyan-900 shadow-lg shadow-cyan-300/40 ring-1 ring-inset ring-white/60 animate-shimmer bg-[length:200%_100%]",
    envelopeBorderClass: "border-cyan-200",
    envelopeGlow: "rgba(165, 243, 252, 0.75)",
    accentHex: "#A5F3FC",
  },
});

/** Color spine por rarity para RarityShelf y otros tier indicators. */
export const RARITY_BAR_COLOR: Readonly<Record<"common" | "rare" | "epic" | "legendary", string>> =
  Object.freeze({
    common: "#A7A9AC",
    rare: "#00783E",
    epic: "#7C3AED",
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
