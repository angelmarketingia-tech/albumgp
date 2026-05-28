// Reveal del pack — server component.
//
// AGENTS.md §3 (open vs redeem: ABRIR no consume, sólo revela), §4 (5 cartas,
// 3 garantizadas + 2 variables), §12 (avisos legales).
// SECURITY.md §2 (respuesta unificada 404 para todos los casos no disponibles)
// + §5 (códigos de error permitidos).
//
// Estrategia:
//   - El código viene en el path. Es seguro: el endpoint `/api/open` es
//     idempotente; re-abrir devuelve el mismo `pack_result` ya fijado.
//   - Llamamos al endpoint SSR para que el HTML inicial ya traiga el reveal
//     (un solo round-trip al cliente). Si el endpoint responde !ok mostramos
//     un mensaje genérico — nunca distinguimos "expirado" vs "consumido".
//   - Render rico: `EnvelopeBackground` + `PackReveal` + `ActionButton` de
//     Diseño Ola 1. La lógica de outcome / fetch no cambió respecto del
//     placeholder anterior.

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { EnvelopeBackground } from "@/components/envelope/EnvelopeBackground";
import { EnvelopeFlow } from "@/components/envelope/EnvelopeFlow";
import {
  DEPOSIT_URLS,
  LEGAL_NOTICES,
} from "@/lib/brand/constants";
import {
  normalizeCode,
  packResultSchema,
  type PackResult,
} from "@/lib/prizes";
import { formatCodeDisplay } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

interface OpenResponse {
  pack: PackResult;
  country: "SV" | "GT";
}

type OpenOutcome =
  | { kind: "ok"; pack: PackResult; country: "SV" | "GT" }
  | { kind: "not_found" }
  | { kind: "rate_limited" }
  | { kind: "error" };

/**
 * Build an absolute URL to our own `/api/open` from inside a server
 * component. We can't use a relative URL with `fetch` server-side, so we
 * read the incoming request's host header.
 */
function selfUrl(pathname: string): string {
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  // `x-forwarded-proto` is set by Vercel and any sane reverse proxy.
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}${pathname}`;
}

async function openCode(code: string): Promise<OpenOutcome> {
  let res: Response;
  try {
    res = await fetch(selfUrl("/api/open"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      cache: "no-store",
    });
  } catch {
    return { kind: "error" };
  }

  if (res.status === 429) {
    return { kind: "rate_limited" };
  }
  if (res.status === 404) {
    return { kind: "not_found" };
  }
  if (!res.ok) {
    return { kind: "error" };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { kind: "error" };
  }
  if (
    body === null ||
    typeof body !== "object" ||
    !("pack" in body) ||
    !("country" in body)
  ) {
    return { kind: "error" };
  }
  const { pack, country } = body as OpenResponse;
  const parsed = packResultSchema.safeParse(pack);
  if (!parsed.success) {
    return { kind: "error" };
  }
  if (country !== "SV" && country !== "GT") {
    return { kind: "error" };
  }
  return { kind: "ok", pack: parsed.data, country };
}

// ---------- Page -------------------------------------------------------------

export default async function SobrePage({
  params,
}: {
  params: { code: string };
}): Promise<JSX.Element> {
  // The URL param may be lowercased or hand-edited. Normalize before we
  // hit the server. If the format is broken, send the user back to /
  // — the entry page will explain what's expected.
  const normalized = normalizeCode(decodeURIComponent(params.code));
  if (normalized === null) {
    redirect("/");
  }

  const outcome = await openCode(normalized);

  if (outcome.kind !== "ok") {
    const heading =
      outcome.kind === "rate_limited"
        ? "Demasiados intentos"
        : "Este código no está disponible";
    const detail =
      outcome.kind === "rate_limited"
        ? "Esperá unos minutos y volvé a intentarlo."
        : "Probá con otro código o volvé a la pantalla principal.";
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-5 text-center bg-gp-radial">
        <Logo variant="blanco" width={140} />
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            {heading}
          </h1>
          <p className="mt-2 text-sm text-white/80">{detail}</p>
        </div>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-md bg-gp-white px-5 font-sans text-base font-bold uppercase tracking-wide text-gp-green shadow-md transition-colors hover:bg-gp-gray-light/90"
        >
          Volver a inicio
        </Link>
        <footer className="mt-4 text-center text-xs text-white/70">
          <p>{LEGAL_NOTICES.ageGate}</p>
          <p className="mt-1">{LEGAL_NOTICES.responsibleGaming}</p>
        </footer>
      </main>
    );
  }

  const { pack, country } = outcome;
  const depositUrl = DEPOSIT_URLS[country];

  return (
    <EnvelopeBackground country={country}>
      <section className="mb-6 flex flex-col items-center text-center">
        <h1 className="font-display text-2xl font-bold text-gp-white sm:text-3xl">
          Tu sobre
        </h1>
        <p className="mt-1 font-mono text-xs tracking-wider text-gp-gray-light sm:text-sm">
          {formatCodeDisplay(normalized)}
        </p>
      </section>

      <EnvelopeFlow
        pack={pack}
        country={country}
        ctaSlot={
          <section className="mx-auto flex w-full max-w-sm flex-col items-center gap-3">
            <Link
              href={`/canjear?code=${encodeURIComponent(normalized)}`}
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-gp-green via-gp-green to-emerald-500 px-7 font-sans text-lg font-bold uppercase tracking-wide text-gp-white shadow-lg shadow-gp-green/40 transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-gp-gold focus-visible:ring-offset-2 focus-visible:ring-offset-gp-green-deep"
            >
              <span aria-hidden>✦</span>
              <span>Guardar en álbum</span>
              <span aria-hidden>✦</span>
            </Link>
            <a
              href={depositUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 w-full items-center justify-center rounded-md border border-gp-white bg-transparent px-5 font-sans text-base font-bold uppercase tracking-wide text-gp-white transition-colors hover:bg-gp-white/10 focus-visible:ring-2 focus-visible:ring-gp-gold focus-visible:ring-offset-2 focus-visible:ring-offset-gp-green"
            >
              Depositar para apostar
            </a>
          </section>
        }
      />
    </EnvelopeBackground>
  );
}
