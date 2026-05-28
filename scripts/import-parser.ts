// Pure parser for code-import files. Separate from the CLI/DB layer so it
// is unit-testable. See `scripts/import-codes.ts` for the entry point.
//
// Accepted inputs:
//   - CSV with header: `code,country,prize_set_id`
//   - JSON: array of `{ code, country, prize_set_id }`
//
// Validation rules:
//   - country ∈ {"SV","GT"}
//   - code length >= 12
//   - prize_set_id must be a UUID

import { z } from "zod";

export type CodeRow = {
  code: string;
  country: "SV" | "GT";
  prize_set_id: string;
};

export type ParseError = {
  line: number; // 1-based; for JSON this is the array index + 1
  message: string;
  raw?: string;
};

export type ParseResult = {
  rows: CodeRow[];
  errors: ParseError[];
  duplicatesInFile: { line: number; code: string }[];
};

export const codeRowSchema: z.ZodType<CodeRow> = z.object({
  code: z.string().trim().min(12, "code must be at least 12 characters"),
  country: z.union([z.literal("SV"), z.literal("GT")]),
  prize_set_id: z.string().uuid("prize_set_id must be a UUID"),
});

const REQUIRED_COLUMNS = ["code", "country", "prize_set_id"] as const;

function splitCsvLine(line: string): string[] {
  // Minimal CSV: no quoted commas. Codes are alphanumeric per AGENTS.md §5.
  return line.split(",").map((c) => c.trim());
}

export function parseCsv(input: string): ParseResult {
  const errors: ParseError[] = [];
  const rows: CodeRow[] = [];
  const seen = new Map<string, number>();
  const duplicates: { line: number; code: string }[] = [];

  const lines = input.split(/\r?\n/);
  if (lines.length === 0 || (lines[0] ?? "").trim() === "") {
    errors.push({ line: 1, message: "Empty file" });
    return { rows, errors, duplicatesInFile: duplicates };
  }

  const header = splitCsvLine(lines[0] ?? "");
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    errors.push({
      line: 1,
      message: `Missing required column(s): ${missing.join(", ")}`,
      raw: lines[0] ?? "",
    });
    return { rows, errors, duplicatesInFile: duplicates };
  }
  const idxCode = header.indexOf("code");
  const idxCountry = header.indexOf("country");
  const idxPrizeSet = header.indexOf("prize_set_id");

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    if (raw.trim() === "") continue;
    const cols = splitCsvLine(raw);
    const candidate: unknown = {
      code: cols[idxCode] ?? "",
      country: cols[idxCountry] ?? "",
      prize_set_id: cols[idxPrizeSet] ?? "",
    };
    const parsed = codeRowSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({
        line: i + 1,
        message: parsed.error.issues
          .map((iss) => `${iss.path.join(".") || "(root)"}: ${iss.message}`)
          .join("; "),
        raw,
      });
      continue;
    }
    const row = parsed.data;
    const prevLine = seen.get(row.code);
    if (prevLine !== undefined) {
      duplicates.push({ line: i + 1, code: row.code });
      continue;
    }
    seen.set(row.code, i + 1);
    rows.push(row);
  }

  return { rows, errors, duplicatesInFile: duplicates };
}

export function parseJson(input: string): ParseResult {
  const errors: ParseError[] = [];
  const rows: CodeRow[] = [];
  const seen = new Map<string, number>();
  const duplicates: { line: number; code: string }[] = [];

  let data: unknown;
  try {
    data = JSON.parse(input);
  } catch (err) {
    errors.push({
      line: 1,
      message: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    });
    return { rows, errors, duplicatesInFile: duplicates };
  }

  if (!Array.isArray(data)) {
    errors.push({ line: 1, message: "JSON root must be an array" });
    return { rows, errors, duplicatesInFile: duplicates };
  }

  for (let i = 0; i < data.length; i++) {
    const entry: unknown = data[i];
    const parsed = codeRowSchema.safeParse(entry);
    const line = i + 1;
    if (!parsed.success) {
      errors.push({
        line,
        message: parsed.error.issues
          .map((iss) => `${iss.path.join(".") || "(root)"}: ${iss.message}`)
          .join("; "),
      });
      continue;
    }
    const row = parsed.data;
    if (seen.has(row.code)) {
      duplicates.push({ line, code: row.code });
      continue;
    }
    seen.set(row.code, line);
    rows.push(row);
  }

  return { rows, errors, duplicatesInFile: duplicates };
}

export function parseByExtension(filename: string, content: string): ParseResult {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".json")) return parseJson(content);
  if (lower.endsWith(".csv")) return parseCsv(content);
  // Heuristic fallback: starts with [ or { → JSON.
  const trimmed = content.trimStart();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) return parseJson(content);
  return parseCsv(content);
}
