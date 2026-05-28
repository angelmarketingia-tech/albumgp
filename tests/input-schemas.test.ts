import { describe, it, expect } from "vitest";
import {
  codeInputSchema,
  normalizeCode,
  CODE_REGEX,
} from "../lib/prizes/input-schemas";

const VALID_EXAMPLES = [
  "ABCDEFGHJKLMNPQR",
  "23456789ABCDEFGH",
  "ZZZZZZZZZZZZZZZZ",
  "2222222222222222",
  "JKLMNPQRSTUVWXYZ",
];

const INVALID_EXAMPLES = [
  "", // empty
  "ABCDEFGHJKLMNPQ", // 15 chars
  "ABCDEFGHJKLMNPQRS", // 17 chars
  "ABCDEFGHJKLMNPQI", // contains I
  "ABCDEFGHJKLMNPQ1", // contains 1
  "ABCDEFGHJKLMNPQO", // contains O
  "ABCDEFGHJKLMNPQ0", // contains 0
  "ABCDEFGH JKLMNPQR", // contains space
  "ABCDEFGH-JKLMNPQR", // contains dash
  "ABCDEFGH_JKLMNPQR", // underscore
  "ABCDEFGH#JKLMNPQR", // symbol
];

describe("CODE_REGEX", () => {
  it("matches all canonical 16-char alphanumerics excluding I/1/0/O", () => {
    for (const c of VALID_EXAMPLES) {
      expect(CODE_REGEX.test(c)).toBe(true);
    }
  });

  it("rejects banned chars and bad lengths", () => {
    for (const c of INVALID_EXAMPLES) {
      // Most of these contain bad chars; some are length errors.
      // Normalization (trim+upper) happens in the Zod schema, not here.
      expect(CODE_REGEX.test(c.toUpperCase().trim())).toBe(false);
    }
  });
});

describe("codeInputSchema", () => {
  it("accepts canonical valid codes", () => {
    for (const code of VALID_EXAMPLES) {
      const res = codeInputSchema.safeParse({ code });
      expect(res.success).toBe(true);
      if (res.success) expect(res.data.code).toBe(code);
    }
  });

  it("normalizes whitespace + lowercase before validating", () => {
    const res = codeInputSchema.safeParse({
      code: "  abcdefghjklmnpqr  ",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.code).toBe("ABCDEFGHJKLMNPQR");
    }
  });

  it("rejects codes containing forbidden chars I/1/0/O", () => {
    expect(codeInputSchema.safeParse({ code: "ABCDEFGHJKLMNPQI" }).success).toBe(false);
    expect(codeInputSchema.safeParse({ code: "ABCDEFGHJKLMNPQ1" }).success).toBe(false);
    expect(codeInputSchema.safeParse({ code: "ABCDEFGHJKLMNPQO" }).success).toBe(false);
    expect(codeInputSchema.safeParse({ code: "ABCDEFGHJKLMNPQ0" }).success).toBe(false);
  });

  it("rejects wrong-length inputs", () => {
    expect(codeInputSchema.safeParse({ code: "ABCDEFGHJKLMNPQ" }).success).toBe(false);
    expect(codeInputSchema.safeParse({ code: "ABCDEFGHJKLMNPQRS" }).success).toBe(false);
    expect(codeInputSchema.safeParse({ code: "" }).success).toBe(false);
  });

  it("rejects payloads missing the `code` field", () => {
    expect(codeInputSchema.safeParse({}).success).toBe(false);
    expect(codeInputSchema.safeParse({ foo: "bar" }).success).toBe(false);
  });

  it("rejects non-string code values", () => {
    expect(codeInputSchema.safeParse({ code: 12345678901234 }).success).toBe(false);
    expect(codeInputSchema.safeParse({ code: null }).success).toBe(false);
  });
});

describe("normalizeCode", () => {
  it("returns canonical form for valid input", () => {
    expect(normalizeCode("  abcdefghjklmnpqr  ")).toBe("ABCDEFGHJKLMNPQR");
    expect(normalizeCode("ABCDEFGHJKLMNPQR")).toBe("ABCDEFGHJKLMNPQR");
    expect(normalizeCode("2222222222222222")).toBe("2222222222222222");
  });

  it("returns null for invalid input", () => {
    expect(normalizeCode("")).toBeNull();
    expect(normalizeCode("ABC")).toBeNull();
    expect(normalizeCode("ABCDEFGHJKLMNPQI")).toBeNull();
    expect(normalizeCode("ABCDEFGHJKLMNPQ1")).toBeNull();
    expect(normalizeCode("ABCDEFGHJKLMNPQO")).toBeNull();
    expect(normalizeCode("ABCDEFGHJKLMNPQ0")).toBeNull();
    expect(normalizeCode("ABCDEFGH JKLMNPQR")).toBeNull();
    expect(normalizeCode("ABCDEFGH-JKLMNPQR")).toBeNull();
  });

  it("returns null for non-string input", () => {
    // @ts-expect-error — runtime guard
    expect(normalizeCode(123)).toBeNull();
    // @ts-expect-error — runtime guard
    expect(normalizeCode(null)).toBeNull();
    // @ts-expect-error — runtime guard
    expect(normalizeCode(undefined)).toBeNull();
  });
});
