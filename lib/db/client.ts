// Prisma singleton. Avoids exhausting the connection pool in `next dev`'s
// hot-reload, which would otherwise create a new PrismaClient on every
// module reload.
//
// DEV-ONLY: when `DEV_MOCK_DB=1` is set in `.env.local`, returns an
// in-memory mock that satisfies the same surface used by the app. Hard-
// fails if invoked under `NODE_ENV=production` to prevent accidents.
//
// SCALE (300k-user burst): on serverless each warm function reuses ONE
// PrismaClient, but every concurrent invocation is its own process — so the
// real connection ceiling is "Postgres max_connections", not the per-client
// pool. The only way this survives is the Neon POOLER (PgBouncer): the app
// MUST connect through the `-pooler` host with `pgbouncer=true` and a tiny
// `connection_limit`. `assertPooledUrlInProd()` below fails the boot loudly if
// prod is pointed at a direct (non-pooled) URL — silently exhausting
// connections is exactly what makes "se queda cargando" under load.

import { PrismaClient } from "@prisma/client";
import { createDevMockPrisma } from "./dev-mock";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * In production, refuse to boot against a non-pooled Postgres URL.
 *
 * Neon's pooled endpoint contains `-pooler` in the host and we additionally
 * require `pgbouncer=true` (tells Prisma to disable prepared statements, which
 * PgBouncer in transaction mode can't share) plus a small `connection_limit`
 * so a single function doesn't grab a fat pool. This catches the #1 scale
 * misconfiguration before a single user hits a hung request.
 *
 * Returns a possibly-augmented URL: if `connection_limit` is missing we append
 * a safe default (1) rather than failing, since the pooler host is the part
 * that actually matters.
 */
export function assertPooledUrlInProd(
  rawUrl: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (env.NODE_ENV !== "production") return rawUrl;
  if (!rawUrl) {
    throw new Error(
      "[db] DATABASE_URL no está definido en producción. Debe apuntar al pooler de Neon (host con `-pooler`, `?pgbouncer=true`).",
    );
  }

  // Allow operators to explicitly opt out (e.g. a non-Neon managed pooler that
  // doesn't use the `-pooler` token) by setting DB_POOLER_OK=1. We still log.
  const explicitlyOk = env.DB_POOLER_OK === "1";

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("[db] DATABASE_URL no es una URL válida.");
  }

  const looksPooled =
    url.hostname.includes("-pooler") ||
    url.searchParams.get("pgbouncer") === "true";

  if (!looksPooled && !explicitlyOk) {
    throw new Error(
      "[db] DATABASE_URL en producción NO usa el pooler. Bajo carga (cientos de miles de usuarios) " +
        "una conexión directa agota Postgres y las requests se cuelgan. Usá el host `-pooler` de Neon " +
        "con `?pgbouncer=true&connection_limit=1`. Si tu pooler no usa ese nombre, seteá DB_POOLER_OK=1.",
    );
  }

  // Ensure a small connection_limit so each serverless function holds few
  // pooled connections. Default to 1 (PgBouncer multiplexes; the function only
  // needs one at a time on the redeem hot path).
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", "1");
  }
  // Bound how long a query waits for a pooled connection before giving up, so
  // a connection storm fails fast instead of hanging the invocation.
  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", "10");
  }
  return url.toString();
}

function buildPrisma(): PrismaClient {
  if (
    process.env.DEV_MOCK_DB === "1" &&
    process.env.NODE_ENV !== "production"
  ) {
    return createDevMockPrisma();
  }
  const datasourceUrl = assertPooledUrlInProd(process.env.DATABASE_URL);
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
  });
}

// Lazily instantiate on first property access — NOT at import time. Why:
// `next build` imports every server module to collect page data with the
// build-time env (placeholder DATABASE_URL). If we built Prisma eagerly here,
// `assertPooledUrlInProd` would throw during the build, not at runtime where it
// belongs. The Proxy defers construction to the first real `prisma.<model>`
// access — i.e. the first query in a live request — so the pooler check guards
// runtime without breaking the build.
function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const client = buildPrisma();
    // Cache across dev HMR reloads (and harmlessly in prod, where the module
    // graph is stable per warm function).
    globalForPrisma.prisma = client;
  }
  return globalForPrisma.prisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
