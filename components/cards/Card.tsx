import Image from "next/image";
import type { JSX } from "react";

import type { Prize, CollectiblePrize } from "@/lib/prizes/types";
import { BRAND_NAME } from "@/lib/brand/constants";
import { formatMoney } from "@/lib/ui/format";

import { PrizeIcon } from "./PrizeIcon";
import { RarityBadge } from "./RarityBadge";
import { Confetti } from "./Confetti";

/** Premio "real" = canjeable o de valor monetario / mercancía. */
function isRealPrize(prize: Prize): boolean {
  return (
    prize.type === "sports_credit" ||
    prize.type === "casino_spins" ||
    prize.type === "deposit_match" ||
    prize.type === "physical" ||
    prize.type === "external_code"
  );
}

/** Rarezas que merecen halo pulsante. */
function isFancyRarity(prize: Prize): prize is CollectiblePrize {
  return (
    prize.type === "collectible" &&
    (prize.rarity === "rare" ||
      prize.rarity === "epic" ||
      prize.rarity === "legendary")
  );
}

/**
 * Carta primitiva del sobre. Server component: el flip 3D, halo pulsante y
 * hover se hacen 100% con Tailwind/CSS para evitar hidratar framer-motion
 * por cada carta. Confetti sigue siendo su propio client island.
 *
 * Reveal: el contenedor expone `data-revealed` y `data-rarity`; las reglas
 * en globals.css gating con `[data-rarity='epic'|'legendary'|'rare']`
 * disparan `animate-rarity-glow` (definido en tailwind.config.ts).
 */

export type CardSize = "sm" | "md" | "lg";

export interface CardProps {
  prize: Prize;
  /** Si `false`, mostramos el dorso. Default `true`. */
  revealed?: boolean;
  /** Retraso del flip-in en milisegundos. Default `0`. */
  delay?: number;
  size?: CardSize;
  /**
   * Pasa-a-través a `<Image priority>`. Default `false`. Sólo la primera
   * carta del reveal debe marcarse `true`; emitir múltiples preloads con
   * fetchPriority=high junto a loading=lazy hace que el browser ignore la
   * pista y desperdicia ancho de banda.
   */
  priority?: boolean;
}

const SIZE_CLS: Record<CardSize, string> = {
  sm: "w-32 h-48",
  md: "w-48 h-72",
  lg: "w-64 h-96",
};

// Pixel widths matched to SIZE_CLS — feeds <Image sizes> so Next picks the
// right srcset bucket without downloading the full asset on small cards.
const SIZE_PX: Record<CardSize, number> = {
  sm: 128,
  md: 192,
  lg: 256,
};

const AMOUNT_TEXT_CLS: Record<CardSize, string> = {
  sm: "text-2xl",
  md: "text-4xl",
  lg: "text-5xl",
};

const LABEL_TEXT_CLS: Record<CardSize, string> = {
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-sm",
};

