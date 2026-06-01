"use client";

import { useEffect, useMemo, useState } from "react";
import type { JSX, ReactNode } from "react";
import Image from "next/image";

import { Card } from "@/components/cards/Card";

import type { EnvelopeTier, PackResult, Prize } from "@/lib/prizes/types";
import { TIER_THEME } from "@/lib/prizes/tiers";
import { formatPrizeForA11y } from "@/lib/ui/format";

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
  /**
   * Premios del pack. Solo requerido en stage `'revealing'`; en `'idle'`
   * el sobre cerrado no necesita conocer el contenido.
   */
  pack?: PackResult | undefined;
  /**
   * País del código. Solo requerido en `'revealing'` (afecta CTAs).
   */
  country?: "SV" | "GT" | undefined;
  /**
   * Tier del sobre (decisión 2026-05-28). Define color del borde + halo del
   * sobre cerrado, badge en el banner, copy de anticipación. Si se omite,
   * el sobre se renderiza con el styling oro original (fallback compat).
   */
  tier?: EnvelopeTier | undefined;
  /**
   * CTAs renderizados al final del reveal. Solo requerido en `'revealing'`.
   */
  ctaSlot?: ReactNode;
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
  switch (prize.type) {
    case "collectible": {
      switch (prize.rarity) {
        case "legendary":
          return { label: "¡CARTA LEGENDARIA!", color: "text-gp-gold" };
        case "epic":
          return { label: "¡CARTA ÉPICA!", color: "text-purple-300" };
        case "rare":
          return { label: "¡CARTA RARA!", color: "text-green-300" };
        case "common":
          return { label: "CARTA COMÚN", color: "text-gp-white" };
        default: {
          const _exhaustive: never = prize.rarity;
          void _exhaustive;
          return { label: "CARTA COMÚN", color: "text-gp-white" };
        }
      }
    }
    case "none":
      return { label: "SIGUE INTENTANDO", color: "text-gp-gray-light" };
    case "sports_credit":
      return { label: "¡APUESTA GRATIS!", color: "text-gp-gold" };
    case "casino_spins":
      return { label: "¡GIROS GRATIS!", color: "text-gp-gold" };
    case "deposit_match":
      return { label: "¡BONO DE DEPÓSITO!", color: "text-gp-gold" };
    case "external_code":
      return { label: "¡CÓDIGO PREMIO!", color: "text-gp-gold" };
    case "physical": {
      switch (prize.category) {
        case "cinema_combo":
          return { label: "¡COMBO DE CINE!", color: "text-gp-gold" };
        case "jersey_local":
        case "jersey_intl":
          return { label: "¡CAMISETA OFICIAL!", color: "text-gp-gold" };
        case "selecta_merch":
          return { label: "¡MERCH SELECTA!", color: "text-gp-gold" };
        case "motorcycle":
          return { label: "¡PREMIO MAYOR!", color: "text-gp-gold" };
        default:
          return { label: "¡PREMIO FÍSICO!", color: "text-gp-gold" };
      }
    }
    default: {
      const _exhaustive: never = prize;
      void _exhaustive;
      return { label: "¡PREMIO!", color: "text-gp-gold" };
    }
  }
}

// Tiempos de la coreografia (ms). La carta i-esima aparece en
// 100 + i * 1100 — esos delays viven en globals.css como .card-delay-N
// para no emitir inline styles. REVEAL_STEP_MS sigue usandose por JS
// para sincronizar el banner de notificacion y el CTA appear.
const REVEAL_STEP_MS = 1100;
const REVEAL_DURATION_MS = 700;

/** Sparkle SVG (12-point star) usado en el banner de notificacion. */
function Sparkle({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
    >
      <path d="M12 0 L13.5 8 L18 5 L15 9.5 L23 10.5 L15 12 L18 16.5 L13.5 14 L12 22 L10.5 14 L6 16.5 L9 12 L1 10.5 L9 9.5 L6 5 L10.5 8 Z" />
    </svg>
  );
}

