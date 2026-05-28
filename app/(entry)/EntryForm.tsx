"use client";

// Client component: code input form for the entry page.
//
// Lives in the same route group as the server page so it can be imported
// without leaking any prize/auth logic into the bundle. The server page
// remains a pure RSC.
//
// Behavior (AGENTS.md §3, SECURITY.md §2 + §5):
//   - Normalize on submit with `normalizeCode`. If the format is invalid,
//     show a local error WITHOUT contacting the server (saves rate-limit).
//   - POST `{ code }` to `/api/open`. Any non-200 → render a single generic
//     error message ("Código inválido o no disponible"). We never surface
//     server-detail (no "expired", no "consumed", etc.) — see SECURITY.md §2.
//   - On 200 → push to `/sobre/<code>`. The reveal page re-opens with the
//     same code (opening is idempotent via `pack_result`).

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { normalizeCode } from "@/lib/prizes/input-schemas";

type Status = "idle" | "submitting" | "error";

export function EntryForm(): JSX.Element {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [isPending, startTransition] = useTransition();

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (status === "submitting") {
      return;
    }

    const normalized = normalizeCode(code);
    if (normalized === null) {
      setStatus("error");
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      // Idempotent re-open on the next page reads the same pack_result.
      startTransition(() => {
        router.push(`/sobre/${encodeURIComponent(normalized)}`);
      });
    } catch {
      setStatus("error");
    }
  }

  const busy = status === "submitting" || isPending;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <label htmlFor="code" className="text-sm text-white">
        Código del sobre
      </label>
      <input
        id="code"
        name="code"
        type="text"
        inputMode="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          if (status === "error") {
            setStatus("idle");
          }
        }}
        placeholder="XXXXXXXXXXXXXXXX"
        maxLength={20}
        disabled={busy}
        aria-invalid={status === "error"}
        aria-describedby={status === "error" ? "code-error" : undefined}
        className="w-full rounded bg-white px-4 py-3 font-mono text-lg uppercase tracking-wider text-gp-gray-dark-2 outline-none ring-0 focus:ring-2 focus:ring-gp-gold disabled:opacity-60"
      />

      {status === "error" ? (
        <p
          id="code-error"
          role="alert"
          className="text-sm text-red-200"
        >
          Código inválido o no disponible
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded bg-gp-gold px-4 py-3 font-semibold text-gp-gray-dark-2 transition-opacity disabled:opacity-60"
      >
        {busy ? "Abriendo…" : "Abrir sobre"}
      </button>
    </form>
  );
}

export default EntryForm;
