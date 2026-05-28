// Pantalla de confirmación + ejecución del canje (server component).
//
// AGENTS.md §3 (canjear = tras SSO acreditar premios) + §5 (un canje por
// código). SECURITY.md §6.5 (sesión vía Auth.js v5) + §2 (404 unificado).
//
// Flow:
//   1. Leer `?code=...` del query string. Normalizar; si no es válido,
//      mandar al inicio (no mostramos UX de error aquí porque el código
//      siempre llega desde /sobre/[code] que ya validó).
//   2. Chequear sesión con `auth()`. Si no hay → redirect a /auth/signin
//      con callbackUrl apuntando de vuelta a /canjear?code=...
//   3. Render: pantalla minimal con el código formateado y el form cliente
//      para confirmar/cancelar el canje.

import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { auth } from "@/lib/auth/auth-config";
import { LEGAL_NOTICES } from "@/lib/brand/constants";
import { normalizeCode } from "@/lib/prizes/input-schemas";
import { formatCodeDisplay } from "@/lib/ui/format";
import { RedeemForm } from "./RedeemForm";

export const dynamic = "force-dynamic";

interface SearchParams {
  code?: string | string[];
}

function readCode(raw: SearchParams["code"]): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  return normalizeCode(raw);
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

      <RedeemForm code={code} />

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
