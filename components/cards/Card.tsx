"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { JSX } from "react";

import type { Prize, CollectiblePrize } from "@/lib/prizes/types";
import { BRAND_NAME } from "@/lib/brand/constants";

import { PrizeIcon } from "./PrizeIcon";
import { RarityBadge } from "./RarityBadge";

/**
 * Carta primitiva del sobre. Renderiza el premio según su `type` del
 * discriminated union `Prize` (ver lib/prizes/types.ts).
 *
 * Diseño:
 *  - Aspect ratio 2:3 fijo (igual que el ratio definido en AGENTS.md §9).
 *  - 3 tamaños (sm 128x192, md 192x288, lg 256x384).
 *  - Borde verde por default; gradiente dorado para coleccionables
 *    epic / legendary.
 *  - Reveal con flip 3D (rotateY 180 -> 0, 500ms) cuando `revealed=true`,
 *    respetando `delay` (en ms). Si `revealed=false`, muestra dorso verde
 *    con isotipo blanco.
 *  - Hover (md/lg) escala 1.02 (whileHover de motion.div).
 *
 * NO contiene lógica de fetch ni de estado de pack — eso vive en
 * `PackReveal` y en el contenedor de página (Frontend Ola 2).
 */

export type CardSize = "sm" | "md" | "lg";

export interface CardProps {
  prize: Prize;
  /** Si `false`, mostramos el dorso. Default `true`. */
  revealed?: boolean;
  /** Retraso del flip-in en milisegundos. Default `0`. */
  delay?: number;
  size?: CardSize;
}

const SIZE_CLS: Record<CardSize, string> = {
  sm: "w-32 h-48",
  md: "w-48 h-72",
  lg: "w-64 h-96",
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

function isLegendaryOrEpic(prize: Prize): prize is CollectiblePrize {
  return (
    prize.type === "collectible" &&
    (prize.rarity === "epic" || prize.rarity === "legendary")
  );
}

function CardFrontContent({
  prize,
  size,
}: {
  prize: Prize;
  size: CardSize;
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
            {prize.amount}
          </p>
          <p
            className={`font-sans font-bold uppercase tracking-wide text-gp-green ${LABEL_TEXT_CLS[size]}`}
          >
            {prize.currency}
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
    case "physical":
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-gp-gray-dark-2">
          <PrizeIcon type="physical" className="h-10 w-10 text-gp-green" />
          <p
            className={`font-sans font-bold uppercase tracking-wide text-gp-green ${LABEL_TEXT_CLS[size]}`}
          >
            {prize.label}
          </p>
        </div>
      );
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
      return (
        <div className="relative flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-gp-gray-dark-2">
          <div className="absolute right-2 top-2">
            <RarityBadge rarity={prize.rarity} />
          </div>
          {imageUrl !== undefined ? (
            <div className="relative h-3/5 w-3/5">
              <Image
                src={imageUrl}
                alt={prize.label}
                fill
                sizes="(max-width: 768px) 33vw, 192px"
                className="object-contain"
              />
            </div>
          ) : (
            <PrizeIcon
              type="collectible"
              className="h-12 w-12 text-gp-green"
            />
          )}
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
}: CardProps): JSX.Element {
  const sizeCls = SIZE_CLS[size];
  const isNone = prize.type === "none";
  const isPremiumCollectible = isLegendaryOrEpic(prize);

  const borderCls = isPremiumCollectible
    ? "border-2 border-transparent bg-gp-gold-gradient"
    : "border border-gp-green";

  const surfaceCls = isNone
    ? "bg-gp-gray-light/30"
    : "bg-gradient-to-b from-gp-white to-gp-gray-light/30";

  const allowHover = size !== "sm";
  const hoverProps = allowHover ? { whileHover: { scale: 1.02 } } : {};

  return (
    <motion.div
      data-card
      data-prize-type={prize.type}
      data-revealed={revealed ? "true" : "false"}
      className={`${sizeCls} relative rounded-lg shadow-lg [perspective:1000px]`}
      {...hoverProps}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
    >
      <motion.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        initial={revealed ? { rotateY: 180 } : { rotateY: 0 }}
        animate={revealed ? { rotateY: 0 } : { rotateY: 180 }}
        transition={{ duration: 0.5, delay: delay / 1000 }}
      >
        {/* Front face */}
        <div
          data-face="front"
          className={`absolute inset-0 flex flex-col rounded-lg ${borderCls} [backface-visibility:hidden]`}
        >
          <div
            className={`flex h-full w-full flex-col rounded-[7px] ${surfaceCls}`}
          >
            <CardFrontContent prize={prize} size={size} />
          </div>
        </div>

        {/* Back face */}
        <div
          data-face="back"
          aria-hidden={revealed ? true : undefined}
          className="absolute inset-0 flex items-center justify-center rounded-lg border border-gp-green-deep bg-gp-radial [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <span className="font-display text-lg font-bold uppercase tracking-widest text-gp-white">
            {BRAND_NAME}
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default Card;
