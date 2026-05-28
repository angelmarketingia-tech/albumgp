// CLI: bulk-import pre-generated codes (~5.000 per batch) supplied by the
// central platform. Codes are NOT generated here — only imported.
//
// Usage:
//   npm run codes:import -- --file <path-to-csv-or-json>
//
// Accepted formats (see scripts/import-parser.ts for details):
//   - CSV with header: `code,country,prize_set_id`
//   - JSON: array of `{ code, country, prize_set_id }`
//
// Behavior:
//   - Validates every row with Zod.
//   - Inserts via `createMany({ skipDuplicates: true })` in a transaction.
//   - Idempotent: re-running the same file inserts 0 new rows.
//   - Reports total read, inserted, skipped (duplicates) and validation errors.

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { PrismaClient } from "@prisma/client";
import { parseByExtension } from "./import-parser";
import type { CodeRow } from "./import-parser";

type Args = { file: string };

function parseArgs(argv: readonly string[]): Args {
  let file: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file") {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error("--file requires a path argument");
      }
      file = next;
      i++;
    } else if (a !== undefined && a.startsWith("--file=")) {
      file = a.slice("--file=".length);
    }
  }
  if (file === undefined || file === "") {
    throw new Error("Usage: codes:import -- --file <path-to-csv-or-json>");
  }
  return { file };
}

async function run(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const content = readFileSync(args.file, "utf8");
  const parsed = parseByExtension(basename(args.file), content);

  const totalCandidates =
    parsed.rows.length + parsed.errors.length + parsed.duplicatesInFile.length;

  // eslint-disable-next-line no-console
  console.log(`Read: ${totalCandidates} row(s) from ${args.file}`);
  if (parsed.errors.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`Validation errors: ${parsed.errors.length}`);
    for (const e of parsed.errors) {
      // eslint-disable-next-line no-console
      console.log(`  line ${e.line}: ${e.message}`);
    }
  }
  if (parsed.duplicatesInFile.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `In-file duplicates skipped: ${parsed.duplicatesInFile.length}`,
    );
  }

  if (parsed.rows.length === 0) {
    // eslint-disable-next-line no-console
    console.log("Nothing to insert. Inserted=0 Skipped=0.");
    return parsed.errors.length > 0 ? 1 : 0;
  }

  const prisma = new PrismaClient();
  try {
    const dataToInsert = parsed.rows.map((r: CodeRow) => ({
      code: r.code,
      country: r.country,
      prizeSetId: r.prize_set_id,
    }));

    const result = await prisma.$transaction(async (tx) => {
      return tx.code.createMany({
        data: dataToInsert,
        skipDuplicates: true,
      });
    });

    const inserted = result.count;
    const skippedExisting = parsed.rows.length - inserted;

    // eslint-disable-next-line no-console
    console.log(
      `Inserted: ${inserted}. ` +
        `Skipped (already in DB): ${skippedExisting}. ` +
        `In-file duplicates: ${parsed.duplicatesInFile.length}. ` +
        `Errors: ${parsed.errors.length}.`,
    );

    return parsed.errors.length > 0 ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

run()
  .then((code) => {
    process.exit(code);
  })
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  });
