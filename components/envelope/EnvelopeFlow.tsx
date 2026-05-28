"use client";

import { useEffect, useState } from "react";
import type { JSX, ReactNode } from "react";

import { Card } from "@/components/cards/Card";

import type { PackResult, Prize } from "@/lib/prizes/types";

/**
 * Coreografia con suspenso, imitando el patron de juegos de cartas
 * coleccionables:
 *
 *   1. Sobre cerrado en pantalla con halo dorado pulsante + "TOCA PARA
 *      ABRIR". El usuario hace click cuando esta listo.
 *   2. Cada carta se revela UNA POR UNA con flip 3D. Banner arriba grita
 *      "¡CARTA ÉPICA!" / "¡CARTA RARA!" / "PREMIO" segun la rareza/tipo.
 *   3. Las cartas reveladas quedan visibles al lado (se acumulan), no se
 *      reemplazan, para que el usuario vea su botin crecer.
 *   4. Cuando termina, los CTAs (Canjear, Depositos) aparecen.
 *
 * Server-side el flujo arranca con el sobre cerrado (estado idle). Si
 * JS no hidrata, el usuario al menos ve el sobre + un fallback automatico
 * via CSS que dispara el reveal tras N segundos para no quedarse trabado.
 */

export interface EnvelopeFlowProps {
  pack: PackResult;
  country: "SV" | "GT";
  ctaSlot: ReactNode;
  /**
   * URL a la que apunta el "tocar para abrir". Cuando este link se
   * sigue, el server vuelve a renderizar la pagina con `initialStage`
   * en `'revealing'`, asi el reveal arranca SIN depender de JS para
   * el click. Si no se provee, se usa un onClick local (requiere
   * hidratacion).
   */
  openHref?: string;
  /**
   * Etapa inicial. Por defecto `'idle'` — el sobre cerrado espera
   * tocar. Si la pagina padre detecta `?reveal=1` (u otra senal),
   * puede pasar `'revealing'` para empezar el suspenso al instante
   * sin esperar el click del cliente.
   */
  initialStage?: Stage;
  /** Salta el suspenso (util en tests). */
  skipAnimation?: boolean;
}

type Stage =
  | "idle"      // sobre esperando click
  | "revealing" // mostrando cartas una por una
  | "done";     // todas reveladas, CTAs visibles

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
  // Premios reales (sports_credit / casino_spins / deposit_match / etc.)
  return { label: "¡PREMIO!", color: "text-gp-gold" };
}

const REVEAL_INTERVAL_MS = 1100;
const NOTIFICATION_FLASH_MS = 700;

