"use client";

// Client component: code input form for the entry page.
//
// Uses the rich primitives from Diseño Ola 1 (CodeInput + ActionButton).
// Logic is the same as the previous placeholder version — only the
// presentation primitives changed.
//
// Behavior (AGENTS.md §3, SECURITY.md §2 + §5):
//   - Normalize on submit with `normalizeCode` from lib/prizes/input-schemas
//     (the canonical Zod-aligned normalizer). The CodeInput component
//     itself sanitizes char-by-char, but we re-normalize defensively before
//     the network call.
//   - POST `{ code }` to `/api/open`. Any non-200 → render a single generic
//     error message ("Código inválido o no disponible"). We never surface
//     server-detail (no "expired", no "consumed", etc.) — see SECURITY.md §2.
//   - On 200 → push to `/sobre/<code>`. The reveal page re-opens with the
//     same code (opening is idempotent via `pack_result`).

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { normalizeCode } from "@/lib/prizes/input-schemas";
import { CodeInput } from "@/components/ui/CodeInput";
import { ActionButton } from "@/components/ui/ActionButton";

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
  const error =
    status === "error" ? "Código inválido o no disponible" : undefined;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <CodeInput
        value={code}
        onChange={(next) => {
          setCode(next);
          if (status === "error") {
            setStatus("idle");
          }
        }}
        disabled={busy}
        {...(error !== undefined ? { error } : {})}
        autoFocus
      />

      <ActionButton type="submit" variant="primary" size="lg" loading={busy}>
        {busy ? "Abriendo…" : "Abrir sobre"}
      </ActionButton>
    </form>
  );
}

export default EntryForm;
