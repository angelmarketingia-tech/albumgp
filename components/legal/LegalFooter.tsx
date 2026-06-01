// Shared footer: the two mandatory notices (18+, responsible gaming) plus links
// to the privacy policy and terms. Used across entry / sobre / album / canjear
// so every screen has a reachable legal path (store requirement) without
// duplicating markup.

import type { JSX } from "react";
import Link from "next/link";
import { LEGAL_NOTICES } from "@/lib/brand/constants";

export function LegalFooter({
  className = "mt-auto pt-10",
}: {
  className?: string;
}): JSX.Element {
  return (
    <footer className={`${className} text-center text-xs text-white/85`}>
      <p>{LEGAL_NOTICES.ageGate}</p>
      <p className="mt-1">{LEGAL_NOTICES.responsibleGaming}</p>
      <nav className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-white/70">
        <Link href="/privacidad" className="underline hover:text-gp-gold">
          Privacidad
        </Link>
        <Link href="/terminos" className="underline hover:text-gp-gold">
          Términos
        </Link>
      </nav>
    </footer>
  );
}
