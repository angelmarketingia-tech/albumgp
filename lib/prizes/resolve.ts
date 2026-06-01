// SERVER ONLY — never import from a 'use client' module.
//
// Resolves a `PackResult` from a `PrizeSet`. Pure + synchronous so it can be
// covered with deterministic unit tests by injecting a fake RNG.
//
// Rules (AGENTS.md §3, §4 + Phase 2 brief):
//   - The 3 guaranteed prizes are copied verbatim, preserving order.
//   - The variable portion samples `cards_per_pack - guaranteed.length`
//     (typically 2) entries from `variable_pool` weighted by `weight`.
//   - Empty pool / weights sum to 0 / pool malformed → fill the variable
//     slots with `{ type: 'none', label: 'No ganaste' }`. Never throw.
//   - Crypto-strong RNG by default (`node:crypto` randomInt). Tests inject
//     a mock by passing a second arg.
//   - Result is validated via `packResultSchema.parse` before returning
//     (defence in depth — catches bad config from prize_sets table).

import { randomInt } from "node:crypto";
import { packResultSchema } from "./schemas";
import {
  PACK_VERSION_CURRENT,
  type PackResult,
  type Prize,
  type VariablePoolEntry,
} from "./types";

/**
 * Shape we accept for resolution. Decoupled from Prisma so the resolver is
 * trivially unit-testable (no DB models in the call site).
 */
export interface PrizeSetData {
  guaranteed: Prize[];
  variable_pool: VariablePoolEntry[];
  cards_per_pack: number;
}

/**
 * RNG contract: returns a float in [0, 1).
 * Default uses `randomInt` from `node:crypto`. Math.random is BANNED here
 * (AGENTS.md §8 — no client-side entropy, no predictable PRNGs server-side).
 */
export type Rng = () => number;

const RANDOM_INT_RANGE = 2 ** 31;

export const defaultRng: Rng = () => randomInt(0, RANDOM_INT_RANGE) / RANDOM_INT_RANGE;

const NONE_CARD: Prize = { type: "none", label: "No ganaste" };

/**
 * Sample one entry from `pool` weighted by `weight`. Returns `null` if the
 * pool is empty, weights sum to zero, or weights are otherwise unusable.
 * Never throws — caller substitutes `NONE_CARD` instead.
 */
function sampleWeighted(
  pool: VariablePoolEntry[],
  rng: Rng,
): Prize | null {
  if (!Array.isArray(pool) || pool.length === 0) {
    return null;
  }

  let total = 0;
  for (const entry of pool) {
    if (
      entry &&
      typeof entry.weight === "number" &&
      Number.isFinite(entry.weight) &&
      entry.weight > 0
    ) {
      total += entry.weight;
    }
  }

  if (total <= 0) {
    return null;
  }

  // rng() ∈ [0,1) → roll ∈ [0, total)
  const roll = rng() * total;
  let cumulative = 0;
  for (const entry of pool) {
    if (
      !entry ||
      typeof entry.weight !== "number" ||
      !Number.isFinite(entry.weight) ||
      entry.weight <= 0
    ) {
      continue;
    }
    cumulative += entry.weight;
    if (roll < cumulative) {
      return entry.prize;
    }
  }

  // Floating-point fallback: pick the last positive-weight entry.
  for (let i = pool.length - 1; i >= 0; i--) {
    const entry = pool[i];
    if (
      entry &&
      typeof entry.weight === "number" &&
      Number.isFinite(entry.weight) &&
      entry.weight > 0
    ) {
      return entry.prize;
    }
  }
  return null;
}

/**
 * Variant of `sampleWeighted` that also returns the chosen index so callers
 * implementing draw-without-replacement can splice the entry out of the pool.
 */
function sampleWeightedIndex(
  pool: VariablePoolEntry[],
  rng: Rng,
): { prize: Prize; index: number } | null {
  if (!Array.isArray(pool) || pool.length === 0) {
    return null;
  }

  let total = 0;
  for (const entry of pool) {
    if (
      entry &&
      typeof entry.weight === "number" &&
      Number.isFinite(entry.weight) &&
      entry.weight > 0
    ) {
      total += entry.weight;
    }
  }

  if (total <= 0) {
    return null;
  }

  const roll = rng() * total;
  let cumulative = 0;
  for (let i = 0; i < pool.length; i++) {
    const entry = pool[i];
    if (
      !entry ||
      typeof entry.weight !== "number" ||
      !Number.isFinite(entry.weight) ||
      entry.weight <= 0
    ) {
      continue;
    }
    cumulative += entry.weight;
    if (roll < cumulative) {
      return { prize: entry.prize, index: i };
    }
  }

  for (let i = pool.length - 1; i >= 0; i--) {
    const entry = pool[i];
    if (
      entry &&
      typeof entry.weight === "number" &&
      Number.isFinite(entry.weight) &&
      entry.weight > 0
    ) {
      return { prize: entry.prize, index: i };
    }
  }
  return null;
}

/**
 * Resolve a `PackResult` from a `PrizeSetData`.
 *
 * - Guaranteed slice is copied as-is (order preserved).
 * - Variable slice has `cards_per_pack - guaranteed.length` cards. Each card
 *   is drawn INDEPENDENTLY (with replacement) from the weighted pool, which
 *   matches the brief's expectation and keeps probabilities stable per slot.
 * - Result is validated against `packResultSchema` before return.
 */
export function resolvePack(
  prizeSet: PrizeSetData,
  rng: Rng = defaultRng,
): PackResult {
  const guaranteed: Prize[] = Array.isArray(prizeSet.guaranteed)
    ? prizeSet.guaranteed.map((p) => p)
    : [];

  const cardsPerPack =
    Number.isInteger(prizeSet.cards_per_pack) && prizeSet.cards_per_pack > 0
      ? prizeSet.cards_per_pack
      : guaranteed.length;
  if (guaranteed.length > cardsPerPack) { throw new Error('[resolve] guaranteed.length (' + guaranteed.length + ') exceeds cards_per_pack (' + cardsPerPack + ')'); }
  const variableSlots = Math.max(0, cardsPerPack - guaranteed.length);

  const pool = Array.isArray(prizeSet.variable_pool) ? prizeSet.variable_pool : [];
  // Sample WITHOUT replacement so a single pack never shows two visibly
  // identical cards (UX issue: live Diamante reveal duplicated 'Defensor de
  // hierro'). Each draw still respects the weighted distribution among the
  // remaining entries. If the caller asks for more slots than pool entries we
  // overflow back into a fresh copy of the pool (with replacement) so we never
  // silently truncate the variable slice.
  let remaining: VariablePoolEntry[] = [...pool];
  const variable: Prize[] = [];
  for (let i = 0; i < variableSlots; i++) {
    if (remaining.length === 0) {
      remaining = [...pool];
    }
    const sampled = sampleWeightedIndex(remaining, rng);
    if (sampled === null) {
      variable.push(NONE_CARD);
      continue;
    }
    variable.push(sampled.prize);
    remaining.splice(sampled.index, 1);
  }

  const result: PackResult = {
    guaranteed,
    variable,
    pack_version: PACK_VERSION_CURRENT,
  };

  // Defence in depth — if a prize_set row has bad shape we still want to fail
  // loudly on the SERVER (caught by the endpoint and mapped to a generic
  // error), never silently return garbage to the client.
  return packResultSchema.parse(result);
}
