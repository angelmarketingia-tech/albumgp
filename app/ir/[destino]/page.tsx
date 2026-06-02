// Página puente → redirección externa confiable a GanaPlay.
//
// POR QUÉ UNA PÁGINA (no un redirect ni un route handler):
// `redirect("https://externo…")` dentro de un Server Action NO navega en el
// cliente (Next usa un fetch RSC same-origin que no sigue redirects externos).
// Un route handler con 307 tampoco, por la misma razón. La forma 100% confiable
// en todo navegador Y en el WebView de Capacitor es una NAVEGACIÓN FULL-DOCUMENT:
// el Server Action redirige a esta página interna, que inyecta el meta-refresh
// y un mini-script `location.replace` (doble garantía) + enlace de respaldo.
//
// Allowlist de destinos → evita open-redirects (nunca una URL del cliente).

import { redirect } from "next/navigation";
import { SIGNIN_URLS } from "@/lib/brand/constants";
import { Logo } from "@/components/brand/Logo";
import { ExternalRedirect } from "@/components/ui/ExternalRedirect";

export const dynamic = "force-dynamic";

const DESTINOS: Readonly<Record<string, { url: string; pais: string }>> =
  Object.freeze({
    "signin-sv": { url: SIGNIN_URLS.SV, pais: "El Salvador" },
    "signin-gt": { url: SIGNIN_URLS.GT, pais: "Guatemala" },
  });

export default function IrPage({
  params,
}: {
  params: { destino: string };
}): JSX.Element {
  const dest = DESTINOS[params.destino];
  // Destino desconocido → al inicio, jamás a una URL arbitraria.
  if (dest === undefined) {
    return redirect("/");
  }

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-5 text-center"
    >
      {/* meta-refresh: navegación full-document a GanaPlay sin requerir JS ni
          violar la CSP (no hay inline script). Next eleva este <meta> al <head>.
          El enlace de abajo es el respaldo manual. */}
      <meta httpEquiv="refresh" content={`0; url=${dest.url}`} />
      <Logo variant="blanco" width={150} />
      <div>
        <p className="font-display text-xl font-bold">¡Premios canjeados!</p>
        <p className="mt-2 text-sm text-white/80">
          Te estamos llevando a iniciar sesión en GanaPlay {dest.pais}…
        </p>
      </div>
      {/* Redundancia JS (CSP-safe, módulo externo): dispara location.replace y,
          si tras ~2.5s seguimos aquí, muestra un botón pulsante. Nunca se ve
          "trabado". */}
      <ExternalRedirect url={dest.url} />
      {/* Respaldo siempre visible aunque JS esté deshabilitado. */}
      <a
        href={dest.url}
        className="inline-flex h-12 min-h-12 items-center justify-center rounded-md bg-gp-white px-6 font-sans text-base font-bold uppercase tracking-wide text-gp-green shadow-md"
      >
        Ir a GanaPlay
      </a>
    </main>
  );
}
