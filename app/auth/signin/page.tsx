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
 *
 * STYLE: deliberately minimal Tailwind. Visual polish lands in Phase 4.
 */

import { redirect } from "next/navigation";
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

  try {
    await signIn("mock", {
      email,
      password,
      redirectTo: "/album",
    });
  } catch (err) {
    // `signIn` throws a `NEXT_REDIRECT` on success — must rethrow.
    if (err instanceof Error && err.message === "NEXT_REDIRECT") {
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
    <main className="mx-auto max-w-md p-6">
      {isDev ? (
        <div
          role="status"
          className="mb-4 rounded border border-yellow-400 bg-yellow-50 p-3 text-sm text-yellow-900"
        >
          Modo de pruebas (dev). NO usar en producción.
        </div>
      ) : null}

      <h1 className="mb-4 text-2xl font-semibold text-white">
        Iniciar sesión
      </h1>

      <form action={handleSignIn} className="space-y-3" noValidate>
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

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm text-white">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            className="rounded border border-white/30 bg-white/10 px-3 py-2 text-white"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm text-white">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded border border-white/30 bg-white/10 px-3 py-2 text-white"
          />
        </div>

        {showError ? (
          <p role="alert" className="text-sm text-red-300">
            Credenciales inválidas
          </p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded bg-gp-gold px-4 py-2 font-semibold text-black"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
