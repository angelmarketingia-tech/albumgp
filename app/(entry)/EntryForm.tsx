"use client";

// Client component: code input form for the entry page.
//
// SIMPLIFIED VERSION for debugging the "click does nothing" report.
// Uses a raw <input> + <button> with explicit console.log breadcrumbs so
// we can see in DevTools exactly which step runs and which fails.
//
// Behavior (AGENTS.md §3, SECURITY.md §2 + §5):
//   - Normalize on submit with `normalizeCode` from lib/prizes/input-schemas.
//   - POST `{ code }` to `/api/open`. Any non-200 → generic error.
//   - On 200 → window.location.assign to /sobre/<code> (full nav, bypasses
//     any router edge case while we hunt down the bug).

import { useState, type FormEvent } from "react";
import { normalizeCode } from "@/lib/prizes/input-schemas";

type Status = "idle" | "submitting" | "error";

export function EntryForm(): JSX.Element {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    // eslint-disable-next-line no-console
    console.log("[EntryForm] submit start, raw code:", code);

    if (status === "submitting") {
      // eslint-disable-next-line no-console
      console.log("[EntryForm] ignoring re-submit while busy");
      return;
    }

    const normalized = normalizeCode(code);
    // eslint-disable-next-line no-console
    console.log("[EntryForm] normalized:", normalized);

    if (normalized === null) {
      // eslint-disable-next-line no-console
      console.log("[EntryForm] normalize -> null, error");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    try {
      // eslint-disable-next-line no-console
      console.log("[EntryForm] POST /api/open");
      const res = await fetch("/api/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      // eslint-disable-next-line no-console
      console.log("[EntryForm] response status:", res.status);

      if (!res.ok) {
        setStatus("error");
        return;
      }

      const target = `/sobre/${encodeURIComponent(normalized)}`;
      // eslint-disable-next-line no-console
      console.log("[EntryForm] navigating to", target);

      // Full navigation — bypasses next/navigation router edge cases that
      // were swallowing the push in dev. The reveal page re-opens
      // idempotently so a second hit doesn't reroll the pack.
      window.location.assign(target);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[EntryForm] fetch failed:", err);
      setStatus("error");
    }
  }

  const busy = status === "submitting";
  const errorMsg =
    status === "error" ? "Código inválido o no disponible" : null;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <input
        name="code"
        type="text"
        autoComplete="one-time-code"
        autoCapitalize="characters"
        spellCheck={false}
        autoFocus
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          if (status === "error") {
            setStatus("idle");
          }
        }}
        disabled={busy}
        placeholder="Pegá tu código aquí"
        aria-label="Código de canje"
        className="w-full rounded-md border-2 border-gp-green bg-gp-white px-4 py-3 text-center font-mono text-lg uppercase tracking-wider text-gp-gray-dark-2 placeholder:text-gp-gray-light focus:outline-none focus:ring-2 focus:ring-gp-gold disabled:cursor-not-allowed disabled:opacity-60 sm:text-xl"
      />

      {errorMsg !== null ? (
        <p role="alert" className="text-sm text-red-300">
          {errorMsg}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-14 items-center justify-center rounded-md bg-gp-white px-7 text-lg font-sans font-bold uppercase tracking-wide text-gp-green transition-colors hover:bg-gp-gray-light/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gp-gold focus-visible:ring-offset-2 focus-visible:ring-offset-gp-green disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Abriendo…" : "Abrir sobre"}
      </button>
    </form>
  );
}

export default EntryForm;