function CardFrontContent({
  prize,
  size,
  priority,
}: {
  prize: Prize;
  size: CardSize;
  priority: boolean;
}): JSX.Element {
  switch (prize.type) {
    case "sports_credit":
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center text-gp-gray-dark-2">
          <PrizeIcon
            type="sports_credit"
            className="h-8 w-8 text-gp-green"
          />
          <p
            className={`font-display font-bold leading-none text-gp-green ${AMOUNT_TEXT_CLS[size]}`}
          >
            {formatMoney(prize.amount, prize.currency)}
          </p>
          <p
            className={`font-sans text-gp-gray-dark-1 ${LABEL_TEXT_CLS[size]}`}
          >
            {prize.label}
          </p>
        </div>
      );
    case "casino_spins":
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center text-gp-gray-dark-2">
          <PrizeIcon type="casino_spins" className="h-8 w-8 text-gp-green" />
          <p
            className={`font-display font-bold leading-none text-gp-green ${AMOUNT_TEXT_CLS[size]}`}
          >
            {prize.count}
          </p>
          <p
            className={`font-sans font-bold uppercase tracking-wide text-gp-green ${LABEL_TEXT_CLS[size]}`}
          >
            Giros gratis
          </p>
          <p
            className={`font-sans text-gp-gray-dark-1 ${LABEL_TEXT_CLS[size]}`}
          >
            {prize.game_name}
          </p>
        </div>
      );
    case "deposit_match":
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center text-gp-gray-dark-2">
          <PrizeIcon
            type="deposit_match"
            className="h-8 w-8 text-gp-green"
          />
          <p
            className={`font-display font-bold leading-none text-gp-green ${AMOUNT_TEXT_CLS[size]}`}
          >
            {prize.multiplier}
            <span className="sr-only"> veces </span>
            <span aria-hidden>×</span>
          </p>
          <p
            className={`font-sans font-bold uppercase tracking-wide text-gp-green ${LABEL_TEXT_CLS[size]}`}
          >
            Tu depósito
          </p>
          <p
            className={`font-sans text-gp-gray-dark-1 ${LABEL_TEXT_CLS[size]}`}
          >
            {prize.label}
          </p>
        </div>
      );
    case "physical": {
      // Glyph corto que ayuda al usuario a identificar la sub-categoría
      // del premio físico sin leer el label completo. No reemplaza la
      // ilustración final (Diseño la entregará en Fase 4 Ola 2-3).
      const categoryGlyph = (() => {
        switch (prize.category) {
          case "cinema_combo": return "🎬";
          case "jersey_local": return "👕";
          case "jersey_intl": return "🏆";
          case "selecta_merch": return "🇸🇻";
          case "motorcycle": return "🏍️";
          case "other": return null;
          default: {
            const _e: never = prize.category;
            void _e;
            return null;
          }
        }
      })();
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-gp-gray-dark-2">
          {categoryGlyph !== null ? (
            <span
              aria-hidden
              className={size === "lg" ? "text-5xl" : size === "md" ? "text-4xl" : "text-3xl"}
            >
              {categoryGlyph}
            </span>
          ) : (
            <PrizeIcon type="physical" className="h-10 w-10 text-gp-green" />
          )}
          <p
            className={`font-sans font-bold uppercase tracking-wide text-gp-green ${LABEL_TEXT_CLS[size]}`}
          >
            {prize.label}
          </p>
        </div>
      );
    }
    case "external_code":
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-gp-gray-dark-2">
          <PrizeIcon
            type="external_code"
            className="h-10 w-10 text-gp-green"
          />
          <p
            className={`font-sans font-bold uppercase tracking-wide text-gp-green ${LABEL_TEXT_CLS[size]}`}
          >
            {prize.label}
          </p>
          <p
            className={`font-sans text-gp-gray-dark-1 ${LABEL_TEXT_CLS[size]}`}
          >
            {prize.provider}
          </p>
        </div>
      );
    case "collectible": {
      const imageUrl = prize.image_url;
      if (imageUrl !== undefined) {
        return (
          <div className="relative h-full w-full overflow-hidden rounded-[7px]">
            <Image
              src={imageUrl}
              alt={prize.label}
              fill
              sizes={`${SIZE_PX[size]}px`}
              priority={priority}
              className="object-cover"
            />
            {/* Bottom fade so label remains legible over any artwork */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/85 via-black/40 to-transparent"
            />
            <div className="absolute left-2 top-2">
              <RarityBadge rarity={prize.rarity} />
            </div>
            <p className="absolute bottom-3 left-3 right-3 text-sm font-bold text-white">
              {prize.label}
            </p>
          </div>
        );
      }
      return (
        <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-gp-gray-dark-2">
          <div className="absolute left-2 top-2">
            <RarityBadge rarity={prize.rarity} />
          </div>
          <PrizeIcon
            type="collectible"
            className="h-12 w-12 text-gp-green"
          />
          <p
            className={`font-sans font-bold uppercase tracking-wide text-gp-green ${LABEL_TEXT_CLS[size]}`}
          >
            {prize.label}
          </p>
        </div>
      );
    }
    case "none":
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-gp-gray-dark-1">
          <PrizeIcon
            type="none"
            className="h-8 w-8 text-gp-gray-dark-1"
          />
          <p
            className={`font-sans uppercase tracking-wide ${LABEL_TEXT_CLS[size]}`}
          >
            {prize.label}
          </p>
        </div>
      );
    default: {
      const _exhaustive: never = prize;
      return <div data-unknown={String(_exhaustive)} />;
    }
  }
}

