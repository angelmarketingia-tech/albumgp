/**
 * Sign-in page (Phase 3 — Wave 1).
 *
 * Server component that renders a form posting credentials to a SERVER ACTION
 * which calls Auth.js v5 `signIn()`. We deliberately do NOT POST directly to
 * `/api/auth/callback/credentials` from the client so we can:
 *   - Keep the form server-side (no React state, no client bundle).
 *   - Validate the honeypot field on the server BEFORE invoking Auth.js.
 *   - Return a generic error string for the next render — never "wrong email"
 *     or "wrong password" individually.
 */

import Image from "next/image";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect";
import { signIn } from "@/lib/auth/auth-config";

export const dynamic = "force-dynamic";

interface SearchParams {
  error?: string;
  callbackUrl?: string;
}

async function handleSignIn(formData: FormData): Promise<void> {
  "use server";
  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot.length > 0) {
    // Bot. Pretend "credenciales invalidas" without ever touching Auth.js.
    redirect("/auth/signin?error=invalid");
  }

  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string") {
    redirect("/auth/signin?error=invalid");
  }

  // Open-redirect guard: only accept same-origin paths ("/foo"), reject "//evil.com".
  const cb = formData.get("callbackUrl");
  const safe =
    typeof cb === "string" && cb.startsWith("/") && !cb.startsWith("//")
      ? cb
      : "/album";

  try {
    await signIn("mock", {
      email,
      password,
      redirectTo: safe,
    });
  } catch (err) {
    // `signIn` throws a redirect on success — must rethrow via the official
    // helper so Next can pick it up (digest-prefix check, not message match).
    if (isRedirectError(err)) {
      throw err;
    }
    redirect("/auth/signin?error=invalid");
  }
}

export default function SignInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): JSX.Element {
  const showError = searchParams.error !== undefined;
  const isDev = process.env.NODE_ENV !== "production";

  return (
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <aside className="hidden md:flex items-center justify-center p-10 bg-gp-green-deep">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="relative aspect-[4/5] w-full max-w-sm">
            <Image
              src="/assets/marketing/signin-hero.webp"
              alt=""
              fill
              sizes="(max-width: 768px) 80vw, 420px"
              className="object-contain"
            />
          </div>
          <p className="font-display text-2xl text-white/90 max-w-xs leading-snug">
            Tu álbum de pronósticos. Tu historial. Tu próxima jugada.
          </p>
        </div>
      </aside>

      <section className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md rounded-3xl border border-white/15 bg-white/8 p-8 shadow-glass backdrop-blur-xl">
          {isDev ? (
            <>
              <span
                role="status"
                className="inline-block text-[10px] uppercase tracking-widest text-yellow-300 border border-yellow-300/40 rounded px-2 py-0.5 mb-2"
              >
                Modo de pruebas
              </span>
              <p className="text-xs text-white/60 mb-4">
                Cualquier email + contraseña de 6+ caracteres funciona en este entorno. La integración real con GanaPlay queda pendiente.
              </p>
            </>
          ) : null}

          <h1 className="mb-6 font-display text-3xl font-black text-white">
            Iniciar sesión
          </h1>

          <form action={handleSignIn} className="space-y-4" noValidate>
            {/* Preserve intended destination across the server-action round-trip. */}
            <input
              type="hidden"
              name="callbackUrl"
              value={searchParams.callbackUrl ?? "/album"}
            />
            {/* Honeypot: real users never see/touch this. Bots fill every field. */}
            <div aria-hidden className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm text-white/80">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="ejemplo@correo.com"
                autoComplete="username"
                className="h-12 rounded-xl bg-black/30 border border-white/20 px-4 text-white placeholder:text-white/40 focus:border-gp-gold focus:ring-2 focus:ring-gp-gold/30 outline-none transition"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm text-white/80">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="h-12 rounded-xl bg-black/30 border border-white/20 px-4 text-white placeholder:text-white/40 focus:border-gp-gold focus:ring-2 focus:ring-gp-gold/30 outline-none transition"
              />
            </div>

            {showError ? (
              <p role="alert" className="text-sm text-red-300">
                Credenciales inválidas
              </p>
            ) : null}

            <button
              type="submit"
              className="h-14 w-full rounded-xl bg-[linear-gradient(135deg,#B8860B,#D4A017,#F4D03F)] font-sans font-black uppercase tracking-wide text-gp-green-deep shadow-gold-glow active:scale-[0.97] transition"
            >
              Entrar
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
