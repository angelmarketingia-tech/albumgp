// Shared chrome for the legal pages (/privacidad, /terminos). Server component.
// Keeps the brand frame (logo, green background, footer notices) consistent and
// gives both documents the same readable prose column on mobile and desktop.

import type { JSX, ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { LEGAL_NOTICES } from "@/lib/brand/constants";

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  /** Human-readable "last updated" string, e.g. "1 de junio de 2026". */
  updated: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-5 pb-12 pt-8"
    >
      <header className="flex flex-col items-center gap-4 text-center">
        <Link href="/" aria-label="Volver al inicio">
          <Logo variant="blanco" width={150} />
        </Link>
        <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
          {title}
        </h1>
        <p className="text-xs text-white/60">Última actualización: {updated}</p>
      </header>

      {/* `legal-prose` styles headings/paragraphs/lists consistently — defined
          in globals.css so both documents share one type scale. */}
      <article className="legal-prose rounded-2xl border border-white/15 bg-white/5 p-6 shadow-glass">
        {children}
      </article>

      <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/80">
        <Link href="/" className="underline hover:text-gp-gold">
          Inicio
        </Link>
        <Link href="/privacidad" className="underline hover:text-gp-gold">
          Privacidad
        </Link>
        <Link href="/terminos" className="underline hover:text-gp-gold">
          Términos
        </Link>
      </nav>

      <footer className="mt-auto pt-6 text-center text-xs text-white/70">
        <p>{LEGAL_NOTICES.ageGate}</p>
        <p className="mt-1">{LEGAL_NOTICES.responsibleGaming}</p>
      </footer>
    </main>
  );
}
