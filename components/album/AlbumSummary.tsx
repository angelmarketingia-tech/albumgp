import type { JSX } from "react";

/**
 * Resumen del álbum: cuatro contadores en grilla 2x2 mobile / 4 columnas
 * desktop. Pensado para vivir arriba de la página `/album`.
 *
 * Server component — sin estado, sin handlers. Render puro.
 *
 * Tipografía: número en `font-display` (Fraunces MVP), etiqueta en
 * `font-sans` (DM Sans MVP) en uppercase con tracking.
 */

export interface AlbumSummaryProps {
  total_cards: number;
  unique_collectibles: number;
  real_prizes: number;
  empty: number;
}

interface Cell {
  value: number;
  label: string;
}

function SummaryCell({ value, label }: Cell): JSX.Element {
  // Dim zero values to communicate emptiness; drop gradient text (poor contrast on glass).
  const isZero = value === 0;
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/8 backdrop-blur-xl px-3 py-5 text-center shadow-glass transition-transform hover:scale-[1.02] ${isZero ? "opacity-50" : ""}`}
    >
      <span
        className={`font-display text-4xl font-black leading-none ${isZero ? "text-white/40" : "text-white"}`}
      >
        {value}
      </span>
      <span className="font-sans text-[10px] uppercase tracking-wider text-white/70">
        {label}
      </span>
    </div>
  );
}

export function AlbumSummary({
  total_cards,
  unique_collectibles,
  real_prizes,
  empty,
}: AlbumSummaryProps): JSX.Element {
  const cells: Cell[] = [
    { value: real_prizes, label: "Premios reales" },
    { value: unique_collectibles, label: "Coleccionables" },
    { value: total_cards, label: "Cartas en total" },
    { value: empty, label: "Slots vacíos" },
  ];

  return (
    <section
      aria-label="Resumen del álbum"
      data-album-summary
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
    >
      {cells.map((c) => (
        <SummaryCell key={c.label} value={c.value} label={c.label} />
      ))}
    </section>
  );
}

export default AlbumSummary;
