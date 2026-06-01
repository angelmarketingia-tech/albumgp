// Root Next.js loading fallback. Kept intentionally minimal so the LCP element
// (the logo) paints fast; per-route loading.tsx files (e.g. /album) override
// this with richer skeletons that mirror their real layouts.

import type { JSX } from "react";

import { Logo } from "@/components/brand/Logo";

export default function Loading(): JSX.Element {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gp-radial px-6"
    >
      <Logo priority width={220} />
      <p className="animate-pulse text-sm tracking-wide text-white/75">
        Preparando…
      </p>
    </main>
  );
}
