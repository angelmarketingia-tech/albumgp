// Reveal del pack — server component.
//
// AGENTS.md §3 (open vs redeem: ABRIR no consume, sólo revela), §4 (5 cartas,
// 3 garantizadas + 2 variables), §12 (avisos legales).
// SECURITY.md §2 (respuesta unificada 404 para todos los casos no disponibles)
// + §5 (códigos de error permitidos).
//
// Estrategia:
//   - El código viene en el path. Sin `?reveal=1` mostramos el sobre cerrado
//     (idle) — sólo hacemos un peek read-only del tier para el badge, NO
//     consumimos la apertura. Recién con `?reveal=1` llamamos a
//     `openCodeDirect` (compartido con /api/open) y renderizamos el pack.
//     Esto evita abrir el código en cada page-load (preview crawlers,
//     compartidos, refresh) y mantiene el rate-limit atribuido por IP real.

import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { EnvelopeBackground } from "@/components/envelope/EnvelopeBackground";
import { EnvelopeFlow } from "@/components/envelope/EnvelopeFlow";
import {
  DEPOSIT_URLS,
  LEGAL_NOTICES,
} from "@/lib/brand/constants";
import { prisma } from "@/lib/db/client";
import { openCodeDirect } from "@/lib/open/open-code";
import {
  type EnvelopeTier,
  normalizeCode,
  TIER_THEME,
  tierFromValue,
} from "@/lib/prizes";
import { extractClientIp } from "@/lib/redis/rate-limit";
import { formatCodeDisplay } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

// ---------- Page -------------------------------------------------------------

interface SobreSearchParams {
  reveal?: string | string[];
}

export default async function SobrePage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: SobreSearchParams;
}): Promise<JSX.Element> {
  // The URL param may be lowercased or hand-edited. Normalize before we
  // hit the server. If the format is broken, send the user back to /
  // — the entry page will explain what's expected.
  // WHY try/catch: malformed `%` sequences make decodeURIComponent throw
  // URIError, which would otherwise bubble up to global-error.tsx.
  let decoded: string;
  try {
    decoded = decodeURIComponent(params.code);
  } catch {
    return redirect("/");
  }
  const normalized = normalizeCode(decoded);
  if (normalized === null) {
    return redirect("/");
  }

  // `?reveal=1` is set when the user taps the closed envelope. Until
  // then we render the idle state WITHOUT hitting the open pipeline,
  // so refresh / preview crawlers / shared links don't bump rate-limit
  // buckets or burn the open.
  const shouldReveal = searchParams.reveal === "1";

  if (!shouldReveal) {
    // WHY peek: surface the tier badge before the tap so anticipation lands.
    // Read-only — we don't touch openedAt/packResult, so this does NOT consume
    // the open. Failures (DB down, missing row, unknown tier) fall back to a
    // generic idle so we never block the user from tapping.
    let idleTier: EnvelopeTier | undefined;
    try {
      const peek = await prisma.code.findUnique({
        where: { code: normalized },
        select: { status: true, prizeSet: { select: { tier: true } } },
      });
      if (peek && peek.status === "active") {
        idleTier = tierFromValue(peek.prizeSet?.tier) ?? undefined;
      }
    } catch {
      // swallow — idle render is best-effort, real validation happens on reveal
    }
    const idleTheme = idleTier ? TIER_THEME[idleTier] : undefined;
    return (
      <EnvelopeBackground>
        <section className="mb-6 flex flex-col items-center text-center">
          {idleTheme ? (
            <p
              data-tier={idleTier}
              className={`mb-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] shadow-sm ${idleTheme.badgeClass}`}
            >
              <span aria-hidden>★</span>
              <span>Sobre {idleTheme.label} — {idleTheme.tagline}</span>
            </p>
          ) : null}
          <h1 className="font-display text-2xl font-bold text-gp-white sm:text-3xl">
            Tu sobre
          </h1>
          <p className="mt-2 font-mono text-xs tracking-wider text-gp-gray-light sm:text-sm">
            {formatCodeDisplay(normalized)}
          </p>
        </section>
        <EnvelopeFlow
          initialStage="idle"
          tier={idleTier}
          pack={undefined}
          openHref={`/sobre/${encodeURIComponent(normalized)}?reveal=1`}
        />
      </EnvelopeBackground>
    );
  }

  // From here on we're committed to opening: pass the real client IP +
  // UA from the RSC headers() bag so per-IP rate-limit attribution
  // matches what /api/open sees.
  const h = headers();
  const ip = extractClientIp(
    new Request("http://internal.local", { headers: h }),
  );
  const userAgent = h.get("user-agent") ?? undefined;
  const result = await openCodeDirect({
    code: normalized,
    ip,
    ...(userAgent !== undefined ? { userAgent } : {}),
  });

  if (!result.ok) {
    // WHY notFound on 404: keeps HTTP status truthful for invalid codes
    // (was returning 200 + in-band error markup before).
    if (result.status === 404) {
      notFound();
    }
    const heading =
      result.body.error === "rate_limited"
        ? "Probaste demasiadas veces"
        : "Este código no está disponible";
    const detail =
      result.body.error === "rate_limited"
        ? "Esperá un minuto antes de volver a intentarlo."
        : "Revisá que esté bien escrito o volvé al inicio para probar otro.";
    return (
      <main id="main-content" className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-5 text-center bg-gp-radial">
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

  const { pack, country, tier } = result.body;
  const depositUrl = DEPOSIT_URLS[country];
  // WHY internal route: /canjear handles SSO bounce + actual redeem.
  // Sending users straight to the external signin loses the code context
  // and breaks the product loop.
  const redeemHref = `/canjear?code=${encodeURIComponent(normalized)}`;
  const theme = TIER_THEME[tier];

  return (
    <EnvelopeBackground country={country}>
      <section className="mb-6 flex flex-col items-center text-center">
        <p
          role="status"
          aria-live="polite"
          data-tier={tier}
          className={`mb-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] shadow-sm ${theme.badgeClass}`}
        >
          <span aria-hidden>★</span>
          <span>Sobre {theme.label}</span>
        </p>
        <h1 className="font-display text-2xl font-bold text-gp-white sm:text-3xl">
          Tu sobre
        </h1>
        <p className="mt-1 text-xs text-gp-white/80 sm:text-sm">
          {theme.tagline}
        </p>
        <p className="mt-2 font-mono text-xs tracking-wider text-gp-gray-light sm:text-sm">
          {formatCodeDisplay(normalized)}
        </p>
      </section>

      <EnvelopeFlow
        pack={pack}
        country={country}
        tier={tier}
        openHref={`/sobre/${encodeURIComponent(normalized)}?reveal=1`}
        initialStage="revealing"
        ctaSlot={
          <section className="mx-auto flex w-full max-w-sm flex-col items-center gap-3">
            <p className="text-center text-xs text-gp-white/80 sm:text-sm">
              Iniciá sesión en tu cuenta GanaPlay para acreditar tus premios. El código solo se puede canjear una vez.
            </p>
            <Link
              href={redeemHref}
              className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-gp-green via-gp-green to-gp-green-core px-7 font-sans text-lg font-bold uppercase tracking-wide text-gp-white shadow-lg shadow-gp-green/40 transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-gp-gold focus-visible:ring-offset-2 focus-visible:ring-offset-gp-green-deep"
            >
              <span aria-hidden>✦</span>
              <span>Canjear premios</span>
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
