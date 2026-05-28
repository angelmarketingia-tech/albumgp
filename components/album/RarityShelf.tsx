import Image from "next/image";
import type { JSX } from "react";

import { RarityBadge } from "@/components/cards/RarityBadge";
import type { CollectibleSlot } from "@/lib/album/group";

/**
 * "Repisa" de coleccionables de una sola rareza. Se compone de:
 *   - header con `<RarityBadge>`, nombre de la rareza, y conteo;
 *   - grilla responsive de slots con aspect 2:3 (mismo ratio que `<Card>`),
 *     placeholder gris cuando no hay `image_url`, badge `x{count}` cuando la
 *     carta se obtuvo más de una vez.
 *
 * Server component — sin estado. Si `slots.length === 0` retorna `null`
 * para que la página decida si esconde o muestra buckets vacíos.
 */

export type ShelfRarity = "common" | "rare" | "epic" | "legendary";

export interface RarityShelfProps {
  rarity: ShelfRarity;
  slots: CollectibleSlot[];
}

const HEADER_LABEL: Record<ShelfRarity, string> = {
  common: "Comunes",
  rare: "Raras",
  epic: "Épicas",
  legendary: "Legendarias",
};

function CollectibleTile({ slot }: { slot: CollectibleSlot }): JSX.Element {
  const hasImage = slot.image_url !== undefined && slot.image_url.length > 0;

  return (
    <div
      data-collectible-id={slot.collectible_id}
      data-rarity={slot.rarity}
      className="relative flex aspect-[2/3] flex-col items-center justify-center overflow-hidden rounded border border-white/20 bg-white p-2 text-center"
    >
      {hasImage ? (
        <div className="relative h-3/5 w-3/5">
          <Image
            src={slot.image_url ?? ""}
            alt={slot.label}
            fill
            sizes="(max-width: 768px) 25vw, 128px"
            className="object-contain"
          />
        </div>
      ) : (
        <div
          aria-hidden
          className="flex h-3/5 w-3/5 items-center justify-center rounded bg-gp-gray-light/40"
        />
      )}
      <p className="mt-1 line-clamp-2 font-sans text-[10px] font-bold uppercase tracking-wide text-gp-green">
        {slot.label}
      </p>
      {slot.count > 1 ? (
        <span
          data-count-badge
          className="absolute bottom-1 right-1 rounded bg-gp-gray-dark-2/90 px-1.5 py-0.5 font-sans text-[10px] font-bold text-white"
        >
          x{slot.count}
        </span>
      ) : null}
    </div>
  );
}

export function RarityShelf({ rarity, slots }: RarityShelfProps): JSX.Element | null {
  if (slots.length === 0) {
    return null;
  }

  return (
    <section
      aria-label={`Coleccionables ${HEADER_LABEL[rarity].toLowerCase()}`}
      data-rarity-shelf={rarity}
      className="flex flex-col gap-3"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <RarityBadge rarity={rarity} />
          <h2 className="font-display text-lg font-bold text-white">
            {HEADER_LABEL[rarity]}
          </h2>
        </div>
        <span className="font-sans text-xs text-white/70">
          {slots.length}
        </span>
      </header>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
        {slots.map((slot) => (
          <CollectibleTile key={slot.collectible_id} slot={slot} />
        ))}
      </div>
    </section>
  );
}

export default RarityShelf;
