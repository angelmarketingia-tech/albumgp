import type { JSX } from "react";

import type { CollectiblePrize } from "@/lib/prizes/types";

/**
 * Badge de rareza para cartas coleccionables (no canjeables).
 *
 * Mapeo de colores:
 *  - common    -> gris claro (gp.gray-light)
 *  - rare      -> verde de marca (gp.green)
 *  - epic      -> púrpura (color local, ver `EPIC_COLOR` abajo)
 *  - legendary -> gradiente dorado (`bg-gp-gold-gradient`)
 *
 * Tipografía: DM Sans bold, uppercase, tracking-wide, text-xs.
 */
export type Rarity = CollectiblePrize["rarity"];

export interface RarityBadgeProps {
  rarity: Rarity;
}

/**
 * [CONFIRMAR_EPIC_COLOR] — El Manual de Marca no define color para
 * rareza "epic". Usamos un púrpura sobrio como placeholder local. NO
 * añadir al tailwind.config (queda contenido aquí hasta confirmación).
 */
const EPIC_COLOR = "#5A3E9F";

const RARITY_LABELS: Record<Rarity, string> = {
  common: "Común",
  rare: "Rara",
  epic: "Épica",
  legendary: "Legendaria",
};

const BASE_CLS =
  "inline-flex items-center font-sans font-bold uppercase tracking-wide text-xs px-2 py-0.5 rounded-sm select-none";

export function RarityBadge({ rarity }: RarityBadgeProps): JSX.Element {
  const label = RARITY_LABELS[rarity];

  switch (rarity) {
    case "common":
      return (
        <span
          data-rarity="common"
          className={`${BASE_CLS} bg-gp-gray-light text-gp-white`}
        >
          {label}
        </span>
      );
    case "rare":
      return (
        <span
          data-rarity="rare"
          className={`${BASE_CLS} bg-gp-green text-gp-white`}
        >
          {label}
        </span>
      );
    case "epic":
      return (
        <span
          data-rarity="epic"
          className={`${BASE_CLS} text-gp-white`}
          style={{ backgroundColor: EPIC_COLOR }}
        >
          {label}
        </span>
      );
    case "legendary":
      return (
        <span
          data-rarity="legendary"
          className={`${BASE_CLS} bg-gp-gold-gradient text-gp-white shadow-md`}
        >
          {label}
        </span>
      );
    default: {
      const _exhaustive: never = rarity;
      return <span data-rarity={String(_exhaustive)} />;
    }
  }
}

export default RarityBadge;
