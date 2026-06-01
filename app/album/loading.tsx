// Conventional Next.js loading UI for /album.
//
// Mirrors the visual rhythm of app/album/page.tsx (hero band → summary grid →
// rarity shelves) so the layout doesn't reflow when real content swaps in.
// All elements are decorative; the screen-reader announcement carries the
// loading state.

import type { JSX } from "react";

export default function Loading(): JSX.Element {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-5 pb-8 pt-8"
    >
      <span className="sr-only">Cargando tu álbum…</span>

      {/* Hero band — matches the -mx-5 -mt-8 rounded-b-3xl gradient in page.tsx. */}
      <section
        aria-hidden
        className="relative -mx-5 -mt-8 mb-6 h-56 overflow-hidden rounded-b-3xl"
        style={{ backgroundImage: "linear-gradient(160deg,#034419,#001F0C)" }}
      >
        <div className="relative flex h-full flex-col justify-end gap-3 px-6 pb-6 pt-8">
          <div className="h-3 w-24 animate-pulse rounded-full bg-gp-gold/30" />
          <div className="h-8 w-56 animate-pulse rounded-md bg-white/15 sm:h-10 sm:w-72" />
          <div className="h-2 w-full animate-pulse rounded-full bg-white/10" />
        </div>
      </section>

      {/* Summary grid skeleton — 4 cells, 2 cols mobile / 4 cols md+. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`sum-${String(i)}`}
            className="h-28 animate-pulse rounded-2xl border border-white/15 bg-white/5"
          />
        ))}
      </div>

      {/* Rarity shelves — two visible shelves are enough to set rhythm. */}
      <section aria-hidden className="flex flex-col gap-6">
        {Array.from({ length: 2 }).map((_, s) => (
          <div key={`shelf-${String(s)}`} className="flex flex-col gap-3">
            <div className="h-5 w-40 animate-pulse rounded-md bg-white/15" />
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, t) => (
                <div
                  key={`tile-${String(s)}-${String(t)}`}
                  className="aspect-[2/3] animate-pulse rounded-xl border border-white/10 bg-white/5"
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
