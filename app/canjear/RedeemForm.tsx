"use client";

// Client form for the redemption confirmation page.
//
// AGENTS.md §3 (canje requiere sesión SSO) + §5 (canje atómico, un solo uso).
// SECURITY.md §2 + §5 (mensaje genérico al usuario).
//
// Behavior:
//   - User confirms by clicking "Confirmar canje". The form POSTs `{ code }`
//     to `/api/redeem`. The server has already authenticated this request
//     via cookies — the form does nothing auth-related itself.
//   - 200 → redirect to `/album?just_redeemed=1` so the album banner can
//     announce success.
//   - Any non-200 → render a single generic error. We never tell the user
//     "ya canjeado" vs "expirado" — SECURITY.md §2.
//   - "Cancelar" uses `router.back()` to preserve the navigation stack
//     (came from /sobre/[code] typically).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  code: string;
}

type Status = "idle" | "submitting" | "error";

export function RedeemForm({ code }: Props): JSX.Element {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [isPending, startTransition] = useTransition();

  async function onConfirm(): Promise<void> {
    if (status === "submitting") {
      return;
    }
    setStatus("submitting");
    try {
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        setStatus("error");
        return;
      }
      startTransition(() => {
        router.push("/album?just_redeemed=1");
      });
    } catch {
      setStatus("error");
    }
  }

  const busy = status === "submitting" || isPending;

  return (
    <div className="flex flex-col gap-3">
      {status === "error" ? (
        <p role="alert" className="text-sm text-red-200">
          No pudimos canjear este código. Probá nuevamente o volvé al inicio.
        </p>
      ) : null}

      <button
        type="button"
        onClick={onConfirm}
        disabled={busy}
        className="rounded bg-gp-gold px-4 py-3 font-semibold text-gp-gray-dark-2 transition-opacity disabled:opacity-60"
      >
        {busy ? "Canjeando…" : "Confirmar canje"}
      </button>

      <button
        type="button"
        onClick={() => router.back()}
        disabled={busy}
        className="rounded border border-white/40 px-4 py-3 text-sm text-white/90 disabled:opacity-60"
      >
        Cancelar
      </button>
    </div>
  );
}

export default RedeemForm;
