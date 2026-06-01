// Pantalla de confirmación + consumo del código (server component).
//
// MODO SIN-SSO (2026-06): el dev de la plataforma GanaPlay está fuera de
// servicio, así que NO se puede pedir login OIDC dentro de esta app. Modelo de
// negocio acordado: los premios YA están acreditados en la cuenta GanaPlay del
// usuario desde que se generó el código y se envió por correo. Esta app es la
// experiencia visual + el "consumo" del código (un solo uso) y luego REDIRIGE
// al login oficial de GanaPlay, donde el usuario ya tiene sus premios.
//
// Flujo:
//   1. Leer `?code=...`. Normalizar; inválido → inicio.
//   2. Mostrar confirmación. NO se pide sesión.
//   3. Al confirmar (server action): marcar el código `redeemed` de forma
//      ATÓMICA (un solo uso, anti-reuso) vía `redeemCodeDirect`, sin cuenta.
//      Se registra con accountId = EXTERNAL_REDEEMER porque no hay login.
//   4. Éxito → redirect 307 a la URL de login oficial de GanaPlay del país del
//      código (SIGNIN_URLS[country]). Ya-usado → misma redirección (los premios
//      ya están del lado de GanaPlay; no perdemos nada).
//
// Sin client JS — el form usa server action; funciona con JS deshabilitado.
//
// AGENTS.md §3 (un canje por código) + §5 (atómico). El paso SSO se reemplaza
// por una redirección externa hasta que el OIDC de GanaPlay vuelva.

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { SIGNIN_URLS } from "@/lib/brand/constants";
import { normalizeCode } from "@/lib/prizes/input-schemas";
import {
  extractClientIp,
  keyForCode,
  rateLimitBatch,
} from "@/lib/redis/rate-limit";
import { redeemCodeDirect } from "@/lib/redeem/redeem-code";
import { formatCodeDisplay } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

// Sin login, el canje no tiene una cuenta real. Usamos un identificador opaco
// y estable para la auditoría (redemptions.account_id) que distingue estos
// canjes "externos vía GanaPlay" de los de un futuro OIDC (prefijo `external:`).
const EXTERNAL_REDEEMER = "external:ganaplay";

interface SearchParams {
  code?: string | string[];
  error?: string;
}

function readCode(raw: SearchParams["code"]): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return normalizeCode(decoded);
}

function hashCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

function ipFromHeaders(h: Headers): string {
  return extractClientIp(new Request("http://internal/redeem-action", { headers: h }));
}

/**
 * Server action: consume el código (un solo uso) y redirige al login oficial
 * de GanaPlay del país correspondiente. NO requiere sesión.
 */
async function redeemAction(formData: FormData): Promise<void> {
  "use server";
  const raw = formData.get("code");
  if (typeof raw !== "string") {
    return redirect("/");
  }
  const code = normalizeCode(raw);
  if (code === null) {
    return redirect("/");
  }

  const h = headers();
  const ip = ipFromHeaders(h);

  // Rate-limit BEFORE touching the DB. Without SSO there's no account bucket,
  // so we throttle by IP (5/min) + by code (3/min) to blunt brute-force of the
  // pre-generated code pool. Server actions already carry Next's same-origin
  // CSRF protection, so IP + code is the missing layer vs the /api/redeem path.
  const { allowed } = await rateLimitBatch([
    { key: `rl:ip:canjear:${ip}`, max: 5, windowSeconds: 60 },
    { key: keyForCode(code, "canjear"), max: 3, windowSeconds: 60 },
  ]);
  if (!allowed) {
    return redirect(`/canjear?code=${encodeURIComponent(code)}&error=rate`);
  }

  let result: Awaited<ReturnType<typeof redeemCodeDirect>>;
  try {
    result = await redeemCodeDirect({
      code,
      accountId: EXTERNAL_REDEEMER,
      ip,
    });
  } catch (err) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "redeem_action.failed",
        code_hash: hashCode(code),
        message: err instanceof Error ? err.message : "unknown",
      }),
    );
    return redirect(`/canjear?code=${encodeURIComponent(code)}&error=1`);
  }

  // Éxito → el código quedó consumido. Redirigimos a la ruta INTERNA `/ir/...`
  // (no directo a la URL externa: `redirect()` a un dominio externo desde un
  // server action no produce navegación del lado del cliente). `/ir/<destino>`
  // responde un 307 HTTP que el navegador y el WebView sí siguen.
  if (result.ok) {
    const dest = result.redemption.country === "SV" ? "signin-sv" : "signin-gt";
    return redirect(`/ir/${dest}`);
  }

  // Código ya usado: los premios igual están del lado de GanaPlay. No sabemos
  // el país (el canje previo no nos lo devuelve acá), así que mostramos el
  // aviso y dejamos que el usuario elija su país para ir a GanaPlay.
  if (result.code === "already") {
    return redirect(`/canjear?code=${encodeURIComponent(code)}&error=used`);
  }

  return redirect(`/canjear?code=${encodeURIComponent(code)}&error=1`);
}

