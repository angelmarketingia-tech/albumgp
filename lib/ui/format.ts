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

import type { Prize } from "@/lib/prizes/types";

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
      // Prefer the explicit `label` when present, otherwise fall back to the
      // canonical "$X CCC" form so the caller always has something to render.
      if (prize.label.length > 0) {
        return prize.label;
      }
      return `${prize.amount} ${prize.currency}`;
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
