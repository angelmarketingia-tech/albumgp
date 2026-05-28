"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import type { ChangeEvent, JSX } from "react";

/**
 * Input controlado para el código de un solo uso.
 *
 * Reglas de normalización (Manual §5: códigos largos, aleatorios, sin
 * ambigüedad visual):
 *  - Trim, uppercase.
 *  - Solo `[A-HJ-NP-Z2-9]` (descartamos `I`, `O`, `0`, `1` para evitar
 *    confusiones entre `1/I/l` y `0/O`).
 *  - Sin espacios en `value` (máx 16 chars).
 *  - Display visual con un espacio cada 4 chars: `XXXX XXXX XXXX XXXX`.
 *
 * NO valida la estructura del código contra el servidor — eso vive en
 * `/api/open` (server-side, ya implementado). Aquí solo limpiamos input.
 */

const ALLOWED_CHARS = /[A-HJ-NP-Z2-9]/g;
const MAX_LENGTH = 16;
const GROUP_SIZE = 4;

export interface CodeInputProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  error?: string;
  autoFocus?: boolean;
}

export function normalizeCode(raw: string): string {
  const upper = raw.trim().toUpperCase();
  const matched = upper.match(ALLOWED_CHARS);
  if (matched === null) return "";
  return matched.join("").slice(0, MAX_LENGTH);
}

export function formatCodeForDisplay(normalized: string): string {
  const groups: string[] = [];
  for (let i = 0; i < normalized.length; i += GROUP_SIZE) {
    groups.push(normalized.slice(i, i + GROUP_SIZE));
  }
  return groups.join(" ");
}

export function CodeInput({
  value,
  onChange,
  disabled = false,
  error,
  autoFocus = false,
}: CodeInputProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const errorId = useId();

  const display = useMemo(() => formatCodeForDisplay(value), [value]);

  useEffect(() => {
    if (autoFocus && inputRef.current !== null) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const next = normalizeCode(e.target.value);
    if (next !== value) {
      onChange(next);
    }
  };

  const hasError = typeof error === "string" && error.length > 0;

  const baseInputCls =
    "w-full rounded-md bg-gp-white px-4 py-3 text-center font-mono text-lg uppercase tracking-[0.3em] text-gp-gray-dark-2 placeholder:text-gp-gray-light focus:outline-none focus:ring-2 focus:ring-gp-gold disabled:cursor-not-allowed disabled:opacity-60 sm:text-xl";

  const borderCls = hasError
    ? "border-2 border-red-300"
    : "border-2 border-gp-green";

  return (
    <div className="flex w-full flex-col gap-2">
      <input
        ref={inputRef}
        type="text"
        inputMode="text"
        autoComplete="one-time-code"
        autoCapitalize="characters"
        spellCheck={false}
        aria-label="Código de canje"
        aria-invalid={hasError ? true : undefined}
        aria-describedby={hasError ? errorId : undefined}
        placeholder="XXXX XXXX XXXX XXXX"
        value={display}
        disabled={disabled}
        onChange={handleChange}
        data-has-error={hasError ? "true" : "false"}
        className={`${baseInputCls} ${borderCls}`}
      />
      {hasError ? (
        <p
          id={errorId}
          role="alert"
          className="font-sans text-sm text-red-300"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default CodeInput;