export default function CanjearPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): JSX.Element {
  const code = readCode(searchParams.code);
  if (code === null) {
    return redirect("/");
  }

  const showGenericError = searchParams.error === "1";
  const showAlreadyUsed = searchParams.error === "used";
  const showRateLimited = searchParams.error === "rate";

  return (
    <main id="main-content" className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-5 pb-8 pt-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <Logo variant="blanco" width={140} />
        <h1 className="font-display text-2xl font-bold text-white">
          Canjear premios
        </h1>
      </header>

      <section className="rounded border border-white/20 bg-white/5 p-4 text-center">
        <p className="text-sm text-white/80">Estás por canjear el código</p>
        <p className="mt-2 font-mono text-base tracking-wider text-white">
          {formatCodeDisplay(code)}
        </p>
      </section>

      <p className="text-sm text-white/80">
        Tus premios ya están en tu cuenta de GanaPlay. Al confirmar, te llevamos
        a iniciar sesión para que los uses. El código no podrá usarse de nuevo.
      </p>

      {showGenericError ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          <span aria-hidden>⚠</span>
          <div>
            <p className="font-bold">No pudimos completar el canje</p>
            <p className="mt-1 text-red-100/90">Probá de nuevo en unos segundos.</p>
          </div>
        </div>
      ) : null}

      {showRateLimited ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          <span aria-hidden>⚠</span>
          <div>
            <p className="font-bold">Demasiados intentos</p>
            <p className="mt-1 text-red-100/90">Esperá un minuto antes de volver a intentarlo.</p>
          </div>
        </div>
      ) : null}

      {showAlreadyUsed ? (
        <div role="alert" className="flex flex-col gap-3 rounded-lg border border-gp-gold/40 bg-gp-green-deep/60 p-4 text-sm text-white">
          <div className="flex items-start gap-2">
            <span aria-hidden>ℹ</span>
            <div>
              <p className="font-bold text-gp-gold">Este código ya fue canjeado</p>
              <p className="mt-1 text-white/85">Tus premios ya están en tu cuenta de GanaPlay. Iniciá sesión para usarlos.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href={SIGNIN_URLS.SV}
              className="flex-1 rounded-md bg-gp-white px-3 py-2 text-center text-sm font-bold text-gp-green"
            >
              Entrar 🇸🇻 SV
            </a>
            <a
              href={SIGNIN_URLS.GT}
              className="flex-1 rounded-md bg-gp-white px-3 py-2 text-center text-sm font-bold text-gp-green"
            >
              Entrar 🇬🇹 GT
            </a>
          </div>
        </div>
      ) : null}

      {!showAlreadyUsed ? (
        <form action={redeemAction} className="flex flex-col gap-3">
          <input type="hidden" name="code" value={code} />
          <SubmitButton idleLabel="Confirmar e ir a GanaPlay" busyLabel="Canjeando…" />
        </form>
      ) : null}

      <Link
        href={`/sobre/${encodeURIComponent(code)}`}
        className="block rounded border border-white/40 px-4 py-3 text-center text-sm text-white/90 transition-opacity hover:opacity-90"
      >
        Volver al sobre
      </Link>

      <p className="text-xs text-white/70">
        ¿Te equivocaste de código?{" "}
        <Link href="/" className="underline">
          Volver al inicio
        </Link>
      </p>

      <LegalFooter className="mt-auto pt-6" />
    </main>
  );
}
