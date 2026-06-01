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

import Image from "next/image";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { CodeInput } from "@/components/ui/CodeInput";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { LEGAL_NOTICES } from "@/lib/brand/constants";
import { normalizeCode } from "@/lib/prizes/input-schemas";
import { ENVELOPE_TIERS, TIER_THEME } from "@/lib/prizes";

// No `force-dynamic`: the entry page has no request-time data (no headers/cookies),
// only a server action + `searchParams.error`. Letting Next statically prerender
// the shell keeps it edge-cacheable and lightweight per AGENTS.md §8 (the entry
// page must be "estática/edge-cacheable y ligerísima"). Server-action POSTs
// bypass the cache naturally; the error banner renders from searchParams on demand.

interface SearchParams {
  error?: string;
}

async function openCodeAction(formData: FormData): Promise<void> {
  "use server";
  const raw = formData.get("code");
  // Explicit `return redirect(...)` per guard so a future try/catch refactor
  // can't accidentally let normalizeCode run on a non-string.
  if (typeof raw !== "string") {
    return redirect("/?error=invalid");
  }
  const normalized = normalizeCode(raw);
  if (normalized === null) {
    return redirect("/?error=invalid");
  }
  return redirect(`/sobre/${encodeURIComponent(normalized)}`);
}

export default function EntryPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): JSX.Element {
  // Mapeo de ErrorCode → mensaje humano. El server action redirige con
  // ?error=<code> y acá traducimos. Cualquier código desconocido cae en null.
  const errorMessage: string | null = (() => {
    switch (searchParams.error) {
      case "invalid":
        return null; // mensaje detallado de formato se renderiza inline abajo
      case "rate_limited":
        return "Esperá un minuto antes de probar otro código";
      case "not_found_or_unavailable":
        return "Ese código no existe o ya fue usado";
      case "unauthenticated":
        return "Tenés que iniciar sesión primero";
      case "conflict":
        return "Ese código ya fue canjeado";
      default:
        return null;
    }
  })();
  const showError = searchParams.error === "invalid" || errorMessage !== null;

  return (
    <main id="main-content" className="relative mx-auto flex min-h-screen max-w-md flex-col px-5 pb-8 pt-10">
      <a
        href="/auth/signin?callbackUrl=/album"
        className="absolute top-5 right-5 text-sm text-white/70 transition-colors hover:text-gp-gold"
      >
        Ver mi álbum →
      </a>

      <div className="flex flex-col items-center gap-4 text-center">
        <Logo variant="blanco" width={180} priority />
      </div>

      {/* Hero section — la imagen es opaca y va como fondo full-bleed.
          `-mx-5` rompe el padding horizontal de <main> para sangrar al borde. */}
      <section className="relative -mx-5 mt-6 h-72 overflow-hidden sm:h-80">
        <Image
          src="/assets/marketing/hero-envelopes.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* Gradient hacia el verde profundo para que el siguiente bloque
            (form) se sienta continuo con la pagina. */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gp-green-deep/40 to-gp-green-deep" />
        <header className="relative z-10 flex h-full flex-col items-center justify-center px-5 text-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.5em] text-gp-gold/90">
            TEMPORADA 2026
          </span>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl font-black text-display-balance text-white drop-shadow-lg">
            Abrí tu sobre
          </h1>
          <p className="mt-2 text-base text-white/85 italic">
            Tu próximo premio espera adentro.
          </p>
        </header>
      </section>

      <section className="mt-6 rounded-2xl border border-white/15 bg-white/8 p-5 shadow-glass backdrop-blur-xl">
        <form action={openCodeAction} className="flex flex-col gap-4">
          <label
            htmlFor="code-input"
            className="sr-only sm:not-sr-only sm:text-sm sm:font-bold sm:uppercase sm:tracking-widest sm:text-white/80"
          >
            Código de canje
          </label>
          <CodeInput
            name="code"
            id="code-input"
            autoComplete="one-time-code"
            autoFocus
            required
            maxLength={16}
            placeholder="Pegá tu código aquí"
            aria-describedby="code-help"
            className="h-14 rounded-xl bg-black/30 border border-white/20 text-white placeholder:text-white/40 text-center font-mono text-xl tracking-[0.4em] focus:border-gp-gold focus:ring-2 focus:ring-gp-gold/30 outline-none"
          />
          <p id="code-help" className="text-[11px] text-white/85">
            16 caracteres. Letras y números, sin I, O, 0 ni 1.
          </p>

          {showError ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200"
            >
              <span aria-hidden>⚠</span>
              <span>
                {errorMessage !== null ? (
                  errorMessage
                ) : (
                  <>
                    Ese código no tiene el formato correcto. Revisá que sean{" "}
                    <strong>16 caracteres</strong> (letras y números, sin{" "}
                    <span className="font-mono">I</span>,{" "}
                    <span className="font-mono">O</span>,{" "}
                    <span className="font-mono">0</span> ni{" "}
                    <span className="font-mono">1</span>).
                  </>
                )}
              </span>
            </p>
          ) : null}

          <SubmitButton />
        </form>
      </section>

      <section className="mt-8" aria-label="Tipos de sobre">
        <h2 className="mb-3 text-center text-xs font-bold uppercase tracking-[0.2em] text-white/70">
          Tipos de sobre
        </h2>
        <ul className="grid grid-cols-4 gap-3">
          {ENVELOPE_TIERS.map((t) => {
            const theme = TIER_THEME[t];
            return (
              <li key={t} className="flex flex-col items-center gap-2">
                <Image
                  src={`/assets/tiers/mini-${t}.webp`}
                  alt=""
                  width={120}
                  height={160}
                  className="h-auto w-full"
                />
                <span className="text-xs font-bold uppercase tracking-widest text-white/80">
                  {theme.label}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-center text-[11px] leading-snug text-white/85">
          Al ingresar tu código vas a ver qué tier te tocó.
        </p>
      </section>

      <footer className="mt-auto pt-10 text-center text-xs text-white/85">
        <p>{LEGAL_NOTICES.ageGate}</p>
        <p className="mt-1">{LEGAL_NOTICES.responsibleGaming}</p>
      </footer>
    </main>
  );
}
