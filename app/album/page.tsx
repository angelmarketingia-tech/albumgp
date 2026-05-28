// Mi Álbum — server component.
//
// AGENTS.md §3 (Mi Álbum requiere sesión), §11 (redemptions auditadas),
// §12 (avisos legales).
// SECURITY.md §5 (sesión obligatoria → 401 en API; en UI bouncing a signin).
//
// Estrategia:
//   - `auth()` para chequear sesión. Sin sesión → redirect a /auth/signin.
//   - Fetch a `/api/album`. El endpoint ya existe (otro agente lo construyó).
//   - Si por alguna razón el endpoint falla / no parsea → empty state. NO
//     rompemos la página: el agente backend puede no haber desplegado todavía
//     en el flujo de dev, o puede haber un error transitorio.
//   - Render minimal de redemptions agrupadas por fecha. Las "5 cartas" son
//     `<div>`s simples — mismo placeholder que /sobre/[code].

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { auth } from "@/lib/auth/auth-config";
import { LEGAL_NOTICES } from "@/lib/brand/constants";
import type {
  AlbumRedemption,
  AlbumResponse,
} from "@/lib/album/types";
import type { Prize } from "@/lib/prizes/types";
import {
  formatRedeemedAt,
  prizeShortDescription,
  rarityLabel,
} from "@/lib/ui/format";

export const dynamic = "force-dynamic";

interface SearchParams {
  just_redeemed?: string | string[];
}

function selfUrl(pathname: string): string {
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}${pathname}`;
}

/**
 * Best-effort fetch + parse of `/api/album`. We forward the incoming
 * Cookie header so the API sees the same session as this RSC.
 *
 * Returns `null` on ANY failure — the caller renders an empty state rather
 * than a stack trace. This keeps the page resilient while the backend
 * agent is still finishing work in parallel.
 */
async function fetchAlbum(): Promise<AlbumResponse | null> {
  const h = headers();
  const cookie = h.get("cookie") ?? "";
  try {
    const res = await fetch(selfUrl("/api/album"), {
      method: "GET",
      headers: cookie.length > 0 ? { cookie } : {},
      cache: "no-store",
    });
    if (!res.ok) {
      return null;
    }
    const body = (await res.json()) as unknown;
    if (
      body === null ||
      typeof body !== "object" ||
      !Array.isArray((body as { redemptions?: unknown }).redemptions)
    ) {
      return null;
    }
    return body as AlbumResponse;
  } catch {
    return null;
  }
}

// ---------- Render helpers ---------------------------------------------------

function PrizeMeta({ prize }: { prize: Prize }): JSX.Element {
  switch (prize.type) {
    case "sports_credit":
      return (
        <p className="text-base font-semibold text-gp-gold">
          {prize.amount} {prize.currency}
        </p>
      );
    case "casino_spins":
      return (
        <>
          <p className="text-base font-semibold text-gp-gold">
            {prize.count} giros
          </p>
          <p className="text-[10px] text-white/70">{prize.game_name}</p>
        </>
      );
    case "deposit_match":
      return (
        <p className="text-base font-semibold text-gp-gold">
          x{prize.multiplier}
        </p>
      );
    case "physical":
      return <p className="text-xs text-white">{prize.label}</p>;
    case "external_code":
      return <p className="text-xs text-white">{prize.provider}</p>;
    case "collectible":
      return (
        <p className="text-[10px] uppercase tracking-wider text-white/80">
          {rarityLabel(prize.rarity)}
        </p>
      );
    case "none":
      return <p className="text-xs text-white/60">Sin premio</p>;
    default: {
      const _exhaustive: never = prize;
      void _exhaustive;
      return <></>;
    }
  }
}

function RedemptionBlock({
  redemption,
}: {
  redemption: AlbumRedemption;
}): JSX.Element {
  return (
    <article className="rounded border border-white/20 bg-white/5 p-3">
      <header className="mb-2 flex items-center justify-between text-xs text-white/70">
        <span>{formatRedeemedAt(redemption.redeemed_at)}</span>
        <span>{redemption.country}</span>
      </header>
      <div className="grid grid-cols-5 gap-2">
        {redemption.prizes.map((item, i) => {
          const isNone = item.prize.type === "none";
          return (
            <div
              key={`p-${String(i)}`}
              aria-label={prizeShortDescription(item.prize)}
              className={[
                "flex aspect-[2/3] flex-col items-center justify-center rounded border p-1 text-center",
                isNone
                  ? "border-white/15 bg-white/5 text-white/50"
                  : "border-white/30 bg-white/10 text-white",
              ].join(" ")}
            >
              <PrizeMeta prize={item.prize} />
            </div>
          );
        })}
      </div>
    </article>
  );
}

function EmptyState(): JSX.Element {
  return (
    <section className="flex flex-col items-center gap-4 rounded border border-white/20 bg-white/5 p-8 text-center">
      <p className="text-base text-white">Tu álbum está vacío</p>
      <p className="text-sm text-white/70">
        Cuando canjees un código, las cartas aparecerán acá.
      </p>
      <Link
        href="/"
        className="rounded bg-gp-gold px-4 py-2 text-sm font-semibold text-gp-gray-dark-2"
      >
        Abrir un sobre
      </Link>
    </section>
  );
}

// ---------- Page -------------------------------------------------------------

export default async function AlbumPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<JSX.Element> {
  const session = await auth();
  if (!session || !session.user || typeof session.user.id !== "string") {
    redirect("/auth/signin?callbackUrl=/album");
  }

  const album = await fetchAlbum();
  const justRedeemed = searchParams.just_redeemed === "1";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-5 pb-8 pt-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <Logo variant="blanco" width={140} />
        <h1 className="font-display text-2xl font-bold text-white">
          Mi álbum
        </h1>
      </header>

      {justRedeemed ? (
        <div
          role="status"
          className="rounded border border-gp-gold/60 bg-gp-gold/10 p-3 text-center text-sm text-gp-gold"
        >
          ¡Premios acreditados!
        </div>
      ) : null}

      {album === null || album.redemptions.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <section
            aria-label="Resumen"
            className="rounded border border-white/20 bg-white/5 p-3 text-center text-sm text-white/90"
          >
            <p>
              <span className="font-semibold text-white">
                {album.total_cards_count}
              </span>{" "}
              cartas obtenidas ·{" "}
              <span className="font-semibold text-white">
                {album.unique_collectibles_count}
              </span>{" "}
              coleccionables únicas
            </p>
          </section>

          <section
            aria-label="Historial de canjes"
            className="flex flex-col gap-3"
          >
            {album.redemptions.map((r, i) => (
              <RedemptionBlock
                key={`r-${String(i)}-${r.redeemed_at}`}
                redemption={r}
              />
            ))}
          </section>
        </>
      )}

      <Link
        href="/"
        className="rounded border border-white/40 px-4 py-3 text-center text-sm text-white/90"
      >
        Abrir otro sobre
      </Link>

      <footer className="mt-auto pt-6 text-center text-xs text-white/70">
        <p>{LEGAL_NOTICES.ageGate}</p>
        <p className="mt-1">{LEGAL_NOTICES.responsibleGaming}</p>
      </footer>
    </main>
  );
}
