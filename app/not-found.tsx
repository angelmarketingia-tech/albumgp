import Link from "next/link";
import type { JSX } from "react";

import { Logo } from "@/components/brand/Logo";
import { LEGAL_NOTICES } from "@/lib/brand/constants";

// Next.js conventional 404. Server component — no client state needed.
// Mirrors the visual shell of `app/error.tsx` so unknown routes feel like
// part of the same product, not a stock framework page.
export default function NotFound(): JSX.Element {
  return (
    <div
      data-not-found
      className="flex min-h-screen flex-col bg-gp-green-deep text-gp-white"
    >
      <header className="flex flex-col items-center gap-3 px-4 pt-8 text-center">
        <Logo variant="blanco" width={180} priority />
      </header>

      <main
        id="main-content"
        className="flex flex-1 items-center justify-center px-4 py-8"
      >
        <div className="mx-auto w-full max-w-md rounded-2xl border border-white/15 bg-white/8 p-6 text-center shadow-glass backdrop-blur-xl">
          <h1 className="font-display text-3xl font-black text-white sm:text-4xl">
            Esta página no existe
          </h1>
          <p className="mt-3 text-base text-white/80">
            Si llegaste acá por un enlace de un sobre, verificá el código.
          </p>

          <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
            {/* Gold gradient matches SubmitButton — keeps the primary CTA
                visually consistent across forms and standalone links. */}
            <Link
              href="/"
              className="inline-flex h-14 w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#B8860B,#D4A017,#F4D03F)] px-6 font-sans font-black uppercase tracking-wide text-gp-green-deep shadow-gold-glow transition-transform hover:scale-[1.02] active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-gp-white focus-visible:ring-offset-2 focus-visible:ring-offset-gp-green-deep"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-3xl px-4 pb-6 pt-4 text-center text-xs uppercase tracking-[0.3em] text-white/80">
        <span>{LEGAL_NOTICES.ageGate}</span>
        <span aria-hidden className="mx-2">
          ·
        </span>
        <span>{LEGAL_NOTICES.responsibleGaming}</span>
      </footer>
    </div>
  );
}
