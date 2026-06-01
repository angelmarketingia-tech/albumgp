"use client";

// Next.js conventional error boundary for the (root) segment. Renders when a
// nested route throws during render/data fetch. The root layout still wraps
// this; for layout-level crashes see `app/global-error.tsx`.

import Link from "next/link";
import { useEffect, type JSX } from "react";

import { Logo } from "@/components/brand/Logo";
import { LEGAL_NOTICES } from "@/lib/brand/constants";

export interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({
  error,
  reset,
}: ErrorBoundaryProps): JSX.Element {
  // Structured log so the platform's log aggregator can index by `digest`
  // (the same id Next.js surfaces to the user) and join with server traces.
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: "error",
        event: "render.boundary",
        digest: error.digest,
        message: error.message,
      }),
    );
  }, [error]);

  return (
    <div
      data-error-boundary
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
            Algo no salió como esperábamos
          </h1>
          <p className="mt-3 text-base text-white/80">
            Intentá de nuevo o volvé al inicio.
          </p>

          <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-12 items-center justify-center rounded-md bg-gp-gold-gradient px-6 font-sans font-bold uppercase tracking-wide text-gp-green-deep shadow-gold-glow transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gp-green-deep"
            >
              Reintentar
            </button>
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center rounded-md border border-white/30 px-6 font-sans font-bold uppercase tracking-wide text-gp-white transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gp-green-deep"
            >
              Ir al inicio
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
