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
  ExternalCodePrize,
  CollectiblePrize,
  NonePrize,
  VariablePoolEntry,
  PackResult,
} from "./types";
export { PACK_VERSION_CURRENT } from "./types";

export {
  prizeSchema,
  variablePoolEntrySchema,
  packResultSchema,
} from "./schemas";

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