export function Card({
  prize,
  revealed = true,
  delay = 0,
  size = "md",
  priority = false,
}: CardProps): JSX.Element {
  const sizeCls = SIZE_CLS[size];
  const isNone = prize.type === "none";
  const fancy = isFancyRarity(prize);
  const showConfetti = revealed && isRealPrize(prize) && size !== "sm";

  // Per-tier framed border. Collectibles use a 2px gradient halo per rarity;
  // everything else keeps the standard verde de marca outline.
  const borderCls = (() => {
    if (prize.type !== "collectible") return "border border-gp-green";
    switch (prize.rarity) {
      case "legendary":
        return "bg-[linear-gradient(120deg,#B8860B_0%,#F4D03F_25%,#FFFFFF_50%,#F4D03F_75%,#B8860B_100%)] bg-[length:200%_100%] animate-shimmer p-[2px]";
      case "epic":
        // [CONFIRMAR_EPIC_COLOR] #5A3E9F — single source of truth (tiers.ts).
        return "bg-[conic-gradient(from_0deg,#5A3E9F,#8B7AC2,#5A3E9F)] p-[2px]";
      case "rare":
        return "bg-gradient-to-br from-gp-green to-gp-green-core p-[2px]";
      case "common":
      default:
        return "border border-gp-green";
    }
  })();

  const surfaceCls = isNone
    ? "bg-gp-gray-light/30"
    : "bg-gradient-to-b from-gp-white to-gp-gray-light/30";

  // Hover-only zoom on md/lg — Tailwind handles it without JS.
  const hoverCls = size !== "sm" ? "hover:scale-[1.02] transition-transform" : "";

  // Confetti se dispara justo cuando la cara delantera queda visible
  // (mitad de la animación de flip). 500ms flip -> dispara a +250ms del delay.
  const confettiDelay = delay + 250;

  // rarity-glow animation in globals.css gates on data-rarity + data-revealed.
  const rarityAttr = prize.type === "collectible" ? prize.rarity : "none";

  return (
    <div
      data-card
      data-prize-type={prize.type}
      data-revealed={revealed ? "true" : "false"}
      data-rarity={rarityAttr}
      className={`${sizeCls} ${hoverCls} relative rounded-lg shadow-lg [perspective:1000px]`}
    >
      {/* Halo pulsante para coleccionables rare/epic/legendary — CSS only.
          La regla en globals.css selecciona por data-rarity y aplica
          animate-rarity-glow sólo cuando data-revealed='true'. */}
      {fancy && revealed ? (
        <div
          aria-hidden
          data-card-glow
          className="pointer-events-none absolute -inset-2 rounded-2xl animate-rarity-glow"
        />
      ) : null}

      <div
        className="relative h-full w-full [transform-style:preserve-3d] transition-transform duration-500"
        style={{
          transform: revealed ? "rotateY(0deg)" : "rotateY(180deg)",
          transitionDelay: `${delay}ms`,
        }}
      >
        {/* Front face */}
        <div
          data-face="front"
          className={`absolute inset-0 flex flex-col rounded-lg ${borderCls} [backface-visibility:hidden]`}
        >
          <div
            className={`flex h-full w-full flex-col rounded-[7px] ${surfaceCls}`}
          >
            <CardFrontContent prize={prize} size={size} priority={priority} />
          </div>
        </div>

        {/* Back face */}
        <div
          data-face="back"
          aria-hidden={revealed ? true : undefined}
          className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border border-gp-green-deep bg-gp-green-deep [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{
            backgroundImage: "url('/assets/textures/card-back-pattern.webp')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-gp-gold">
            <Image
              src="/brand/logo/isotipo-white.svg"
              alt={BRAND_NAME}
              width={40}
              height={40}
              className="rounded-full"
            />
          </div>
          <span className="absolute bottom-3 text-[8px] uppercase tracking-[0.3em] text-gp-gold/70">
            Temporada 2026
          </span>
        </div>
      </div>

      {/* Confetti dorado al revelar premios reales (sobre la animacion de flip) */}
      {showConfetti ? <Confetti delay={confettiDelay} /> : null}
    </div>
  );
}

export default Card;
