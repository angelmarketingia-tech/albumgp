// CLI: generate a batch of redemption codes for QA / testing.
//
// IMPORTANT: in production the central GanaPlay platform is the source of truth
// for codes (prizes are already credited account-side). This generator exists
// for LOCAL QA and seeded test batches only — it emits a CSV in the exact shape
// `scripts/import-codes.ts` consumes, so you can round-trip:
//
//   npx tsx scripts/generate-codes.ts --per-tier 5 --out tmp/qa-codes.csv
//   npm run codes:import -- --file tmp/qa-codes.csv
//
// Codes use the canonical alphabet [A-HJ-NP-Z2-9] (no I/O/0/1) and are 16 chars,
// drawn with crypto.randomInt for unbiased, non-guessable values.

import { randomInt } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// Must match CODE_REGEX in lib/prizes/input-schemas.ts exactly.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 chars, no I O 0 1
const CODE_LEN = 16;

// Fixed prize_set UUIDs from prisma/seed.ts (must be seeded first).
const PRIZE_SET_IDS = {
  SV: {
    bronce: "11111111-1111-4111-8111-111111111101",
    plata: "11111111-1111-4111-8111-111111111102",
    oro: "11111111-1111-4111-8111-111111111103",
    platino: "11111111-1111-4111-8111-111111111104",
  },
  GT: {
    bronce: "22222222-2222-4222-8222-222222222201",
    plata: "22222222-2222-4222-8222-222222222202",
    oro: "22222222-2222-4222-8222-222222222203",
    platino: "22222222-2222-4222-8222-222222222204",
  },
} as const;

type Country = keyof typeof PRIZE_SET_IDS;
type Tier = keyof (typeof PRIZE_SET_IDS)["SV"];

const COUNTRIES: Country[] = ["SV", "GT"];
const TIERS: Tier[] = ["bronce", "plata", "oro", "platino"];

function genCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

function parseArgs(argv: readonly string[]): { perTier: number; out: string } {
  let perTier = 5;
  let out = "tmp/qa-codes.csv";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--per-tier") {
      perTier = Number(argv[++i]);
    } else if (a?.startsWith("--per-tier=")) {
      perTier = Number(a.slice("--per-tier=".length));
    } else if (a === "--out") {
      out = argv[++i] ?? out;
    } else if (a?.startsWith("--out=")) {
      out = a.slice("--out=".length);
    }
  }
  if (!Number.isInteger(perTier) || perTier <= 0) {
    throw new Error("--per-tier must be a positive integer");
  }
  return { perTier, out };
}

function main(): void {
  const { perTier, out } = parseArgs(process.argv.slice(2));
  const seen = new Set<string>();
  const lines = ["code,country,prize_set_id"];

  for (const country of COUNTRIES) {
    for (const tier of TIERS) {
      const prizeSetId = PRIZE_SET_IDS[country][tier];
      for (let n = 0; n < perTier; n++) {
        let code = genCode();
        // Guard against the astronomically unlikely collision within a batch.
        while (seen.has(code)) code = genCode();
        seen.add(code);
        lines.push(`${code},${country},${prizeSetId}`);
      }
    }
  }

  const total = seen.size;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, lines.join("\n") + "\n", "utf8");

  // eslint-disable-next-line no-console
  console.log(
    `Generated ${total} codes (${perTier}/tier × ${TIERS.length} tiers × ${COUNTRIES.length} countries) → ${out}`,
  );
}

main();
