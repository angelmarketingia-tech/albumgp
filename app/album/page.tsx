// Mi Álbum — server component.
//
// AGENTS.md §3 (Mi Álbum requiere sesión), §11 (redemptions auditadas),
// §12 (avisos legales).
// SECURITY.md §5 (sesión obligatoria → 401 en API; en UI bouncing a signin).
//
// Estrategia:
//   - `auth()` para chequear sesión. Sin sesión → redirect a /auth/signin.
//   - Lectura directa de la query de álbum (sin hop HTTP a /api/album): el RSC
//     ya corre en el mismo proceso, así evitamos un fetch + cookie-forwarding
//     innecesarios y cualquier flake de red en dev.
//   - Si la query falla por cualquier motivo → empty state. NO rompemos la
//     página; una falla de DB transitoria no debería darle un stack al usuario.
//   - Vista de colección agrupada por rareza + contadores visuales
//     (`<AlbumSummary>`) + repisas (`<RarityShelf>`) + historial de premios
//     reales reclamados (sin coleccionables ni "none").

import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { JSX } from "react";

import { Card } from "@/components/cards/Card";
import { AlbumSummary } from "@/components/album/AlbumSummary";
import { RarityShelf } from "@/components/album/RarityShelf";
import { auth } from "@/lib/auth/auth-config";
import { prisma } from "@/lib/db/client";
import { LEGAL_NOTICES } from "@/lib/brand/constants";
import { getAlbumForAccount } from "@/lib/album";
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

// Total de coleccionables en circulación. Mientras no haya un endpoint que lo
// devuelva, lo derivamos de los assets en /public/assets/cartas (6 cartas).
const TOTAL_COLLECTIBLES = 6;

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
    <section className="flex flex-col items-center gap-4 rounded-2xl border border-white/15 bg-white/5 p-8 text-center shadow-glass">
      <Image
        src="/assets/marketing/empty-album.webp"
        alt=""
        width={560}
        height={420}
        className="h-auto w-full max-w-xs"
      />
      <p className="font-display text-xl font-bold text-white">Tu álbum te está esperando</p>
      <p className="text-sm text-white/85">Cada sobre que abrás te suma cartas acá. Empezá con tu primer código.</p>
      <Link href="/" className="inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#B8860B,#D4A017,#F4D03F)] px-6 py-3 font-sans text-sm font-black uppercase tracking-wide text-gp-green-deep shadow-gold-glow active:scale-[0.97] transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-gp-white focus-visible:ring-offset-2 focus-visible:ring-offset-gp-green-deep">Abrir mi primer sobre</Link>
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

  let album: AlbumResponse | null = null;
  try {
    album = await getAlbumForAccount(prisma, session.user.id);
  } catch {
    album = null;
  }

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

  // Session callback scrubs name to ''. '' is truthy for ?? so use ||.
  const firstName =
    session.user.name?.trim().split(" ")[0] || "Coleccionista";
  const uniqueCount = view?.unique_collectibles ?? 0;
  // Cap a 100% para evitar overflow visual si un día hay más coleccionables
  // que el total esperado (ej. expansión sin actualizar `TOTAL_COLLECTIBLES`).
  const progressPct = Math.min(
    100,
    Math.round((uniqueCount / TOTAL_COLLECTIBLES) * 100),
  );

  return (
    <main id="main-content" className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-5 pb-8 pt-8">
      <section
        aria-label="Resumen del coleccionista"
        className="relative -mx-5 -mt-8 mb-6 h-56 overflow-hidden rounded-b-3xl"
      >
        {/* Panoramic hero illustration; alt empty because all label/heading
            content is rendered as real text overlay below for SR + SEO. */}
        <Image
          src="/assets/marketing/album-hero.webp"
          alt=""
          fill
          priority
          sizes="(max-width: 768px) 100vw, 768px"
          className="object-cover"
        />
        {/* Bottom-up scrim keeps the overlay text legible on any photo. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-gp-green-deep via-gp-green-deep/40 to-transparent"
        />
        <div className="relative z-10 flex h-full flex-col justify-end gap-3 px-6 pb-6 pt-8">
          <p className="font-sans text-[10px] uppercase tracking-[0.4em] text-gp-gold/80">
            MI COLECCIÓN
          </p>
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
            Hola, {firstName}
          </h1>
          <div
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progreso: ${String(uniqueCount)} de ${String(TOTAL_COLLECTIBLES)} coleccionables`}
            className="h-2 w-full rounded-full bg-white/10"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-gp-gold transition-all"
              style={{ width: `${String(progressPct)}%` }}
            />
          </div>
        </div>
      </section>

      {justRedeemed ? (
        <div
          role="status"
          className="rounded border border-gp-gold bg-gp-green-deep/80 p-3 text-center text-sm font-bold text-gp-gold"
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

      <footer className="mt-auto pt-6 text-center text-xs text-white/85">
        <p>{LEGAL_NOTICES.ageGate}</p>
        <p className="mt-1">{LEGAL_NOTICES.responsibleGaming}</p>
      </footer>

      <Link
        href="/"
        aria-label="Abrir otro sobre"
        className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-[linear-gradient(135deg,#B8860B,#D4A017,#F4D03F)] px-6 py-3 font-sans font-black uppercase tracking-wide text-gp-green-deep shadow-gold-glow active:scale-[0.97] transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-gp-white focus-visible:ring-offset-2 focus-visible:ring-offset-gp-green-deep"
      >
        Abrir otro sobre
      </Link>
    </main>
  );
}
