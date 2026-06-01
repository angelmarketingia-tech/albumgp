"use client";

import { useCallback } from "react";

// Strip ambiguous chars (I/O/0/1) and spaces/dashes on paste + input.
const ALLOWED = /[A-HJ-NP-Z2-9]/g;

export function CodeInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const clean = useCallback(
    (v: string) => (v.toUpperCase().match(ALLOWED) ?? []).join("").slice(0, 16),
    []
  );
  return (
    <input
      {...props}
      onPaste={(e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text");
        const cleaned = clean(text);
        const t = e.currentTarget;
        t.value = cleaned;
        t.dispatchEvent(new Event("input", { bubbles: true }));
      }}
      onInput={(e) => {
        const t = e.currentTarget;
        const cleaned = clean(t.value);
        if (cleaned !== t.value) t.value = cleaned;
        props.onInput?.(e);
      }}
      inputMode="text"
    />
  );
}
