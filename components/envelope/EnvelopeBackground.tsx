import type { JSX, ReactNode } from "react";

import { Logo } from "@/components/brand/Logo";
import { GANAPLAY_SLOGAN, LEGAL_NOTICES } from "@/lib/brand/constants";

/**
 * Fondo de marca compartido por la experiencia del sobre (entry, open,
 * pack reveal). Server component — no contiene estado ni interactividad.
 *
 * Estructura:
 *  - `min-h-screen` con gradiente radial de marca (`bg-gp-radial`).
 *  - Header: logo blanco + slogan oficial (`font-display`).
 *  - Centro: `{children}` constreñido a `max-w-6xl mx-auto px-4`.
 *  - Footer: avisos legales obligatorios (Solo +18, Juega responsablemente).
 *
 * `country` queda recibido para variantes futuras (p. ej. asset distinto
 * por país); por ahora el render es idéntico para SV y GT pero el tipo lo
 * fuerza en el call site.
 */
export interface EnvelopeBackgroundProps {
  country: "SV" | "GT";
  children: ReactNode;
}

export function EnvelopeBackground({
  country,
  children,
}: EnvelopeBackgroundProps): JSX.Element {
  return (
    <div
      data-envelope-bg
      data-country={country}
      className="flex min-h-screen flex-col bg-gp-radial text-gp-white"
    >
      <header className="flex flex-col items-center gap-3 px-4 pt-8 text-center">
        <Logo variant="blanco" width={180} priority />
        <p className="font-display text-base italic text-gp-white sm:text-lg">
          {GANAPLAY_SLOGAN}
        </p>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-8">{children}</div>
      </main>

      <footer className="px-4 pb-6 pt-4 text-center text-xs text-gp-gray-light">
        <span>{LEGAL_NOTICES.ageGate}</span>
        <span aria-hidden className="mx-2">
          ·
        </span>
        <span>{LEGAL_NOTICES.responsibleGaming}</span>
      </footer>
    </div>
  );
}

export default EnvelopeBackground;
