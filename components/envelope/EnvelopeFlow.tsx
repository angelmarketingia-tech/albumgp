"use client";

import { useEffect, useState } from "react";
import type { JSX, ReactNode } from "react";

import { Card } from "@/components/cards/Card";

import type { PackResult, Prize } from "@/lib/prizes/types";

/**
 * Coreografia con suspenso para el reveal del pack.
 *
 * Tiene DOS etapas a nivel pagina, controladas por searchParams:
 *
 *   1. idle      Sin `?reveal=1`. Muestra el sobre cerrado pulsante
 *                con un <a href='?reveal=1'> nativo. Cero JS necesario.
 *   2. revealing Con `?reveal=1`. Server renderiza TODAS las cartas + CTAs
 *                desde el HTML inicial. Las animaciones de aparicion
 *                escalonada se hacen 100% via CSS keyframes con
 *                `animation-delay` por indice — no useState, no setTimeout
 *                que dependa de hidratacion. Si JS hidrata: bonus
 *                (banner de notificacion va flasheando segun la carta
 *                "activa"). Si no hidrata: el usuario igual ve toda la
 *                animacion CSS y los botones para canjear/depositar.
 *
 * Esta arquitectura sobrevive a hidratacion inconsistente porque la
 * informacion critica (cartas, CTAs) esta en el DOM desde el primer
 * render del servidor.
 */

type Stage = "idle" | "revealing";

export interface EnvelopeFlowProps {
  pack: PackResult;
  country: "SV" | "GT";
  ctaSlot: ReactNode;
  /**
   * URL a la que apunta el "tocar para abrir". Si se provee, el sobre
   * cerrado renderiza un <a> nativo y abre con navegacion full-page.
   */
  openHref?: string | undefined;
  /**
   * Etapa inicial. `'revealing'` cuando el server detecto `?reveal=1`.
   * Por default `'idle'`.
   */
  initialStage?: Stage;
  /** Salta el suspenso (util en tests). */
  skipAnimation?: boolean;
}

/** Label de la notificacion arriba segun el premio. */
function notificationFor(prize: Prize): { label: string; color: string } {
  if (prize.type === "collectible") {
    if (prize.rarity === "legendary")
      return { label: "¡CARTA LEGENDARIA!", color: "text-gp-gold" };
    if (prize.rarity === "epic")
      return { label: "¡CARTA ÉPICA!", color: "text-purple-300" };
    if (prize.rarity === "rare")
      return { label: "¡CARTA RARA!", color: "text-green-300" };
    return { label: "CARTA COMÚN", color: "text-gp-white" };
  }
  if (prize.type === "none") {
    return { label: "SIGUE INTENTANDO", color: "text-gp-gray-light" };
  }
  return { label: "¡PREMIO!", color: "text-gp-gold" };
}

// Tiempos de la coreografia (ms). Coinciden con `animation-delay` de cada
// carta en CSS. La carta i-esima aparece en T_REVEAL_BASE + i * STEP.
const T_REVEAL_BASE_MS = 100;
const REVEAL_STEP_MS = 1100;
const REVEAL_DURATION_MS = 700;

/**
 * Boton/Link que abre el sobre. Si la pagina padre paso `openHref`,
 * usamos un <a> real con full navigation — funciona aunque la
 * hidratacion de React no haya llegado.
 */
