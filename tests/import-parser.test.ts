import { describe, it, expect } from "vitest";
import {
  parseCsv,
  parseJson,
  parseByExtension,
} from "../scripts/import-parser";

const UUID_SV = "11111111-1111-4111-8111-111111111111";
const UUID_GT = "22222222-2222-4222-8222-222222222222";

// Canonical 16-char codes: [A-HJ-NP-Z2-9] (no I, O, 0, 1). These must match
// CODE_REGEX in lib/prizes/input-schemas.ts or the parser rejects them.
const CODE_A = "ABCDEFGHJKLMNPQR";
const CODE_B = "STUVWXYZ23456789";

describe("parseCsv", () => {
  it("accepts a valid file", () => {
    const csv =
      `code,country,prize_set_id\n` +
      `${CODE_A},SV,${UUID_SV}\n` +
      `${CODE_B},GT,${UUID_GT}\n`;
    const r = parseCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.duplicatesInFile).toEqual([]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toEqual({
      code: CODE_A,
      country: "SV",
      prize_set_id: UUID_SV,
    });
  });

  it("rejects missing required columns", () => {
    const csv = `code,country\n${CODE_A},SV\n`;
    const r = parseCsv(csv);
    expect(r.errors.length).toBeGreaterThan(0);
    expect(r.errors[0]?.message).toMatch(/prize_set_id/);
    expect(r.rows).toHaveLength(0);
  });

  it("rejects invalid country", () => {
    const csv =
      `code,country,prize_set_id\n` +
      `${CODE_A},US,${UUID_SV}\n`;
    const r = parseCsv(csv);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]?.line).toBe(2);
    expect(r.rows).toHaveLength(0);
  });

  it("rejects too-short code", () => {
    const csv =
      `code,country,prize_set_id\n` +
      `SHORT,SV,${UUID_SV}\n`;
    const r = parseCsv(csv);
    expect(r.errors).toHaveLength(1);
    expect(r.rows).toHaveLength(0);
  });

  it("rejects non-uuid prize_set_id", () => {
    const csv =
      `code,country,prize_set_id\n` +
      `${CODE_A},SV,not-a-uuid\n`;
    const r = parseCsv(csv);
    expect(r.errors).toHaveLength(1);
    expect(r.rows).toHaveLength(0);
  });

  it("flags in-file duplicate codes", () => {
    const csv =
      `code,country,prize_set_id\n` +
      `${CODE_A},SV,${UUID_SV}\n` +
      `${CODE_A},GT,${UUID_GT}\n`;
    const r = parseCsv(csv);
    expect(r.rows).toHaveLength(1);
    expect(r.duplicatesInFile).toHaveLength(1);
    expect(r.duplicatesInFile[0]?.code).toBe(CODE_A);
  });

  it("tolerates blank lines and trailing whitespace", () => {
    const csv =
      `code,country,prize_set_id\n` +
      `\n` +
      `${CODE_A} ,SV, ${UUID_SV}\n`;
    const r = parseCsv(csv);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(1);
  });

  it("reports empty file", () => {
    const r = parseCsv("");
    expect(r.errors[0]?.message).toMatch(/Empty/);
  });
});

describe("parseJson", () => {
  it("accepts valid array", () => {
    const json = JSON.stringify([
      { code: CODE_A, country: "SV", prize_set_id: UUID_SV },
      { code: CODE_B, country: "GT", prize_set_id: UUID_GT },
    ]);
    const r = parseJson(json);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(2);
  });

  it("rejects malformed JSON", () => {
    const r = parseJson("{not json");
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]?.message).toMatch(/Invalid JSON/);
  });

  it("rejects non-array root", () => {
    const r = parseJson(JSON.stringify({ code: "x" }));
    expect(r.errors[0]?.message).toMatch(/array/);
  });

  it("reports row-level errors with index", () => {
    const json = JSON.stringify([
      { code: CODE_A, country: "SV", prize_set_id: UUID_SV },
      { code: "short", country: "SV", prize_set_id: UUID_SV },
      { code: CODE_B, country: "AR", prize_set_id: UUID_GT },
    ]);
    const r = parseJson(json);
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0]?.line).toBe(2);
    expect(r.errors[1]?.line).toBe(3);
  });

  it("flags in-file duplicates", () => {
    const json = JSON.stringify([
      { code: CODE_A, country: "SV", prize_set_id: UUID_SV },
      { code: CODE_A, country: "SV", prize_set_id: UUID_SV },
    ]);
    const r = parseJson(json);
    expect(r.rows).toHaveLength(1);
    expect(r.duplicatesInFile).toHaveLength(1);
  });
});

describe("parseByExtension", () => {
  it("routes .csv to CSV parser", () => {
    const csv =
      `code,country,prize_set_id\n` +
      `${CODE_A},SV,${UUID_SV}\n`;
    expect(parseByExtension("batch.csv", csv).rows).toHaveLength(1);
  });

  it("routes .json to JSON parser", () => {
    const json = JSON.stringify([
      { code: CODE_A, country: "SV", prize_set_id: UUID_SV },
    ]);
    expect(parseByExtension("batch.json", json).rows).toHaveLength(1);
  });

  it("falls back to JSON when content starts with [", () => {
    const json = JSON.stringify([
      { code: CODE_A, country: "SV", prize_set_id: UUID_SV },
    ]);
    expect(parseByExtension("batch.txt", json).rows).toHaveLength(1);
  });
});
