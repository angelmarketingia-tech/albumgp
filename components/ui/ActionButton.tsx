import type { ButtonHTMLAttributes, JSX } from "react";

/**
 * Botón primitivo de la app. Tres variantes pensadas para fondo verde
 * (la mayoría de la UI vive sobre `bg-gp-radial`):
 *
 *  - `primary`   -> fondo blanco / texto verde (CTA principal).
 *  - `secondary` -> outline blanco sobre verde (CTA secundario).
 *  - `ghost`     -> solo texto blanco (acción de baja jerarquía).
 *
 * `loading` deshabilita el botón y muestra un spinner SVG animado vía
 * CSS (sin dependencias). El contenido visible se atenúa para mantener
 * el tamaño del botón.
 */

export type ActionButtonVariant = "primary" | "secondary" | "ghost";
export type ActionButtonSize = "sm" | "md" | "lg";

export interface ActionButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  loading?: boolean;
}

const VARIANT_CLS: Record<ActionButtonVariant, string> = {
  primary:
    "bg-gp-white text-gp-green hover:bg-gp-gray-light/90 focus-visible:ring-gp-gold",
  secondary:
    "border border-gp-white text-gp-white bg-transparent hover:bg-gp-white/10 focus-visible:ring-gp-gold",
  ghost:
    "bg-transparent text-gp-white hover:bg-gp-white/10 focus-visible:ring-gp-white",
};

const SIZE_CLS: Record<ActionButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-14 px-7 text-lg",
};

function Spinner(): JSX.Element {
  return (
    <svg
      data-action-spinner
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2.5"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ActionButton({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type,
  ...rest
}: ActionButtonProps): JSX.Element {
  const isDisabled = disabled === true || loading;

  const base =
    "inline-flex items-center justify-center gap-2 rounded-md font-sans font-bold uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-gp-green disabled:cursor-not-allowed disabled:opacity-60";

  const composed = [
    base,
    VARIANT_CLS[variant],
    SIZE_CLS[size],
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      // Explicit `type` default — buttons inside <form> would otherwise
      // submit on click.
      type={type ?? "button"}
      disabled={isDisabled}
      aria-busy={loading ? true : undefined}
      data-variant={variant}
      data-size={size}
      data-loading={loading ? "true" : "false"}
      className={composed}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      <span className={loading ? "opacity-80" : undefined}>{children}</span>
    </button>
  );
}

export default ActionButton;
