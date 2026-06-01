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

/**
 * Label + color + intensidad de la notificación según el premio.
 * `intensity`: 'legendary' usa el banner grande (animate-notif-flash-legendary);
 * el resto usa el flash normal. Colores SOLO de paleta de marca (gp-gold,
 * gp-green-core, gp-white, gp-gray-light, epic #8B7AC2 derivado de #5A3E9F).
 */
type NotifIntensity = "subtle" | "rare" | "epic" | "legendary";
function notificationFor(prize: Prize): {
  label: string;
  color: string;
  intensity: NotifIntensity;
} {
  switch (prize.type) {
    case "collectible": {
      switch (prize.rarity) {
        case "legendary":
          return { label: "¡CARTA LEGENDARIA!", color: "text-gp-gold", intensity: "legendary" };
        case "epic":
          return { label: "¡CARTA ÉPICA!", color: "text-[#A78BD9]", intensity: "epic" };
        case "rare":
          return { label: "¡CARTA RARA!", color: "text-gp-green-core", intensity: "rare" };
        case "common":
          return { label: "CARTA COMÚN", color: "text-gp-white", intensity: "subtle" };
        default: {
          const _exhaustive: never = prize.rarity;
          void _exhaustive;
          return { label: "CARTA COMÚN", color: "text-gp-white", intensity: "subtle" };
        }
      }
    }
    case "none":
      return { label: "SIGUE INTENTANDO", color: "text-gp-gray-light", intensity: "subtle" };
    case "sports_credit":
      return { label: "¡APUESTA GRATIS!", color: "text-gp-gold", intensity: "epic" };
    case "casino_spins":
      return { label: "¡GIROS GRATIS!", color: "text-gp-gold", intensity: "epic" };
    case "deposit_match":
      return { label: "¡BONO DE DEPÓSITO!", color: "text-gp-gold", intensity: "epic" };
    case "external_code":
      return { label: "¡CÓDIGO PREMIO!", color: "text-gp-gold", intensity: "epic" };
    case "physical": {
      switch (prize.category) {
        case "cinema_combo":
          return { label: "¡COMBO DE CINE!", color: "text-gp-gold", intensity: "epic" };
        case "jersey_local":
        case "jersey_intl":
          return { label: "¡CAMISETA OFICIAL!", color: "text-gp-gold", intensity: "legendary" };
        case "selecta_merch":
          return { label: "¡MERCH SELECTA!", color: "text-gp-gold", intensity: "epic" };
        case "motorcycle":
          return { label: "¡PREMIO MAYOR!", color: "text-gp-gold", intensity: "legendary" };
        default:
          return { label: "¡PREMIO FÍSICO!", color: "text-gp-gold", intensity: "epic" };
      }
    }
    default: {
      const _exhaustive: never = prize;
      void _exhaustive;
      return { label: "¡PREMIO!", color: "text-gp-gold", intensity: "epic" };
    }
  }
}

/** Índice de la "mejor" carta del pack — la que merece el clímax (shake + banner
 *  grande). Prioriza legendaria > premio físico premium > primer premio real. */
function bestCardIndex(prizes: Prize[]): number {
  let best = -1;
  let bestRank = -1;
  prizes.forEach((p, i) => {
    let rank = 0;
    if (p.type === "collectible") {
      rank = p.rarity === "legendary" ? 5 : p.rarity === "epic" ? 3 : p.rarity === "rare" ? 2 : 1;
    } else if (p.type === "physical") {
      rank = p.category === "motorcycle" || p.category === "jersey_intl" ? 6 : 4;
    } else if (p.type === "sports_credit" || p.type === "deposit_match" || p.type === "casino_spins") {
      rank = 3;
    }
    if (rank > bestRank) {
      bestRank = rank;
      best = i;
    }
  });
  return best;
}

