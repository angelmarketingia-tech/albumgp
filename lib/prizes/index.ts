// Coherent module surface for the prizes domain.
// Callers (e.g. `/app/api/open`) should import from here, not from individual
// files, so this stays the single source of truth.

export type {
  Prize,
  PrizeType,
  Currency,
  SportsCreditPrize,
  CasinoSpinsPrize,
  DepositMatchPrize,
  PhysicalPrize,
  PhysicalCategory,
  ExternalCodePrize,
  CollectiblePrize,
  NonePrize,
  VariablePoolEntry,
  PackResult,
  EnvelopeTier,
} from "./types";
export { PACK_VERSION_CURRENT, ENVELOPE_TIERS } from "./types";

export {
  prizeSchema,
  variablePoolEntrySchema,
  packResultSchema,
  envelopeTierSchema,
} from "./schemas";

export {
  TIER_THEME,
  formatTier,
  tierFromValue,
  type TierTheme,
} from "./tiers";

export {
  resolvePack,
  defaultRng,
  type PrizeSetData,
  type Rng,
} from "./resolve";

export {
  codeInputSchema,
  normalizeCode,
  CODE_REGEX,
  type CodeInput,
} from "./input-schemas";