/**
 * Boton/Link que abre el sobre. La facade es 100% la imagen por tier
 * (/assets/sobre/sobre-{tier}.webp) que ya trae su propio flap, sello y
 * foil — no hay overlays decorativos arriba.
 */
function EnvelopeOpenTrigger({
  openHref,
  onClick,
  tier,
}: {
  openHref?: string | undefined;
  onClick: () => void;
  tier?: EnvelopeTier | undefined;
}): JSX.Element {
  const theme = tier !== undefined ? TIER_THEME[tier] : null;
  const accentHex = theme?.accentHex ?? "#D4A017";

  const className =
    "group relative w-72 h-96 sm:w-80 sm:h-[28rem] rounded-2xl overflow-hidden cursor-pointer outline-none animate-envelope-breathe transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-[0.96] focus-visible:ring-4 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-gp-green-deep";

  // Glow exterior tinted por tier — vive afuera de la imagen para evitar
  // overlap con el borde del sobre real.
  const glowStyle: React.CSSProperties = {
    boxShadow: `0 30px 80px -25px ${accentHex}, 0 0 0 1px rgba(255,255,255,0.04)`,
  };

  const children = (
    <>
      {/* Facade real del sobre — una imagen por tier que ocupa toda la card.
          Pone su propio flap, sello, foil, etc — sin overlays decorativos
          encima. El alt vacío porque el sobre es decorativo: el contenido
          informativo es el botón y su aria-label. */}
      <Image
        src={`/assets/sobre/sobre-${tier ?? "bronce"}.webp`}
        alt=""
        fill
        sizes="(max-width: 640px) 18rem, 20rem"
        priority
        className="object-cover"
      />
    </>
  );

  if (openHref !== undefined) {
    return (
      <a
        href={openHref}
        aria-label="Abrir el sobre"
        // Anchors don't natively respond to Space — but users habituated to
        // buttons expect it. Re-add Space activation explicitly.
        onKeyDown={(e) => {
          if (e.key === " ") {
            e.preventDefault();
            window.location.assign(openHref);
          }
        }}
        className={className}
        style={glowStyle}
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
      style={glowStyle}
    >
      {children}
    </button>
  );
}

export function EnvelopeFlow({
  pack,
  country,
  tier,
  ctaSlot,
  openHref,
  initialStage,
  skipAnimation = false,
}: EnvelopeFlowProps): JSX.Element {
  const items = useMemo(
    () =>
      pack
        ? [
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
          ]
        : [],
    [pack],
  );

  const resolvedInitialStage: Stage = skipAnimation
    ? "revealing"
    : initialStage ?? "idle";

  const stage = resolvedInitialStage;

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
    const theme = tier !== undefined ? TIER_THEME[tier] : null;
    return (
      <div data-envelope-flow data-stage="idle" data-country={country} data-tier={tier ?? "default"}>
        <div
          className="mx-auto flex max-w-md flex-col items-center gap-4 pt-4"
          data-envelope-idle="true"
        >
          <h2 className="font-display text-2xl font-bold uppercase tracking-widest text-gp-white sm:text-3xl">
            Toca para
          </h2>
          <h3
            className="font-display text-4xl font-extrabold uppercase tracking-widest sm:text-5xl"
            style={{
              color: theme?.accentHex ?? "#D4A017",
              textShadow: `0 0 24px ${theme?.envelopeGlow ?? "rgba(212,160,23,0.55)"}`,
            }}
          >
            ABRIR
          </h3>

          <EnvelopeOpenTrigger
            openHref={openHref}
            tier={tier}
            onClick={(): void => {
              /* fallback: nada — el padre deberia haber pasado openHref */
            }}
          />

          <p className="mt-6 text-center text-xs uppercase tracking-widest text-gp-gray-light">
            Toca el sobre para revelar tus cartas
          </p>
        </div>
      </div>
    );
  }

  // ============ REVEALING (server-render-all + CSS staggered) ============
  const activePrize = items[activeIndex]?.prize;
  const notif = activePrize ? notificationFor(activePrize) : null;

  // Tiempo total (ms) cuando todas las cartas terminaron su animacion.
  const totalRevealMs = items.length * REVEAL_STEP_MS + REVEAL_DURATION_MS;

  // Premios reales (no coleccionables, no none) para el divider final.
  const realCount = items.filter(
    (i) => i.prize.type !== "collectible" && i.prize.type !== "none",
  ).length;
  const theme = tier !== undefined ? TIER_THEME[tier] : null;

  return (
    <div data-envelope-flow data-stage="revealing" data-country={country} data-tier={tier ?? "default"}>
      <div className="flex flex-col items-center gap-6">
        {/* Banner de notificacion: cambia segun JS activeIndex. Si no
            hidrata, queda en el slot 0. */}
        <div role="status" aria-live="polite" aria-atomic="true">
          {notif !== null ? (
            <div
              key={activeIndex}
              data-notification
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/40 px-5 py-2 backdrop-blur-md animate-notif-flash"
            >
              <Sparkle className={`h-4 w-4 ${notif.color}`} />
              <span
                className={`text-2xl font-extrabold uppercase tracking-widest sm:text-3xl ${notif.color}`}
              >
                {notif.label}
              </span>
            </div>
          ) : null}
        </div>

        {/* Grilla: las 5 cartas SE RENDERIZAN TODAS desde el server.
            CSS animation-delay por indice arma la cascada visual SIN
            useState ni setTimeout. Si JS no hidrata, igual se ve la
            cascada porque las @keyframes corren solas. */}
        <ul
          role="list"
          aria-label="Cartas reveladas"
          data-pack-reveal="true"
          data-card-count={items.length}
          className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
        >
          {items.map((item, i) => {
            // Pre-defined CSS class por indice -> evita emitir un style
            // inline duplicado por carta (HTML payload reveal ~17% mas
            // chico). Cap a 4 por seguridad si algun dia hay >5 cartas.
            const delayClass = `card-delay-${Math.min(i, 4)}`;
            // animation-fill-mode: both -> en SSR la carta arranca invisible
            // (opacity 0) y se vuelve visible automaticamente al ejecutarse
            // la keyframe, sin necesidad de JS.
            return (
              <li
                key={item.key}
                aria-label={`${item.guaranteed ? "Garantizado: " : ""}${formatPrizeForA11y(item.prize)}`}
                className={
                  skipAnimation
                    ? "flex flex-col items-center"
                    : `flex flex-col items-center animate-card-pop ${delayClass}`
                }
              >
                {item.guaranteed ? (
                  <span className="mb-2 inline-flex items-center rounded-sm bg-gp-gold-gradient px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wide text-gp-green-deep shadow-sm">
                    Garantizado
                  </span>
                ) : null}
                {/* Solo la primera carta usa fetchPriority=high para no
                    competir por ancho de banda con el LCP. */}
                <Card prize={item.prize} revealed size="md" priority={i === 0} />
              </li>
            );
          })}
        </ul>

        {/* Divider "Sobre {tier} · N premios" + CTAs: visibles via CSS
            animation con delay = totalRevealMs. Si JS hidrata,
            showCompleteBanner tambien se vuelve true. */}
        <div
          role="status"
          aria-live="polite"
          className={
            skipAnimation
              ? "flex w-full flex-col items-center gap-6"
              : "flex w-full flex-col items-center gap-6 animate-cta-appear"
          }
          style={skipAnimation ? undefined : { animationDelay: `${totalRevealMs}ms` }}
        >
          {showCompleteBanner || skipAnimation ? (
            <div className="flex w-full max-w-md items-center gap-4">
              <span className="h-px flex-1 bg-gp-gold/40" />
              <span className="whitespace-nowrap font-display text-sm uppercase tracking-[0.3em] text-gp-gold">
                Sobre {theme?.label ?? "GANAPLAY"} · {realCount} premio{realCount === 1 ? "" : "s"}
              </span>
              <span className="h-px flex-1 bg-gp-gold/40" />
            </div>
          ) : null}
          <div data-envelope-ctas="true" className="w-full">
            {ctaSlot}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EnvelopeFlow;
