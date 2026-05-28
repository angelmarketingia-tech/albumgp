"use client";

import { useEffect, useRef } from "react";
import type { JSX } from "react";

import type { PackResult, Prize } from "@/lib/prizes/types";

import { Card } from "@/components/cards/Card";

/**
 * Reveal de las 5 cartas del sobre (3 garantizadas + 2 variables).
 *
 * - Layout responsivo, mobile-first: 1 columna en mobile, 2-3 en tablet,
 *   hasta 5 en desktop ancho.
 * - Cada carta entra con `delay = i * REVEAL_STEP_MS`, ya revelada
 *   (`revealed=true`) — la página padre decide cuándo montar este
 *   componente (típicamente tras la animación del sobre).
 * - Las 3 garantizadas llevan un badge "GARANTIZADO" arriba (acento
 *   dorado puntual, autorizado por el líder).
 * - `onAllRevealed` se dispara cuando la última animación termina. Se
 *   estima como `cards.length * REVEAL_STEP_MS + REVEAL_DURATION_MS`.
 *
 * NO contiene lógica de fetch ni de estado del código. La página padre
 * (Frontend Ola 2) le pasa el `PackResult` ya resuelto por `/api/open`.
 */

const REVEAL_STEP_MS = 150;
const REVEAL_DURATION_MS = 500;

export interface PackRevealProps {
  pack: PackResult;
  onAllRevealed?: () => void;
}

type RevealItem = {
  prize: Prize;
  guaranteed: boolean;
};

function GuaranteedBadge(): JSX.Element {
  return (
    <span
      data-guaranteed-badge
      className="mb-2 inline-flex items-center rounded-sm bg-gp-gold-gradient px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wide text-gp-white shadow-sm"
    >
      Garantizado
    </span>
  );
}

export function PackReveal({
  pack,
  onAllRevealed,
}: PackRevealProps): JSX.Element {
  const items: RevealItem[] = [
    ...pack.guaranteed.map((prize) => ({ prize, guaranteed: true })),
    ...pack.variable.map((prize) => ({ prize, guaranteed: false })),
  ];

  const firedRef = useRef(false);

  useEffect(() => {
    if (onAllRevealed === undefined) return;
    if (firedRef.current) return;
    if (items.length === 0) return;

    const totalMs = items.length * REVEAL_STEP_MS + REVEAL_DURATION_MS;
    const timer = setTimeout(() => {
      firedRef.current = true;
      onAllRevealed();
    }, totalMs);

    return (): void => {
      clearTimeout(timer);
    };
    // Re-run if the pack identity changes; `items.length` is the stable
    // proxy. `onAllRevealed` is the caller's responsibility to memoize.
  }, [items.length, onAllRevealed]);

  return (
    <div
      data-pack-reveal
      data-card-count={items.length}
      className="grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
    >
      {items.map((item, i) => (
        <div
          key={`${item.prize.type}-${i}`}
          className="flex flex-col items-center"
        >
          {item.guaranteed ? <GuaranteedBadge /> : null}
          <Card
            prize={item.prize}
            revealed={true}
            delay={i * REVEAL_STEP_MS}
            size="md"
          />
        </div>
      ))}
    </div>
  );
}

export default PackReveal;
