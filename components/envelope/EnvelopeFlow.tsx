"use client";

import { useEffect, useState } from "react";
import type { JSX, ReactNode } from "react";

import { Card } from "@/components/cards/Card";

import type { PackResult } from "@/lib/prizes/types";

/**
 * Coreografía pura: presentar las 5 cartas del pack con animación de
 * entrada en cascada y mostrar los CTAs cuando termina.
 *
 * Implementado con CSS keyframes + Framer Motion (en Card). Si Framer
 * Motion no hidrata, las cartas igual se ven (el flip 3D no, pero el
 * resto de la composición está). Si el cliente sí hidrata, además se
 * muestra una "intro" del sobre rebotando dorado antes del reveal.
 *
 * NO bloquea el contenido bajo `opacity:0` esperando a JS. El servidor
 * envía las cartas visibles; las animaciones son enhancements.
 */

export interface EnvelopeFlowProps {
  pack: PackResult;
  country: "SV" | "GT";
  ctaSlot: ReactNode;
  /** Salta la intro (útil en tests). */
  skipAnimation?: boolean;
}

const REVEAL_STEP_MS = 180;
const REVEAL_DURATION_MS = 600;
const INTRO_MS = 900;

export function EnvelopeFlow({
  pack,
  country,
  ctaSlot,
  skipAnimation = false,
}: EnvelopeFlowProps): JSX.Element {
  // Tres etapas: intro (sobre dorado pulsante), revealing (cartas
  // apareciendo en cascada), done (CTAs visibles).
  const [stage, setStage] = useState<"intro" | "revealing" | "done">(
    skipAnimation ? "done" : "intro",
  );

  useEffect(() => {
    if (skipAnimation) return;

    const t1 = setTimeout(() => {
      setStage("revealing");
    }, INTRO_MS);

    const items = pack.guaranteed.length + pack.variable.length;
    const totalReveal = items * REVEAL_STEP_MS + REVEAL_DURATION_MS;

    const t2 = setTimeout(() => {
      setStage("done");
    }, INTRO_MS + totalReveal);

    return (): void => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [skipAnimation, pack.guaranteed.length, pack.variable.length]);

  const items = [
    ...pack.guaranteed.map((prize, i) => ({
      prize,
      guaranteed: true,
      key: `g-${i}`,
    })),
    ...pack.variable.map((prize, i) => ({
      prize,
      guaranteed: false,
      key: `v-${i}`,
    })),
  ];

  return (
    <div data-envelope-flow data-stage={stage} data-country={country}>
      {/* Intro: sobre dorado pulsante. Se desvanece al pasar a revealing. */}
      <div
        aria-hidden={stage !== "intro"}
        className={`mb-8 flex justify-center transition-all duration-700 ${
          stage === "intro"
            ? "max-h-96 opacity-100"
            : "pointer-events-none max-h-0 opacity-0"
        }`}
      >
        <div
          className="relative flex h-64 w-48 items-center justify-center rounded-2xl border-2 border-gp-gold bg-gp-radial shadow-[0_0_60px_12px_rgba(212,160,23,0.6)] sm:h-72 sm:w-56"
          style={{
            animation: "envelope-shake 900ms ease-in-out both",
          }}
        >
          <div className="text-center">
            <p className="font-display text-xl font-bold uppercase tracking-widest text-gp-white">
              GanaPlay
            </p>
            <p className="mt-2 font-display text-xs italic text-gp-gold">
              Álbum oficial 2026
            </p>
          </div>
          {/* Halo dorado adicional */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-3 rounded-2xl"
            style={{
              boxShadow:
                "0 0 60px 12px rgba(212,160,23,0.45), 0 0 120px 24px rgba(212,160,23,0.25)",
              animation: "envelope-glow 900ms ease-in-out both",
            }}
          />
        </div>
      </div>

      {/* Cartas: SIEMPRE visibles desde SSR. La cascada de aparición se
          aplica via CSS keyframes con animation-delay por índice. */}
      <div
        data-pack-reveal="true"
        data-card-count={items.length}
        className="grid grid-cols-1 justify-items-center gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
      >
        {items.map((item, i) => {
          const delayMs = i * REVEAL_STEP_MS;
          const cardDelay = stage === "intro" ? delayMs : 0;
          return (
            <div
              key={item.key}
              className="flex flex-col items-center"
              style={{
                animation: `card-rise ${REVEAL_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1) ${
                  stage === "done" ? 0 : delayMs
                }ms both`,
                opacity: stage === "intro" ? 0 : 1,
              }}
            >
              {item.guaranteed ? (
                <span className="mb-2 inline-flex items-center rounded-sm bg-gp-gold-gradient px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wide text-gp-white shadow-sm">
                  Garantizado
                </span>
              ) : null}
              <Card prize={item.prize} revealed delay={cardDelay} size="md" />
            </div>
          );
        })}
      </div>

      {/* CTAs: visibles desde SSR (stage="intro" por default los esconde
          si JS hidrata, pero re-aparecen al pasar a "done"). Si JS NO
          hidrata, stage queda en "intro" pero la página igual recibe los
          links porque están en el árbol HTML. */}
      <div
        className={`mt-10 transition-all duration-500 ${
          stage === "done"
            ? "max-h-96 opacity-100"
            : "max-h-96 opacity-0 sm:opacity-0"
        }`}
        // Anti-fallback: aunque opacity sea 0, los links siguen siendo
        // clickeables. Si JS NO hidrata, stage="intro" => opacity 0. Para
        // evitar dejar al usuario sin botones, fuerza visibilidad despues
        // del tiempo total esperado vía CSS animation forwards.
        style={{
          animation: skipAnimation
            ? undefined
            : `cta-appear 500ms ease-out ${
                INTRO_MS +
                items.length * REVEAL_STEP_MS +
                REVEAL_DURATION_MS
              }ms forwards`,
        }}
      >
        {ctaSlot}
      </div>

      {/* Keyframes inline para que no dependan de Tailwind config. */}
      <style>{`
        @keyframes envelope-shake {
          0% { transform: scale(0.85) rotate(0deg); opacity: 0; }
          15% { transform: scale(1) rotate(-3deg); opacity: 1; }
          30% { transform: scale(1.05) rotate(4deg); }
          45% { transform: scale(1) rotate(-3deg); }
          60% { transform: scale(1.05) rotate(3deg); }
          75% { transform: scale(1) rotate(-1.5deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes envelope-glow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes card-rise {
          0% { transform: translateY(40px) scale(0.92); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes cta-appear {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-envelope-flow] *[style*="animation"] {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default EnvelopeFlow;
