"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import type { JSX } from "react";

import { Logo } from "@/components/brand/Logo";

/**
 * Animacion de apertura del sobre — precede al `PackReveal`.
 *
 * No usa assets externos: el "sobre" es CSS puro (clip-path para la solapa
 * triangular + gradientes de marca) + Framer Motion para la coreografia.
 *
 * Secuencia (~1.8s):
 *  1.  Fade in + scale del sobre cerrado          (0.0s -> 0.2s)
 *  2.  Shake sutil con sombra dorada pulsante     (0.2s -> 0.6s)
 *  3.  Solapa rota ~120° revelando luz dorada     (0.6s -> 1.1s)
 *  4.  Flash radial dorado expandiendo            (1.1s -> 1.3s)
 *  5.  Fade out del sobre + `onOpened()`          (1.3s -> 1.6s)
 *
 * Accesibilidad:
 *  - `useReducedMotion()` o `skipAnimation` cortan la secuencia y disparan
 *    `onOpened` inmediatamente (un microtask).
 *  - El contenedor expone `role="region"` + `aria-label`.
 */

export interface EnvelopeOpeningProps {
  country: "SV" | "GT";
  onOpened: () => void;
  skipAnimation?: boolean;
}

// Duraciones (ms) — definidas como const para que el test las pueda derivar.
const STEP_APPEAR_MS = 200;
const STEP_SHAKE_MS = 400;
const STEP_FLAP_MS = 500;
const STEP_FLASH_MS = 200;
const STEP_FADE_MS = 300;
const TOTAL_MS =
  STEP_APPEAR_MS + STEP_SHAKE_MS + STEP_FLAP_MS + STEP_FLASH_MS + STEP_FADE_MS;

// Offsets acumulados (ms) — sirven como `delay` de cada subanimacion.
const T_APPEAR_END = STEP_APPEAR_MS;
const T_SHAKE_END = T_APPEAR_END + STEP_SHAKE_MS;
const T_FLAP_END = T_SHAKE_END + STEP_FLAP_MS;
const T_FLASH_END = T_FLAP_END + STEP_FLASH_MS;

// ---------- Particulas doradas (3 elementos, posiciones fijas) ---------------

type Particle = {
  /** Offset radial final en px (x, y). */
  x: number;
  y: number;
  /** Delay relativo al inicio de la fase "flap" en ms. */
  delay: number;
};

const PARTICLES: readonly Particle[] = [
  { x: -60, y: -90, delay: 0 },
  { x: 70, y: -100, delay: 80 },
  { x: 0, y: -120, delay: 160 },
  { x: -90, y: -40, delay: 120 },
  { x: 90, y: -60, delay: 40 },
];