// Coreografía NO-LINEAL del reveal (ms desde el inicio). boom-boom-boom (gaps
// cortos) → gaps crecientes → PAUSA DRAMÁTICA de 1500ms → clímax (mejor carta).
// DEBE coincidir EXACTO con los .card-delay-N en app/globals.css; si difieren,
// el banner JS (activeIndex) flashea desfasado de la carta que realmente sale.
const SEQUENCE_DELAYS_MS = [100, 950, 1900, 3050, 4550] as const;
const REVEAL_DURATION_MS = 800; // matchea card-reveal en globals.css

/** Delay de la carta i (cap a la última definida si hubiera >5 cartas). */
function delayForIndex(i: number): number {
  return SEQUENCE_DELAYS_MS[Math.min(i, SEQUENCE_DELAYS_MS.length - 1)] ?? 100;
}

/** Sparkle SVG (12-point star) usado en el banner y los sparkles del sobre. */
function Sparkle({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}): JSX.Element {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox="0 0 24 24"
      className={className}
      style={style}
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

  // w-64 (256px) en los teléfonos más chicos (320px → ~32px de margen por lado)
  // escalando a sm:w-80. ANTICIPACIÓN: glow-pulse tintado por tier (hereda
  // `color: accentHex`), breathe sutil, y un :active fuerte (scale 0.92 +
  // brillo) para que el tap se sienta físico. Focus ring verde de marca.
  const className =
    "group relative w-64 h-80 sm:w-80 sm:h-[28rem] rounded-2xl overflow-hidden cursor-pointer outline-none animate-envelope-alive [will-change:transform,filter] transition-transform duration-200 ease-out hover:scale-[1.06] active:scale-[0.92] focus-visible:ring-4 focus-visible:ring-gp-green-core focus-visible:ring-offset-2 focus-visible:ring-offset-gp-green-deep";

  // `color` alimenta el currentColor del glow-pulse (halo del tier). El borde
  // sutil mantiene el rim-light sobre la imagen del sobre.
  const glowStyle: React.CSSProperties = {
    color: accentHex,
    boxShadow: `0 0 0 1px rgba(255,255,255,0.05)`,
  };

  // Sparkles flotantes — chispas doradas que suben y se desvanecen sobre el
  // sobre, insinuando premio adentro. Posiciones + offsets distintos por chispa.
  const sparkles = [
    { left: "18%", top: "30%", offsetX: "-8px", delay: "0ms" },
    { left: "74%", top: "22%", offsetX: "10px", delay: "900ms" },
    { left: "50%", top: "60%", offsetX: "0px", delay: "1700ms" },
    { left: "32%", top: "70%", offsetX: "-6px", delay: "2400ms" },
  ];

  const children = (
    <>
      {/* Facade real del sobre — una imagen por tier que ocupa toda la card.
          Trae su propio flap, sello, foil. alt vacío: el sobre es decorativo,
          el contenido informativo es el botón y su aria-label. */}
      <Image
        src={`/assets/sobre/sobre-${tier ?? "bronce"}.webp`}
        alt=""
        fill
        sizes="(max-width: 640px) 18rem, 20rem"
        priority
        className="object-cover"
      />
      {/* Sparkles decorativos (aria-hidden) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {sparkles.map((s, i) => (
          <Sparkle
            key={i}
            className="absolute h-3 w-3 text-gp-gold/70 animate-sparkle-float"
            style={
              {
                left: s.left,
                top: s.top,
                animationDelay: s.delay,
                "--offset-x": s.offsetX,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
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

  // Índice de la mejor carta — dispara el shake + banner grande cuando aparece.
  const bestIndex = useMemo(
    () => bestCardIndex(items.map((it) => it.prize)),
    [items],
  );
  const [isShaking, setIsShaking] = useState<boolean>(false);

  useEffect(() => {
    if (stage !== "revealing") return;
    if (skipAnimation) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i < items.length; i += 1) {
      const t = setTimeout(() => {
        if (cancelled) return;
        setActiveIndex(i);
      }, delayForIndex(i));
      timers.push(t);
    }
    // Screen-shake en el instante en que la mejor carta termina de voltear.
    if (bestIndex >= 0) {
      const shakeAt = delayForIndex(bestIndex) + REVEAL_DURATION_MS * 0.7;
      const ts = setTimeout(() => {
        if (cancelled) return;
        setIsShaking(true);
        const off = setTimeout(() => !cancelled && setIsShaking(false), 240);
        timers.push(off);
      }, shakeAt);
      timers.push(ts);
    }
    return (): void => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
    };
  }, [stage, skipAnimation, items.length, bestIndex]);

  // Resumen dinámico de recompensa: qué ganó el usuario, en una línea.
  const rewardSummary = useMemo(() => {
    let money = 0;
    let spins = 0;
    let physical = 0;
    let legendary = 0;
    let epic = 0;
    let rare = 0;
    for (const it of items) {
      const p = it.prize;
      if (p.type === "sports_credit") money += p.amount;
      else if (p.type === "casino_spins") spins += p.count;
      else if (p.type === "physical") physical += 1;
      else if (p.type === "collectible") {
        if (p.rarity === "legendary") legendary += 1;
        else if (p.rarity === "epic") epic += 1;
        else if (p.rarity === "rare") rare += 1;
      }
    }
    const currency = country === "GT" ? "Q" : "$";
    const parts: string[] = [];
    if (money > 0) parts.push(`${currency}${money}`);
    if (spins > 0) parts.push(`${spins} giros`);
    if (physical > 0) parts.push(`${physical} premio${physical > 1 ? "s" : ""} físico${physical > 1 ? "s" : ""}`);
    if (legendary > 0) parts.push(`${legendary} legendaria${legendary > 1 ? "s" : ""}`);
    if (epic > 0) parts.push(`${epic} épica${epic > 1 ? "s" : ""}`);
    if (rare > 0) parts.push(`${rare} rara${rare > 1 ? "s" : ""}`);
    return parts.length > 0 ? parts.join(" + ") : "Tus cartas";
  }, [items, country]);

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
          {/* "ABRIR" siempre dorado de marca (alta legibilidad como CTA "abrime"),
              con glow fuerte. La identidad del tier la dan el badge y el halo del
              sobre, no este texto. */}
          <h3
            className="font-display text-4xl font-extrabold uppercase tracking-widest text-gp-gold sm:text-5xl"
            style={{
              textShadow:
                "0 0 28px rgba(212,160,23,0.85), 0 2px 4px rgba(0,0,0,0.4)",
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

  // Tiempo total (ms) cuando la última carta terminó su animación (clímax).
  const totalRevealMs = delayForIndex(items.length - 1) + REVEAL_DURATION_MS;

  // Premios reales (no coleccionables, no none) para el resumen.
  const realCount = items.filter(
    (i) => i.prize.type !== "collectible" && i.prize.type !== "none",
  ).length;
  const theme = tier !== undefined ? TIER_THEME[tier] : null;

  return (
    <div
      data-envelope-flow
      data-stage="revealing"
      data-country={country}
      data-tier={tier ?? "default"}
      className={isShaking ? "animate-screen-shake" : undefined}
    >
      {/* APERTURA: estallido de luz dorada que tapa la transición sobre→cartas
          y baña las primeras cartas en luz (pico ~300-500ms). Solo con JS/anim. */}
      {!skipAnimation ? (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-40 flex items-start justify-center pt-24"
        >
          <div
            className="h-80 w-80 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(212,160,23,0.95) 0%, rgba(212,160,23,0.4) 35%, transparent 70%)",
              animation: "light-burst 600ms ease-out forwards",
              animationDelay: "200ms",
              opacity: 0,
            }}
          />
        </div>
      ) : null}

      <div className="flex flex-col items-center gap-6">
        {/* Banner de notificación: rota según JS activeIndex; la mejor carta
            (legendary) usa el banner grande. backdrop-blur-sm + max-w para
            mobile (320px sin overflow, menos costo GPU). */}
        <div role="status" aria-live="polite" aria-atomic="true">
          {notif !== null ? (
            <div
              key={activeIndex}
              data-notification
              data-intensity={notif.intensity}
              className={`inline-flex max-w-[16rem] items-center justify-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 py-2 backdrop-blur-sm sm:max-w-xs ${
                notif.intensity === "legendary"
                  ? "animate-notif-flash-legendary"
                  : "animate-notif-flash"
              }`}
            >
              <Sparkle className={`h-4 w-4 shrink-0 ${notif.color}`} />
              <span
                className={`text-center text-lg font-extrabold uppercase tracking-wide sm:text-2xl ${notif.color}`}
              >
                {notif.label}
              </span>
            </div>
          ) : null}
        </div>

        {/* Grilla: las 5 cartas SE RENDERIZAN TODAS desde el server. La cascada
            (animate-card-reveal + .card-delay-N) corre por CSS — sin JS las
            cartas igual emergen y voltean. grid-cols-2 en mobile para que las 5
            quepan en viewport sin scrollear durante la magia. */}
        <ul
          role="list"
          aria-label="Cartas reveladas"
          data-pack-reveal="true"
          data-card-count={items.length}
          className="grid grid-cols-2 justify-items-center gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5"
        >
          {items.map((item, i) => {
            const delayClass = `card-delay-${Math.min(i, 4)}`;
            return (
              <li
                key={item.key}
                aria-label={`${item.guaranteed ? "Garantizado: " : ""}${formatPrizeForA11y(item.prize)}`}
                className={
                  skipAnimation
                    ? "flex flex-col items-center"
                    : `flex flex-col items-center animate-card-reveal ${delayClass}`
                }
              >
                {item.guaranteed ? (
                  <span className="mb-2 inline-flex items-center rounded-sm bg-gp-gold-gradient px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wide text-gp-green-deep shadow-sm">
                    Garantizado
                  </span>
                ) : null}
                {/* size sm en mobile, md en sm+. Primera carta priority. */}
                <Card prize={item.prize} revealed size="sm" priority={i === 0} />
              </li>
            );
          })}
        </ul>

        {/* CLÍMAX: resumen de recompensa + CTAs. Aparece a totalRevealMs vía CSS
            (animate-cta-appear). pb-safe para que el home-bar del iPhone no tape
            el botón. */}
        <div
          role="status"
          aria-live="polite"
          className={
            skipAnimation
              ? "flex w-full flex-col items-center gap-5 pb-[env(safe-area-inset-bottom)]"
              : "flex w-full flex-col items-center gap-5 pb-[env(safe-area-inset-bottom)] animate-cta-appear"
          }
          style={skipAnimation ? undefined : { animationDelay: `${totalRevealMs}ms` }}
        >
          {/* Resumen SIEMPRE renderizado (no gated en JS): aparece junto con el
              CTA por la animación CSS del div padre (animate-cta-appear), así
              sobrevive a hidratación inconsistente igual que las cartas. El
              animate-summary-reveal agrega el pop interno cuando hay anim. */}
          <div className="flex w-full max-w-sm flex-col items-center gap-2 rounded-2xl border border-gp-gold/40 bg-gradient-to-br from-gp-green-deep/90 to-gp-green/40 px-5 py-4 text-center shadow-glass">
            <span className="inline-flex items-center gap-2 font-display text-sm font-bold uppercase tracking-[0.25em] text-gp-gold">
              <span aria-hidden>✦</span>
              Sobre {theme?.label ?? "GanaPlay"} completo
              <span aria-hidden>✦</span>
            </span>
            <span className="text-display-balance text-xl font-black text-gp-white sm:text-2xl">
              Ganaste: {rewardSummary}
            </span>
            <span className="text-[11px] uppercase tracking-widest text-gp-white/70">
              {realCount} premio{realCount === 1 ? "" : "s"} + tus cartas
            </span>
          </div>
          <div data-envelope-ctas="true" className="w-full">
            {ctaSlot}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EnvelopeFlow;
