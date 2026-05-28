// Zod schemas for inputs coming from the public API (e.g. `/api/open`).
//
// Format decision (closed by lead, Phase 2):
//   `[A-HJ-NP-Z2-9]{16}` — 16-char alphanumeric, EXCLUDING `I/1/0/O` to avoid
//   visual confusion. No dashes. Strict on the regex, but we `.trim()` +
//   `.toUpperCase()` first so users typing "  abcde…" still validate.
//
// AGENTS.md §8: validate every input at the boundary. Server only — do not
// import this from client components (it's safe to import per se, but please
// keep prize logic server-side).

import { z } from "zod";

export const CODE_REGEX = /^[A-HJ-NP-Z2-9]{16}$/;

export const codeInputSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CODE_REGEX, "invalid_format"),
});

export type CodeInput = z.infer<typeof codeInputSchema>;

/**
 * Best-effort normalization for tests / internal callers. Returns the
 * canonical form (`trim` + `toUpperCase`) when it matches the regex, else
 * `null`. Keep this in sync with `codeInputSchema`.
 */
export function normalizeCode(raw: string): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim().toUpperCase();
  return CODE_REGEX.test(trimmed) ? trimmed : null;
}