export function EnvelopeOpening({
  country,
  onOpened,
  skipAnimation = false,
}: EnvelopeOpeningProps): JSX.Element {
  const reducedMotion = useReducedMotion() ?? false;
  const shouldSkip = skipAnimation || reducedMotion;
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;

    if (shouldSkip) {
      // Microtask para evitar disparar onOpened durante el commit; el
      // padre suele hacer setState en el callback y React se queja.
      firedRef.current = true;
      const id = setTimeout(() => {
        onOpened();
      }, 0);
      return (): void => {
        clearTimeout(id);
      };
    }

    const id = setTimeout(() => {
      firedRef.current = true;
      onOpened();
    }, TOTAL_MS);
    return (): void => {
      clearTimeout(id);
    };
  }, [shouldSkip, onOpened]);

  if (shouldSkip) {
    // Render minimal — la transicion al `PackReveal` ocurre al instante
    // pero seguimos exponiendo la region para los tests / lectores.
    return (
      <div
        data-envelope-opening
        data-country={country}
        data-skipped="true"
        role="region"
        aria-label="Apertura del sobre"
        className="sr-only"
      >
        Apertura del sobre
      </div>
    );
  }

  return (
    <motion.div
      data-envelope-opening
      data-country={country}
      role="region"
      aria-label="Apertura del sobre"
      className="relative mx-auto flex h-[28rem] w-full max-w-sm items-center justify-center overflow-visible"
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0] }}
      transition={{
        duration: STEP_FADE_MS / 1000,
        delay: T_FLASH_END / 1000,
        times: [0, 0.5, 1],
        ease: "easeOut",
      }}
    >
      {/* ---------- Sobre cerrado: aparece + shake ---------- */}
      <motion.div
        data-envelope-body
        className="relative h-80 w-60 sm:h-96 sm:w-72"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{
          opacity: [0, 1, 1, 1],
          scale: [0.85, 1, 1.02, 1],
          rotate: [0, -1.5, 1.5, -1.2, 1.2, 0],
        }}
        transition={{
          duration: (STEP_APPEAR_MS + STEP_SHAKE_MS) / 1000,
          times: [0, 0.33, 0.66, 1],
          ease: "easeOut",
        }}
      >
        {/* Sombra dorada pulsante */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-4 rounded-2xl"
          style={{
            boxShadow:
              "0 0 60px 12px rgba(212, 160, 23, 0.45), 0 0 120px 24px rgba(212, 160, 23, 0.2)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.4, 0.9, 0.4, 0.9, 0] }}
          transition={{
            duration: (STEP_APPEAR_MS + STEP_SHAKE_MS + STEP_FLAP_MS) / 1000,
            times: [0, 0.18, 0.4, 0.6, 0.8, 1],
            ease: "easeInOut",
          }}
        />

        {/* Cuerpo del sobre — gradiente verde + borde dorado sutil */}
        <div
          data-envelope-shell
          className="absolute inset-0 overflow-hidden rounded-2xl border border-gp-gold/60 bg-gp-radial shadow-2xl"
        >
          {/* Brillo interior diagonal (decorativo) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 45%, rgba(212,160,23,0.12) 100%)",
            }}
          />

          {/* Contenido del sobre: logo + tagline */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <Logo variant="blanco" width={140} />
            <p className="font-display text-sm italic text-gp-white/90">
              Album oficial 2026
            </p>
          </div>

          {/* Linea de "solapa" inferior decorativa */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-16"
            style={{
              background:
                "linear-gradient(180deg, rgba(3,68,25,0) 0%, rgba(3,68,25,0.6) 100%)",
            }}
          />
        </div>

        {/* ---------- Solapa superior triangular — rota hacia atras ---------- */}
        <motion.div
          data-envelope-flap
          aria-hidden
          className="absolute inset-x-0 top-0 h-1/2 origin-bottom"
          style={{
            clipPath: "polygon(0 0, 100% 0, 50% 100%)",
            transformOrigin: "50% 100%",
            background:
              "linear-gradient(180deg, #00783E 0%, #034419 100%)",
            borderTop: "1px solid rgba(212, 160, 23, 0.5)",
          }}
          initial={{ rotateX: 0 }}
          animate={{ rotateX: -125 }}
          transition={{
            duration: STEP_FLAP_MS / 1000,
            delay: T_SHAKE_END / 1000,
            ease: "easeInOut",
          }}
        />

        {/* ---------- Luz dorada interior revelada al abrir ---------- */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-2 h-1/2"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(255, 235, 175, 0.95) 0%, rgba(212, 160, 23, 0.5) 50%, rgba(212, 160, 23, 0) 100%)",
            filter: "blur(4px)",
          }}
          initial={{ opacity: 0, scaleY: 0.6 }}
          animate={{ opacity: [0, 0.9, 0.7], scaleY: [0.6, 1, 1] }}
          transition={{
            duration: STEP_FLAP_MS / 1000,
            delay: T_SHAKE_END / 1000,
            ease: "easeOut",
          }}
        />

        {/* ---------- Particulas doradas saliendo desde el centro ---------- */}
        {PARTICLES.map((p, i) => (
          <motion.span
            key={i}
            data-envelope-particle
            aria-hidden
            className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full"
            style={{
              background:
                "radial-gradient(circle, #FFF3C4 0%, #D4A017 60%, rgba(212,160,23,0) 100%)",
              boxShadow: "0 0 8px 2px rgba(212, 160, 23, 0.7)",
            }}
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
            animate={{
              opacity: [0, 1, 0],
              x: [0, p.x],
              y: [0, p.y],
              scale: [0.4, 1.1, 0.6],
            }}
            transition={{
              duration: (STEP_FLAP_MS + STEP_FLASH_MS) / 1000,
              delay: (T_SHAKE_END + p.delay) / 1000,
              ease: "easeOut",
            }}
          />
        ))}
      </motion.div>

      {/* ---------- Flash radial blanco-dorado expandiendo desde el centro ---------- */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, rgba(255, 250, 220, 0.95) 0%, rgba(255, 220, 130, 0.5) 35%, rgba(212, 160, 23, 0) 70%)",
        }}
        initial={{ opacity: 0, scale: 0.2 }}
        animate={{ opacity: [0, 0.95, 0], scale: [0.2, 1.5, 1.8] }}
        transition={{
          duration: STEP_FLASH_MS / 1000,
          delay: T_FLAP_END / 1000,
          ease: "easeOut",
        }}
      />
    </motion.div>
  );
}

export default EnvelopeOpening;
