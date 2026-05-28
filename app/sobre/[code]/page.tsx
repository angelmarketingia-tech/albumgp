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
//   - El render del pack es deliberadamente minimal: 5 `<div>`s. Cuando el
//     agente de diseño termine los componentes ricos (PackReveal, Card),
//     este archivo importa esos componentes y deja de hacer el grid plano.

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import {
  DEPOSIT_URLS,
  LEGAL_NOTICES,
} from "@/lib/brand/constants";
import {
  normalizeCode,
  packResultSchema,
  type PackResult,
  type Prize,
} from "@/lib/prizes";
import {
  formatCodeDisplay,
  prizeShortDescription,
  rarityLabel,
} from "@/lib/ui/format";

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

// ---------- Render helpers (minimal placeholders) ----------------------------

function PrizeMeta({ prize }: { prize: Prize }): JSX.Element {
  switch (prize.type) {
    case "sports_credit":
      return (
        <p className="text-lg font-semibold text-gp-gold">
          {prize.amount} {prize.currency}
        </p>
      );
    case "casino_spins":
      return (
        <>
          <p className="text-lg font-semibold text-gp-gold">
            {prize.count} giros
          </p>
          <p className="text-xs text-white/70">{prize.game_name}</p>
        </>
      );
    case "deposit_match":
      return (
        <p className="text-lg font-semibold text-gp-gold">
          x{prize.multiplier}
        </p>
      );
    case "physical":
      return <p className="text-sm text-white">{prize.label}</p>;
    case "external_code":
      return <p className="text-sm text-white">{prize.provider}</p>;
    case "collectible":
      return (
        <p className="text-xs uppercase tracking-wider text-white/80">
          {rarityLabel(prize.rarity)}
        </p>
      );
    case "none":
      return <p className="text-sm text-white/60">Sin premio</p>;
    default: {
      const _exhaustive: never = prize;
      void _exhaustive;
      return <></>;
    }
  }
}

function PrizeCard({
  prize,
  guaranteed,
}: {
  prize: Prize;
  guaranteed: boolean;
}): JSX.Element {
  const isNone = prize.type === "none";
  return (
    <div
      aria-label={prizeShortDescription(prize)}
      className={[
        "flex aspect-[2/3] flex-col justify-between rounded-lg border p-3 text-center",
        isNone
          ? "border-white/20 bg-white/5 text-white/50"
          : "border-white/30 bg-white/10 text-white",
      ].join(" ")}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
        {guaranteed ? "Garantizado" : "Sorpresa"}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-1">
        <PrizeMeta prize={prize} />
      </div>
      <div className="text-[11px] leading-tight text-white/80">
        {prize.label || prizeShortDescription(prize)}
      </div>
    </div>
  );
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
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-5 text-center">
        <Logo variant="blanco" width={140} />
        <div>
          <h1 className="font-display text-2xl font-bold text-white">
            {heading}
          </h1>
          <p className="mt-2 text-sm text-white/80">{detail}</p>
        </div>
        <Link
          href="/"
          className="rounded bg-gp-gold px-4 py-3 font-semibold text-gp-gray-dark-2"
        >
          Volver a inicio
        </Link>
      </main>
    );
  }

  const { pack, country } = outcome;
  const depositUrl = DEPOSIT_URLS[country];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-5 pb-8 pt-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <Logo variant="blanco" width={140} />
        <h1 className="font-display text-2xl font-bold text-white">
          Tu sobre
        </h1>
        <p className="font-mono text-xs tracking-wider text-white/70">
          {formatCodeDisplay(normalized)}
        </p>
      </header>

      <section
        aria-label="Cartas reveladas"
        className="grid grid-cols-3 gap-3"
      >
        {pack.guaranteed.map((prize, i) => (
          <PrizeCard
            key={`g-${String(i)}`}
            prize={prize}
            guaranteed
          />
        ))}
        {pack.variable.map((prize, i) => (
          <PrizeCard
            key={`v-${String(i)}`}
            prize={prize}
            guaranteed={false}
          />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <Link
          href={`/canjear?code=${encodeURIComponent(normalized)}`}
          className="block rounded bg-gp-gold px-4 py-3 text-center font-semibold text-gp-gray-dark-2"
        >
          Canjear premios
        </Link>
        <a
          href={depositUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded border border-white/40 px-4 py-3 text-center text-sm text-white/90"
        >
          Depósitos
        </a>
      </section>

      <footer className="mt-auto pt-6 text-center text-xs text-white/70">
        <p>{LEGAL_NOTICES.ageGate}</p>
        <p className="mt-1">{LEGAL_NOTICES.responsibleGaming}</p>
      </footer>
    </main>
  );
}
