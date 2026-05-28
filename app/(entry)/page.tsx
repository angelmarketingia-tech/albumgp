// Entry page — pantalla de input de código.
//
// USA UN SERVER ACTION (no requiere hidratación de cliente para funcionar).
// El form POSTea al server action, el server valida el formato, y luego:
//   - Si el formato es inválido → vuelve a /?error=invalid
//   - Si es válido → redirige a /sobre/<code>
// La página /sobre/<code> hace su propio fetch a /api/open en SSR. Esto
// significa que el flujo entero (abrir + revelar) funciona aún con JS
// completamente deshabilitado en el navegador.
//
// AGENTS.md §3, §12 — flujo abrir/canjear + avisos legales.

import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { LEGAL_NOTICES } from "@/lib/brand/constants";
import { normalizeCode } from "@/lib/prizes/input-schemas";

export const dynamic = "force-dynamic";

interface SearchParams {
  error?: string;
}

async function openCodeAction(formData: FormData): Promise<void> {
  "use server";
  const raw = formData.get("code");
  if (typeof raw !== "string") {
    redirect("/?error=invalid");
  }
  const normalized = normalizeCode(raw);
  if (normalized === null) {
    redirect("/?error=invalid");
  }
  redirect(`/sobre/${encodeURIComponent(normalized)}`);
}

export default function EntryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): JSX.Element {
  const showError = searchParams.error === "invalid";

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
        <form action={openCodeAction} className="flex flex-col gap-4">
          <input
            name="code"
            type="text"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus
            required
            maxLength={20}
            placeholder="Pegá tu código aquí"
            aria-label="Código de canje"
            className="w-full rounded-md border-2 border-gp-green bg-gp-white px-4 py-3 text-center font-mono text-lg uppercase tracking-wider text-gp-gray-dark-2 placeholder:text-gp-gray-light focus:outline-none focus:ring-2 focus:ring-gp-gold sm:text-xl"
          />

          {showError ? (
            <p role="alert" className="text-sm text-red-300">
              Código inválido o no disponible
            </p>
          ) : null}

          <button
            type="submit"
            className="inline-flex h-14 items-center justify-center rounded-md bg-gp-white px-7 text-lg font-sans font-bold uppercase tracking-wide text-gp-green transition-colors hover:bg-gp-gray-light/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-gp-gold focus-visible:ring-offset-2 focus-visible:ring-offset-gp-green"
          >
            Abrir sobre
          </button>
        </form>
      </section>

      <section className="mt-6">
        <a
          href="/auth/signin?callbackUrl=/album"
          className="block w-full rounded border border-white/40 px-4 py-3 text-center text-sm text-white/90 transition-opacity hover:opacity-90"
        >
          Iniciar sesión para reclamar premios
        </a>
      </section>

      <footer className="mt-auto pt-10 text-center text-xs text-white/70">
        <p>{LEGAL_NOTICES.ageGate}</p>
        <p className="mt-1">{LEGAL_NOTICES.responsibleGaming}</p>
      </footer>
    </main>
  );
}
