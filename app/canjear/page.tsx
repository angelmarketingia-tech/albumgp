// Pantalla de confirmación + ejecución del canje (server component).
//
// AGENTS.md §3 (canjear = tras SSO acreditar premios) + §5 (un canje por
// código). SECURITY.md §6.5 (sesión vía Auth.js v5) + §2 (404 unificado).
//
// Sin client JS — el form usa server action. Funciona con JS deshabilitado
// igual que con JS habilitado.
//
// Flow:
//   1. Leer `?code=...` del query string. Normalizar; si no es válido,
//      mandar al inicio.
//   2. Chequear sesión con `auth()`. Si no hay → redirect a /auth/signin
//      con callbackUrl apuntando de vuelta a /canjear?code=...
//   3. Render: el form server-action confirma o cancela. La server action
//      invoca `redeemCodeDirect` directamente (sin loopback HTTP).
//   4. Si OK → redirect /album?just_redeemed=1.
//   5. Si la sesión expiró durante el flow (code='auth') → bounce a signin.
//      Otros fallos → /canjear?code=...&error=1 (UI muestra mensaje genérico).

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { auth } from "@/lib/auth/auth-config";
import { LegalFooter } from "@/components/legal/LegalFooter";
import { normalizeCode } from "@/lib/prizes/input-schemas";
import { extractClientIp } from "@/lib/redis/rate-limit";
import { redeemCodeDirect } from "@/lib/redeem/redeem-code";
import { formatCodeDisplay } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

interface SearchParams {
  code?: string | string[];
  error?: string;
}

function readCode(raw: SearchParams["code"]): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  // Malformed percent-escapes (e.g. ?code=%E0) throw URIError; treat them as
  // an invalid code rather than crashing the page with a 500.
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

// Server actions don't have a Request object; synthesize one with the
// forwarded headers so `extractClientIp` applies the same sanitization +
// UA-hash fallback used by every other entry point.
function ipFromHeaders(h: Headers): string {
  return extractClientIp(new Request("http://internal/redeem-action", { headers: h }));
}

/**
 * Server action: ejecuta el canje directamente vía `redeemCodeDirect` para
 * evitar el round-trip HTTP a /api/redeem (que requería reenviar cookies).
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

  const session = await auth();
  if (!session || !session.user || typeof session.user.id !== "string") {
    const callback = `/canjear?code=${encodeURIComponent(code)}`;
    return redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callback)}`);
  }

  const h = headers();
  const ip = ipFromHeaders(h);

  let result: Awaited<ReturnType<typeof redeemCodeDirect>>;
  try {
    result = await redeemCodeDirect({
      code,
      accountId: session.user.id,
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

  if (result.ok) {
    return redirect("/album?just_redeemed=1");
  }

  if (result.code === "auth" || result.status === 401) {
    const callback = `/canjear?code=${encodeURIComponent(code)}`;
    return redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callback)}`);
  }

  return redirect(`/canjear?code=${encodeURIComponent(code)}&error=1`);
}

export default async function CanjearPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<JSX.Element> {
  const code = readCode(searchParams.code);
  if (code === null) {
    return redirect("/");
  }

  // Auth check BEFORE any JSX render and outside any Suspense boundary —
  // anonymous users must get an immediate 307 to /auth/signin instead of
  // ever seeing the "Preparando..." fallback.
  const session = await auth();
  if (!session || !session.user || typeof session.user.id !== "string") {
    const callback = `/canjear?code=${encodeURIComponent(code)}`;
    return redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callback)}`);
  }

  const showError = searchParams.error === "1";

  return (
    <main id="main-content" className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-5 pb-8 pt-8">
      <header className="flex flex-col items-center gap-3 text-center">
        <Logo variant="blanco" width={140} />
        <h1 className="font-display text-2xl font-bold text-white">
          Confirmar canje
        </h1>
      </header>

      <section className="rounded border border-white/20 bg-white/5 p-4 text-center">
        <p className="text-sm text-white/80">Estás por canjear el código</p>
        <p className="mt-2 font-mono text-base tracking-wider text-white">
          {formatCodeDisplay(code)}
        </p>
      </section>

      <p className="text-sm text-white/80">
        Una vez canjeado, los premios se acreditarán a tu cuenta GanaPlay.
        El código no podrá usarse de nuevo.
      </p>

      {showError ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          <span aria-hidden>⚠</span>
          <div>
            <p className="font-bold">No pudimos acreditar tus premios</p>
            <p className="mt-1 text-red-100/90">Puede ser que el código ya se haya canjeado o que la conexión fallara. Probá de nuevo en unos segundos.</p>
          </div>
        </div>
      ) : null}

      <form action={redeemAction} className="flex flex-col gap-3">
        <input type="hidden" name="code" value={code} />
        <SubmitButton idleLabel="Confirmar y acreditar premios" busyLabel="Acreditando…" />
      </form>

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
