// Zod schemas mirroring 1:1 the types in `lib/prizes/types.ts`.
// Validate every external input at the boundary (AGENTS.md §8).

import { z } from "zod";
import type {
  EnvelopeTier,
  Prize,
  PackResult,
  VariablePoolEntry,
} from "./types";

export const envelopeTierSchema: z.ZodType<EnvelopeTier> = z.enum([
  "bronce",
  "plata",
  "oro",
  "platino",
]);

const currencySchema = z.union([z.literal("USD"), z.literal("GTQ")]);

export const sportsCreditPrizeSchema = z.object({
  type: z.literal("sports_credit"),
  amount: z.number().positive(),
  currency: currencySchema,
  label: z.string().min(1),
});

export const casinoSpinsPrizeSchema = z.object({
  type: z.literal("casino_spins"),
  count: z.number().int().positive(),
  game_name: z.string().min(1),
  label: z.string().min(1),
});

export const depositMatchPrizeSchema = z.object({
  type: z.literal("deposit_match"),
  multiplier: z.number().positive(),
  extras: z.string().min(1).optional(),
  label: z.string().min(1),
});

export const physicalPrizeSchema = z.object({
  type: z.literal("physical"),
  sku: z.string().min(1),
  category: z.enum([
    "cinema_combo",
    "jersey_local",
    "jersey_intl",
    "selecta_merch",
    "motorcycle",
    "other",
  ]),
  label: z.string().min(1),
  redemption_instructions: z.string().min(1),
});

export const externalCodePrizeSchema = z.object({
  type: z.literal("external_code"),
  provider: z.string().min(1),
  label: z.string().min(1),
});

// `collectible_id` must be lowercase kebab-style: [a-z0-9-] so it travels
// safely through JSON, URLs and DOM ids without escaping or collision risk.
export const COLLECTIBLE_ID_REGEX = /^[a-z0-9-]+$/;

// `image_url` accepts:
//   - Absolute URL (http(s)://...) — for CDN-hosted artwork.
//   - Root-relative path (/assets/cartas/...) — for files served by
//     Next.js out of /public/. This is the canonical form for the MVP.
// We deliberately do NOT accept bare relative paths (`assets/x.png`),
// protocol-relative URLs (`//foo`), `data:` URIs, or anything that would
// confuse `next/image`.
const imageUrlSchema = z
  .string()
  .min(1)
  .refine(
    (s) => s.startsWith("/") || /^https?:\/\//.test(s),
    "image_url must be an absolute URL or a root-relative path",
  );

export const collectiblePrizeSchema = z.object({
  type: z.literal("collectible"),
  collectible_id: z.string().min(1).regex(COLLECTIBLE_ID_REGEX),
  label: z.string().min(1),
  rarity: z.enum(["common", "rare", "epic", "legendary"]),
  image_url: imageUrlSchema.optional(),
});

export const nonePrizeSchema = z.object({
  type: z.literal("none"),
  label: z.string().min(1),
});

export const prizeSchema: z.ZodType<Prize> = z.discriminatedUnion("type", [
  sportsCreditPrizeSchema,
  casinoSpinsPrizeSchema,
  depositMatchPrizeSchema,
  physicalPrizeSchema,
  externalCodePrizeSchema,
  collectiblePrizeSchema,
  nonePrizeSchema,
]);

export const variablePoolEntrySchema: z.ZodType<VariablePoolEntry> = z.object({
  prize: prizeSchema,
  weight: z.number().nonnegative(),
});

export const packResultSchema: z.ZodType<PackResult> = z.object({
  guaranteed: z.array(prizeSchema),
  variable: z.array(prizeSchema),
  pack_version: z.string().min(1),
});