/**
 * Boton/Link que abre el sobre. Si la pagina padre paso `openHref`,
 * usamos un <a> real con full navigation — funciona aunque la
 * hidratacion de React no haya llegado. Si no, fallback a un
 * <button> con onClick (requiere JS hidratado).
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
    ? "done"
    : initialStage ?? "idle";
  const [stage, setStage] = useState<Stage>(resolvedInitialStage);
  /** Index de la siguiente carta a revelar (0..items.length). */
  const [revealedCount, setRevealedCount] = useState<number>(() => {
    if (skipAnimation || resolvedInitialStage === "done") return items.length;
    if (resolvedInitialStage === "revealing") return 1;
    return 0;
  });
  /** Flag para animar el banner de notificacion al cambiar de carta. */
  const [flashKey, setFlashKey] = useState<number>(
    resolvedInitialStage === "revealing" ? 1 : 0,
  );

  // Auto-avance: cuando estamos en `revealing`, cada N ms revela la
  // proxima carta hasta llegar al total. Despues pasa a `done`.
  useEffect(() => {
    if (stage !== "revealing") return;
    if (revealedCount >= items.length) {
      const t = setTimeout(() => setStage("done"), 500);
      return (): void => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setRevealedCount((c) => c + 1);
      setFlashKey((k) => k + 1);
    }, REVEAL_INTERVAL_MS);
    return (): void => clearTimeout(t);
  }, [stage, revealedCount, items.length]);

  const handleOpen = (): void => {
    if (stage !== "idle") return;
    setStage("revealing");
    setRevealedCount(1);
    setFlashKey(1);
  };

  // Carta actualmente "destacada" — la ultima revelada.
  const latestIndex = revealedCount - 1;
  const latestPrize =
    latestIndex >= 0 && latestIndex < items.length
      ? items[latestIndex]?.prize
      : undefined;
  const notif = latestPrize ? notificationFor(latestPrize) : null;

  return (
    <div data-envelope-flow data-stage={stage} data-country={country}>
      {/* ============ ETAPA IDLE: SOBRE INTERACTIVO ============ */}
      {stage === "idle" ? (
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

          <EnvelopeOpenTrigger openHref={openHref} onClick={handleOpen} />

          <p className="mt-6 text-center text-xs uppercase tracking-widest text-gp-gray-light">
            Toca el sobre para revelar tus cartas
          </p>
        </div>
      ) : null}

      {/* ============ ETAPA REVEALING/DONE: NOTIFICACION + CARTAS ============ */}
      {stage !== "idle" ? (
        <div className="flex flex-col items-center gap-6">
          {/* Notificacion arriba */}
          {notif !== null && stage === "revealing" ? (
            <div
              key={flashKey}
              data-notification
              className={`flex items-center justify-center gap-2 text-2xl font-extrabold uppercase tracking-widest sm:text-3xl ${notif.color}`}
              style={{
                animation: `notif-flash ${NOTIFICATION_FLASH_MS}ms ease-out both`,
              }}
            >
              <span aria-hidden>🔥</span>
              <span>{notif.label}</span>
            </div>
          ) : null}

          {stage === "done" ? (
            <div
              className="text-center text-2xl font-extrabold uppercase tracking-widest text-gp-gold sm:text-3xl"
              style={{
                animation: "notif-flash 600ms ease-out both",
              }}
            >
              ¡SOBRE COMPLETO!
            </div>
          ) : null}

          {/* Grilla de cartas: las ya reveladas mas la "actual" que entra
              con animacion. Las que aun no salieron se muestran como
              placeholders sutiles. */}
          <div
            data-pack-reveal="true"
            data-card-count={items.length}
            className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
          >
            {items.map((item, i) => {
              const isRevealed = i < revealedCount;
              const isLatest = i === revealedCount - 1 && stage === "revealing";
              return (
                <div
                  key={item.key}
                  className="flex flex-col items-center"
                  style={{
                    animation: isLatest
                      ? `card-pop ${NOTIFICATION_FLASH_MS}ms cubic-bezier(0.16, 1, 0.3, 1) both`
                      : undefined,
                    opacity: isRevealed ? 1 : 0.25,
                    transform: isRevealed ? "none" : "scale(0.95)",
                    transition:
                      "opacity 300ms ease-out, transform 300ms ease-out",
                  }}
                >
                  {item.guaranteed && isRevealed ? (
                    <span className="mb-2 inline-flex items-center rounded-sm bg-gp-gold-gradient px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wide text-gp-white shadow-sm">
                      Garantizado
                    </span>
                  ) : null}
                  {isRevealed ? (
                    <Card prize={item.prize} revealed size="md" />
                  ) : (
                    /* Carta cerrada placeholder mientras no se revela. */
                    <div
                      aria-hidden
                      className="flex aspect-[2/3] w-48 items-center justify-center rounded-lg border border-gp-gold/60 bg-gp-radial shadow-md"
                    >
                      <span className="font-display text-sm font-bold uppercase tracking-widest text-gp-gold/80">
                        ?
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* CTAs cuando todo termino */}
          {stage === "done" ? (
            <div
              className="mt-6 w-full"
              style={{
                animation: "cta-appear 500ms ease-out both",
              }}
            >
              {ctaSlot}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Keyframes inline para no depender de Tailwind config. */}
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
