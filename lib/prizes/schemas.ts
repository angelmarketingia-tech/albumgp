// Zod schemas mirroring 1:1 the types in `lib/prizes/types.ts`.
// Validate every external input at the boundary (AGENTS.md §8).

import { z } from "zod";
import type {
  Prize,
  PackResult,
  VariablePoolEntry,
} from "./types";

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
  label: z.string().min(1),
  redemption_instructions: z.string().min(1),
});

export const externalCodePrizeSchema = z.object({
  type: z.literal("external_code"),
  provider: z.string().min(1),
  label: z.string().min(1),
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
