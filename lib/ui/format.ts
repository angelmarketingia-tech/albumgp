// Pure UI formatting helpers.
//
// SAFE TO IMPORT FROM BOTH SERVER AND CLIENT components. No I/O, no env,
// no Prisma, no Redis, no auth. Just `string -> string`.
//
// Conventions:
//   - Locale-aware date formatting uses `Intl.DateTimeFormat`, which is
//     available in every runtime we target (Node, Edge, browser).
//   - Prize descriptions are short and self-contained — meant for tooltips,
//     aria-labels, and the minimal `<div>` placeholders rendered before the
//     design team's rich card components land.

import type { Currency, Prize } from "@/lib/prizes/types";

// Locale por moneda — fuerza el símbolo regional ("US$", "Q") sin depender
// del locale del runtime.
const LOCALE_BY_CURRENCY: Record<Currency, string> = {
  USD: "es-SV",
  GTQ: "es-GT",
};

/**
 * Formato monetario localizado: `US$10` para enteros, `Q100.00` con dos
 * decimales en caso contrario. Devuelve `''` ante valores no finitos para
 * que la UI no tenga que filtrar `NaN`/`Infinity`.
 */
export function formatMoney(amount: number, currency: Currency): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return "";
  }
  return new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency], {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Insert a single space every 4 characters so a 16-char code reads as
 * `ABCD EFGH JKLM NPQR`. Input outside the canonical 16-char form is
 * returned unchanged so this helper can never throw on display paths.
 */
export function formatCodeDisplay(code: string): string {
  if (typeof code !== "string") {
    return "";
  }
  if (code.length !== 16) {
    return code;
  }
  return `${code.slice(0, 4)} ${code.slice(4, 8)} ${code.slice(8, 12)} ${code.slice(12, 16)}`;
}

/**
 * Format an ISO-8601 timestamp as a short human-readable date in Spanish
 * (default), e.g. `"27 mar 2026"`. Returns an empty string on bad input so
 * the calling UI can render nothing instead of "Invalid Date".
 */
export function formatRedeemedAt(iso: string, locale: string = "es"): string {
  if (typeof iso !== "string" || iso.length === 0) {
    return "";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  // `es` default → "27 mar 2026". `day: 'numeric'` + `month: 'short'`
  // produces the trailing-period variant in Spanish locales — we strip it.
  const formatted = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
  return formatted.replace(/\./g, "");
}

/**
 * One-liner description of a prize. Used for tooltips, aria-labels and the
 * minimal `<div>` placeholders before Diseño's card components land.
 *
 * Always returns a non-empty string — `none` collapses to "Sin premio" so the
 * UI never has to handle the empty case.
 */
export function prizeShortDescription(prize: Prize): string {
  switch (prize.type) {
    case "sports_credit": {
      if (prize.label.length > 0) {
        return prize.label;
      }
      return formatMoney(prize.amount, prize.currency);
    }
    case "casino_spins": {
      if (prize.label.length > 0) {
        return prize.label;
      }
      return `${prize.count} giros ${prize.game_name}`;
    }
    case "deposit_match": {
      if (prize.label.length > 0) {
        return prize.label;
      }
      return `x${prize.multiplier} en tu depósito`;
    }
    case "physical": {
      return prize.label;
    }
    case "external_code": {
      return prize.label;
    }
    case "collectible": {
      const rarity = rarityLabel(prize.rarity);
      return `${rarity}: ${prize.label}`;
    }
    case "none": {
      return prize.label.length > 0 ? prize.label : "Sin premio";
    }
    default: {
      // Exhaustiveness guard. If a new PrizeType is added without updating
      // this switch, TypeScript flags it; at runtime we degrade gracefully.
      const _exhaustive: never = prize;
      void _exhaustive;
      return "Premio";
    }
  }
}

/**
 * Frase en español para lectores de pantalla. Más natural que
 * `prizeShortDescription` (que prioriza brevedad visual) — pensada para
 * `aria-label` en cartas, sobres y tarjetas del álbum.
 */
export function formatPrizeForA11y(prize: Prize): string {
  switch (prize.type) {
    case "collectible": {
      return `Coleccionable ${rarityLabel(prize.rarity)} ${prize.label}`;
    }
    case "sports_credit": {
      return `Apuesta gratis de ${formatMoney(prize.amount, prize.currency)}`;
    }
    case "casino_spins": {
      return `${prize.count} giros gratis`;
    }
    case "deposit_match": {
      return `Bono de depósito de ${prize.multiplier} veces`;
    }
    case "external_code": {
      return `Código premio ${prize.label}`;
    }
    case "physical": {
      // Etiqueta amigable por categoría; el `label` libre del premio queda
      // como respaldo cuando la categoría es genérica.
      switch (prize.category) {
        case "cinema_combo":
          return "Combo de cine";
        case "jersey_local":
          return "Camiseta oficial";
        case "jersey_intl":
          return "Camiseta internacional";
        case "selecta_merch":
          return "Producto oficial de La Selecta";
        case "motorcycle":
          return "Moto";
        case "other":
          return prize.label;
        default: {
          const _exhaustive: never = prize.category;
          void _exhaustive;
          return prize.label;
        }
      }
    }
    case "none": {
      return "Sigue intentando";
    }
    default: {
      const _exhaustive: never = prize;
      void _exhaustive;
      return "Premio";
    }
  }
}

/**
 * Spanish label for collectible rarity. Exported for reuse by the minimal
 * pack-card placeholders (will be replaced by Diseño's RarityBadge later).
 */
export function rarityLabel(
  rarity: "common" | "rare" | "epic" | "legendary",
): string {
  switch (rarity) {
    case "common":
      return "Común";
    case "rare":
      return "Rara";
    case "epic":
      return "Épica";
    case "legendary":
      return "Legendaria";
    default: {
      const _exhaustive: never = rarity;
      void _exhaustive;
      return "Carta";
    }
  }
}
