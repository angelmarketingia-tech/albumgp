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
//   - Vista de colección agrupada por rareza + contadores visuales
//     (`<AlbumSummary>`) + repisas (`<RarityShelf>`) + historial de premios
//     reales reclamados (sin coleccionables ni "none").
//   - Las cartas usan `<Card size="sm">` (128x192) — placeholder div fue
//     reemplazado por el componente rico.

import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { JSX } from "react";

import { Logo } from "@/components/brand/Logo";
import { Card } from "@/components/cards/Card";
import { AlbumSummary } from "@/components/album/AlbumSummary";
import { RarityShelf } from "@/components/album/RarityShelf";
import { auth } from "@/lib/auth/auth-config";
import { LEGAL_NOTICES } from "@/lib/brand/constants";
import { groupAlbumByRarity, categorizePrize } from "@/lib/album/group";
import type {
  AlbumRedemption,
  AlbumResponse,
} from "@/lib/album/types";
import { formatRedeemedAt } from "@/lib/ui/format";

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
 * than a stack trace.
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

/**
 * Bloque de un canje histórico — solo muestra los premios reales (no
 * coleccionables ni "none"). Si la redención no tuvo premios reales, el
 * caller debe omitir este bloque.
 */
function RealPrizesRedemptionBlock({
  redemption,
}: {
  redemption: AlbumRedemption;
}): JSX.Element | null {
  const realPrizes = redemption.prizes.filter(
    (item) => categorizePrize(item.prize) === "real_prizes",
  );
  if (realPrizes.length === 0) {
    return null;
  }

  return (
    <article
      data-redemption
      className="rounded border border-white/20 bg-white/5 p-3"
    >
      <header className="mb-3 flex items-center justify-between text-xs text-white/70">
        <span>{formatRedeemedAt(redemption.redeemed_at)}</span>
        <span>{redemption.country}</span>
      </header>
      <div className="flex flex-wrap justify-center gap-3">
        {realPrizes.map((item, i) => (
          <Card
            key={`p-${String(i)}`}
            prize={item.prize}
            size="sm"
            revealed
          />
        ))}
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

  const view =
    album !== null && album.redemptions.length > 0
      ? groupAlbumByRarity(album)
      : null;

  // Pre-filter redemptions: only those with at least one real prize get a
  // history block. Coleccionables y "none" se muestran arriba (resumen /
  // repisas), no se duplican en el historial.
  const redemptionsWithRealPrizes =
    album !== null
      ? album.redemptions.filter((r) =>
          r.prizes.some(
            (item) => categorizePrize(item.prize) === "real_prizes",
          ),
        )
      : [];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-5 pb-8 pt-8">
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

      {album === null || album.redemptions.length === 0 || view === null ? (
        <EmptyState />
      ) : (
        <>
          <AlbumSummary
            total_cards={view.total_cards}
            unique_collectibles={view.unique_collectibles}
            real_prizes={view.real_prizes_count}
            empty={view.empty_count}
          />

          <section
            aria-label="Colección por rareza"
            className="flex flex-col gap-6"
          >
            <RarityShelf
              rarity="legendary"
              slots={view.collectibles_by_rarity.legendary}
            />
            <RarityShelf
              rarity="epic"
              slots={view.collectibles_by_rarity.epic}
            />
            <RarityShelf
              rarity="rare"
              slots={view.collectibles_by_rarity.rare}
            />
            <RarityShelf
              rarity="common"
              slots={view.collectibles_by_rarity.common}
            />
          </section>

          {redemptionsWithRealPrizes.length > 0 ? (
            <section
              aria-label="Premios reclamados"
              className="flex flex-col gap-3"
            >
              <h2 className="font-display text-lg font-bold text-white">
                Premios reclamados
              </h2>
              {redemptionsWithRealPrizes.map((r, i) => (
                <RealPrizesRedemptionBlock
                  key={`r-${String(i)}-${r.redeemed_at}`}
                  redemption={r}
                />
              ))}
            </section>
          ) : null}
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
