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
//      llama internamente a /api/redeem usando la cookie de sesión.
//   4. Si /api/redeem 200 → redirect /album?just_redeemed=1.
//   5. Si !200 → redirect /canjear?code=...&error=1 (UI muestra mensaje genérico).

import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { auth } from "@/lib/auth/auth-config";
import { LEGAL_NOTICES } from "@/lib/brand/constants";
import { normalizeCode } from "@/lib/prizes/input-schemas";
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
  return normalizeCode(raw);
}

function selfUrl(pathname: string): string {
  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}${pathname}`;
}

/**
 * Server action: dispara el POST a /api/redeem reusando la cookie de
 * sesión que ya tiene el RSC. Si OK → redirect al álbum; si no → vuelve
 * a /canjear con flag de error.
 */
async function redeemAction(formData: FormData): Promise<void> {
  "use server";
  const raw = formData.get("code");
  if (typeof raw !== "string") {
    redirect("/");
  }
  const code = normalizeCode(raw);
  if (code === null) {
    redirect("/");
  }

  const h = headers();
  const cookie = h.get("cookie") ?? "";

  let ok = false;
  try {
    const res = await fetch(selfUrl("/api/redeem"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie.length > 0 ? { cookie } : {}),
      },
      body: JSON.stringify({ code }),
      cache: "no-store",
    });
    ok = res.ok;
  } catch {
    ok = false;
  }

  if (ok) {
    redirect("/album?just_redeemed=1");
  }
  redirect(`/canjear?code=${encodeURIComponent(code)}&error=1`);
}

export default async function CanjearPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<JSX.Element> {
  const code = readCode(searchParams.code);
  if (code === null) {
    redirect("/");
  }

  const session = await auth();
  if (!session || !session.user || typeof session.user.id !== "string") {
    // Bounce to the signin page; come back to this same canjear URL.
    const callback = `/canjear?code=${encodeURIComponent(code)}`;
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callback)}`);
  }

  const showError = searchParams.error === "1";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-5 pb-8 pt-8">
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
        <p role="alert" className="text-sm text-red-200">
          No pudimos canjear este código. Probá nuevamente o volvé al inicio.
        </p>
      ) : null}

      <form action={redeemAction} className="flex flex-col gap-3">
        <input type="hidden" name="code" value={code} />
        <button
          type="submit"
          className="rounded bg-gp-gold px-4 py-3 font-semibold text-gp-gray-dark-2 transition-opacity hover:opacity-90"
        >
          Confirmar canje
        </button>
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

      <footer className="mt-auto pt-6 text-center text-xs text-white/70">
        <p>{LEGAL_NOTICES.ageGate}</p>
        <p className="mt-1">{LEGAL_NOTICES.responsibleGaming}</p>
      </footer>
    </main>
  );
}
