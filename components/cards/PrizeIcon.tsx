import type { JSX } from "react";

import type { PrizeType } from "@/lib/prizes/types";

/**
 * Iconos primitivos SVG inline para cada `PrizeType`.
 *
 * Diseñados deliberadamente simples (stroke-only, currentColor) para
 * heredar el color de marca desde el contenedor sin acoplar HEX en este
 * archivo. Tamaño por `className` (Tailwind `h-* w-*`).
 *
 * No reemplazan la ilustración final de las cartas (Diseño los entregará
 * en Fase 4 Ola 2-3); cumplen como placeholders de identificación de
 * tipo de premio.
 */
export interface PrizeIconProps {
  type: PrizeType;
  className?: string;
}

const STROKE_PROPS = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function PrizeIcon({ type, className }: PrizeIconProps): JSX.Element {
  const props = {
    viewBox: "0 0 24 24",
    "aria-hidden": true,
    "data-prize-icon": type,
    className,
    ...STROKE_PROPS,
  };

  switch (type) {
    case "sports_credit":
      // Shield
      return (
        <svg {...props}>
          <path d="M12 3 4 6v6c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V6l-8-3Z" />
        </svg>
      );
    case "casino_spins":
      // Refresh circle
      return (
        <svg {...props}>
          <path d="M20 12a8 8 0 1 1-2.34-5.66" />
          <path d="M20 4v4h-4" />
        </svg>
      );
    case "deposit_match":
      // Arrow-up with multiplier mark
      return (
        <svg {...props}>
          <path d="M12 20V6" />
          <path d="m6 12 6-6 6 6" />
          <path d="M4 4l2 2M20 4l-2 2" />
        </svg>
      );
    case "physical":
      // Gift
      return (
        <svg {...props}>
          <path d="M3 10h18v4H3z" />
          <path d="M5 14v7h14v-7" />
          <path d="M12 10v11" />
          <path d="M12 10c-2 0-4-1.5-4-3.5S9.5 4 12 6c2.5-2 4-1.5 4 .5S14 10 12 10Z" />
        </svg>
      );
    case "external_code":
      // Code braces { }
      return (
        <svg {...props}>
          <path d="M8 4c-2 0-3 1-3 3v3c0 1-.5 2-2 2 1.5 0 2 1 2 2v3c0 2 1 3 3 3" />
          <path d="M16 4c2 0 3 1 3 3v3c0 1 .5 2 2 2-1.5 0-2 1-2 2v3c0 2-1 3-3 3" />
        </svg>
      );
    case "collectible":
      // Person silhouette (placeholder for collectible character art)
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 21c0-4 3-7 7-7s7 3 7 7" />
        </svg>
      );
    case "none":
      // X circle
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="9" />
          <path d="m9 9 6 6M15 9l-6 6" />
        </svg>
      );
    default: {
      // Exhaustiveness guard. If a new PrizeType is added, TS will fail
      // here on `_exhaustive`.
      const _exhaustive: never = type;
      return <svg {...props} data-unknown={String(_exhaustive)} />;
    }
  }
}

export default PrizeIcon;
