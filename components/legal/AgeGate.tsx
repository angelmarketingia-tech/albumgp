"use client";

// Interactive 18+ age gate (store-compliance hardening for a gambling-adjacent
// app — App Store / Play Store expect an actual gate, not only a footer notice).
//
// Behavior:
//   - On first load, if the user hasn't confirmed before, show a blocking modal
//     over the page asking them to confirm they're 18+.
//   - "Sí, soy mayor de 18" → persist and dismiss. "No" → bounce to a neutral
//     exit page (the responsible-gaming info on the main platform).
//   - Persistence: localStorage (primary) so it survives reloads.
//
// Progressive-enhancement note: this is a CLIENT overlay. With JS disabled it
// does not render, and the underlying SSR flow keeps working — the central
// GanaPlay platform already performs the binding age verification at signup;
// this gate is the visible, store-facing confirmation layer. It intentionally
// does NOT block the server-side redeem path (which is gated by SSO).

import { useEffect, useState } from "react";

const STORAGE_KEY = "gp_age_ok_v1";
// Where to send someone who says they're under 18. Responsible-gaming info.
const EXIT_URL = "https://www.jugarbien.es/";

export function AgeGate(): JSX.Element | null {
  // `null` = undecided (don't flash the modal before we read storage).
  const [confirmed, setConfirmed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setConfirmed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // Storage blocked (private mode / cookies off) → show the gate; it just
      // won't persist, which is the safe default.
      setConfirmed(false);
    }
  }, []);

  // Lock body scroll while the gate is open.
  useEffect(() => {
    if (confirmed === false) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
    return undefined;
  }, [confirmed]);

  if (confirmed === null || confirmed === true) {
    return null;
  }

  const accept = (): void => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* non-persistent is acceptable */
    }
    setConfirmed(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-gp-green-deep/95 px-5 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/5 p-6 text-center shadow-glass">
        <p className="text-5xl" aria-hidden>
          🔞
        </p>
        <h2
          id="age-gate-title"
          className="mt-3 font-display text-2xl font-bold text-white"
        >
          ¿Sos mayor de 18 años?
        </h2>
        <p className="mt-2 text-sm text-white/80">
          GanaPlay Álbum es solo para personas mayores de edad. Confirmá tu edad
          para continuar. Jugá responsablemente.
        </p>
        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            onClick={accept}
            className="h-12 min-h-12 w-full rounded-xl bg-[linear-gradient(135deg,#B8860B,#D4A017,#F4D03F)] font-sans text-base font-black uppercase tracking-wide text-gp-green-deep shadow-gold-glow active:scale-[0.97] transition-transform"
          >
            Sí, soy mayor de 18
          </button>
          <a
            href={EXIT_URL}
            rel="noopener noreferrer"
            className="h-12 min-h-12 flex w-full items-center justify-center rounded-xl border border-white/30 text-base font-bold text-white/80 transition-colors hover:bg-white/10"
          >
            No
          </a>
        </div>
      </div>
    </div>
  );
}
