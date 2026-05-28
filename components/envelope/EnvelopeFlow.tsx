"use client";

import { useCallback, useState } from "react";
import type { JSX, ReactNode } from "react";

import { EnvelopeOpening } from "./EnvelopeOpening";
import { PackReveal } from "./PackReveal";

import type { PackResult } from "@/lib/prizes/types";

/**
 * Wrapper client que secuencia: apertura del sobre -> reveal de cartas ->
 * mostrado de CTAs (canjear / depositos).
 *
 * Server-only siblings (botones link) se pasan via `ctaSlot` para que la
 * pagina pueda mantenerlos como server components — este wrapper solo
 * decide *cuando* mostrarlos.
 */

export interface EnvelopeFlowProps {
  pack: PackResult;
  country: "SV" | "GT";
  /** CTAs (canjear, depositos) renderizados por el padre. Se muestran al final. */
  ctaSlot: ReactNode;
  /** Salta ambas animaciones (util en tests). */
  skipAnimation?: boolean;
}

type Phase = "opening" | "revealing" | "done";

export function EnvelopeFlow({
  pack,
  country,
  ctaSlot,
  skipAnimation = false,
}: EnvelopeFlowProps): JSX.Element {
  const initialPhase: Phase = skipAnimation ? "done" : "opening";
  const [phase, setPhase] = useState<Phase>(initialPhase);

  const handleOpened = useCallback(() => {
    setPhase("revealing");
  }, []);

  const handleAllRevealed = useCallback(() => {
    setPhase("done");
  }, []);

  return (
    <div data-envelope-flow data-phase={phase}>
      {phase === "opening" ? (
        <EnvelopeOpening
          country={country}
          onOpened={handleOpened}
          skipAnimation={skipAnimation}
        />
      ) : null}

      {phase !== "opening" ? (
        <PackReveal pack={pack} onAllRevealed={handleAllRevealed} />
      ) : null}

      {phase === "done" ? <div className="mt-10">{ctaSlot}</div> : null}
    </div>
  );
}

export default EnvelopeFlow;