function EnvelopeOpenTrigger({
  openHref,
  onClick,
}: {
  openHref?: string | undefined;
  onClick: () => void;
}): JSX.Element {
  const className =
    "relative mt-4 flex h-80 w-60 cursor-pointer items-center justify-center rounded-2xl border-2 border-gp-gold bg-gp-radial shadow-[0_0_70px_14px_rgba(212,160,23,0.6)] outline-none transition-transform focus-visible:ring-4 focus-visible:ring-gp-gold focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:h-96 sm:w-72";
  const style: React.CSSProperties = {
    animation:
      "envelope-pulse 2s ease-in-out infinite, envelope-float 4s ease-in-out infinite",
  };
  const children = (
    <>
      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <p className="font-display text-lg font-bold uppercase tracking-widest text-gp-white">
          GanaPlay
        </p>
        <p className="text-[10px] uppercase tracking-widest text-gp-gold">
          Álbum oficial
        </p>
        <p className="font-display text-5xl font-extrabold leading-none text-gp-white">
          2026
        </p>
      </div>
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-4 rounded-2xl"
        style={{
          boxShadow:
            "0 0 70px 14px rgba(212,160,23,0.5), 0 0 140px 28px rgba(212,160,23,0.25)",
          animation: "envelope-glow 2s ease-in-out infinite",
        }}
      />
    </>
  );

  if (openHref !== undefined) {
    return (
      <a
        href={openHref}
        aria-label="Abrir el sobre"
        className={className}
        style={style}
      >
        {children}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Abrir el sobre"
      className={className}
      style={style}
    >
      {children}
    </button>
  );
}

export function EnvelopeFlow({
  pack,
  country,
  ctaSlot,
  openHref,
  initialStage,
  skipAnimation = false,
}: EnvelopeFlowProps): JSX.Element {
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

  const resolvedInitialStage: Stage = skipAnimation
    ? "revealing"
    : initialStage ?? "idle";

  const [stage] = useState<Stage>(resolvedInitialStage);

  // BONUS: si JS hidrata, vamos rotando el banner de notificacion
  // segun la carta activa. Si no hidrata, el banner queda en el premio
  // del slot 0 (mejor que nada). No bloquea el resto de la animacion.
  const [activeIndex, setActiveIndex] = useState<number>(skipAnimation ? items.length - 1 : 0);

  useEffect(() => {
    if (stage !== "revealing") return;
    if (skipAnimation) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i < items.length; i += 1) {
      const t = setTimeout(() => {
        if (cancelled) return;
        setActiveIndex(i);
      }, i * REVEAL_STEP_MS);
      timers.push(t);
    }
    return (): void => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
    };
  }, [stage, skipAnimation, items.length]);

  // Cuando termina la cascada, despues de un margen, mostramos el
  // banner "¡SOBRE COMPLETO!". Si JS no hidrata, igual cae en None
  // y se renderiza sobre la pagina por CSS animation-delay.
  const [showCompleteBanner, setShowCompleteBanner] = useState<boolean>(
    skipAnimation,
  );
  useEffect(() => {
    if (stage !== "revealing") return;
    if (skipAnimation) {
      setShowCompleteBanner(true);
      return;
    }
    const totalMs = items.length * REVEAL_STEP_MS + REVEAL_DURATION_MS;
    const t = setTimeout(() => setShowCompleteBanner(true), totalMs);
    return (): void => clearTimeout(t);
  }, [stage, skipAnimation, items.length]);

  // ============ IDLE ============
  if (stage === "idle") {
    return (
      <div data-envelope-flow data-stage="idle" data-country={country}>
        <div
          className="mx-auto flex max-w-md flex-col items-center gap-4 pt-4"
          data-envelope-idle="true"
        >
          <h2 className="font-display text-2xl font-bold uppercase tracking-widest text-gp-white sm:text-3xl">
            Toca para
          </h2>
          <h3 className="font-display text-4xl font-extrabold uppercase tracking-widest text-gp-gold drop-shadow-[0_0_24px_rgba(212,160,23,0.55)] sm:text-5xl">
            ABRIR
          </h3>

          <EnvelopeOpenTrigger
            openHref={openHref}
            onClick={(): void => {
              /* fallback: nada — el padre deberia haber pasado openHref */
            }}
          />

          <p className="mt-6 text-center text-xs uppercase tracking-widest text-gp-gray-light">
            Toca el sobre para revelar tus cartas
          </p>
        </div>

        <style>{`
          @keyframes envelope-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.03); }
          }
          @keyframes envelope-float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
          }
          @keyframes envelope-glow {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  // ============ REVEALING (server-render-all + CSS staggered) ============
  const activePrize = items[activeIndex]?.prize;
  const notif = activePrize ? notificationFor(activePrize) : null;

  // Tiempo total (ms) cuando todas las cartas terminaron su animacion.
  const totalRevealMs = items.length * REVEAL_STEP_MS + REVEAL_DURATION_MS;

  return (
    <div data-envelope-flow data-stage="revealing" data-country={country}>
      <div className="flex flex-col items-center gap-6">
        {/* Banner de notificacion: cambia segun JS activeIndex. Si no
            hidrata, queda en el slot 0. */}
        {notif !== null ? (
          <div
            key={activeIndex}
            data-notification
            className={`flex items-center justify-center gap-2 text-2xl font-extrabold uppercase tracking-widest sm:text-3xl ${notif.color}`}
            style={{
              animation: "notif-flash 700ms ease-out both",
            }}
          >
            <span aria-hidden>🔥</span>
            <span>{notif.label}</span>
          </div>
        ) : null}

        {/* Grilla: las 5 cartas SE RENDERIZAN TODAS desde el server.
            CSS animation-delay por indice arma la cascada visual SIN
            useState ni setTimeout. Si JS no hidrata, igual se ve la
            cascada porque las @keyframes corren solas. */}
        <div
          data-pack-reveal="true"
          data-card-count={items.length}
          className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
        >
          {items.map((item, i) => {
            const delayMs = T_REVEAL_BASE_MS + i * REVEAL_STEP_MS;
            return (
              <div
                key={item.key}
                className="flex flex-col items-center"
                style={{
                  // animation-fill-mode: both -> arranca en estado "0%"
                  // (invisible) y queda en estado "100%" al terminar.
                  // Esto significa que en SSR, antes de que la animacion
                  // arranque, la carta es invisible (opacity 0) pero
                  // pasa a visible automaticamente sin JS.
                  animation: skipAnimation
                    ? "card-instant 1ms both"
                    : `card-pop ${REVEAL_DURATION_MS}ms cubic-bezier(0.16, 1, 0.3, 1) ${delayMs}ms both`,
                }}
              >
                {item.guaranteed ? (
                  <span className="mb-2 inline-flex items-center rounded-sm bg-gp-gold-gradient px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wide text-gp-white shadow-sm">
                    Garantizado
                  </span>
                ) : null}
                <Card prize={item.prize} revealed size="md" />
              </div>
            );
          })}
        </div>

        {/* Banner "SOBRE COMPLETO" + CTAs: visibles via CSS animation
            con delay = totalRevealMs. Si JS hidrata, showCompleteBanner
            tambien se vuelve true. */}
        <div
          className="flex flex-col items-center gap-6"
          style={{
            animation: skipAnimation
              ? "cta-appear 1ms both"
              : `cta-appear 500ms ease-out ${totalRevealMs}ms both`,
          }}
        >
          {showCompleteBanner || skipAnimation ? (
            <div className="text-center text-2xl font-extrabold uppercase tracking-widest text-gp-gold sm:text-3xl">
              ¡SOBRE COMPLETO!
            </div>
          ) : null}
          <div data-envelope-ctas="true" className="w-full">
            {ctaSlot}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes notif-flash {
          0% { opacity: 0; transform: scale(0.7) translateY(-10px); }
          50% { opacity: 1; transform: scale(1.1) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes card-pop {
          0% { opacity: 0; transform: scale(0.6) rotate(-6deg); }
          50% { opacity: 1; transform: scale(1.08) rotate(2deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes card-instant {
          0%, 100% { opacity: 1; transform: none; }
        }
        @keyframes cta-appear {
          0% { opacity: 0; transform: translateY(20px); }
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
