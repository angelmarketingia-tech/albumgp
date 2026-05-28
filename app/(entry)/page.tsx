// Entry page — pantalla de input de código (server component).
//
// AGENTS.md §3 (flujo abrir vs canjear), §12 (avisos legales).
// SECURITY.md §2 (validación) + §5 (respuestas genéricas).
//
// Sólo HTML + Tailwind plano. Los componentes ricos (cards/envelope) los
// está construyendo el agente de diseño en paralelo; cuando estén listos
// se hace el swap sin tocar este archivo.

import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { LEGAL_NOTICES } from "@/lib/brand/constants";
import { EntryForm } from "./EntryForm";

export const dynamic = "force-dynamic";

export default function EntryPage(): JSX.Element {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-8 pt-10">
      <div className="flex flex-col items-center gap-6 text-center">
        <Logo variant="blanco" width={180} priority />

        <header className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-bold text-white">
            Abrí tu sobre
          </h1>
          <p className="text-sm text-white/80">
            Ingresá el código que recibiste para revelar tus premios.
          </p>
        </header>
      </div>

      <section className="mt-8">
        <EntryForm />
      </section>

      <section className="mt-6">
        <Link
          href="/auth/signin?callbackUrl=/album"
          className="block w-full rounded border border-white/40 px-4 py-3 text-center text-sm text-white/90 transition-opacity hover:opacity-90"
        >
          Iniciar sesión para reclamar premios
        </Link>
      </section>

      <footer className="mt-auto pt-10 text-center text-xs text-white/70">
        <p>{LEGAL_NOTICES.ageGate}</p>
        <p className="mt-1">{LEGAL_NOTICES.responsibleGaming}</p>
      </footer>
    </main>
  );
}
