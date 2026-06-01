import { z } from 'zod';

// Fail fast at boot rather than at first request when env is misconfigured.
const isProd = process.env.NODE_ENV === 'production';

const baseSchema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: isProd ? z.string().min(32) : z.string().min(32).optional(),
  UPSTASH_REDIS_REST_URL: isProd ? z.string().url() : z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: isProd ? z.string().min(1) : z.string().min(1).optional(),
  WEBHOOK_CENTRAL_URL: z.string().url().optional(),
  WEBHOOK_CENTRAL_SECRET: z.string().min(32).optional(),
  // Dev-only mock auth password. Required when the mock provider is live
  // (NODE_ENV !== 'production'); see superRefine below.
  MOCK_AUTH_PASSWORD: z.string().optional(),
});

// Heuristic markers of a pooled/serverless-safe Postgres endpoint. AGENTS.md §8
// mandates connection pooling for high traffic — a direct (port 5432, no pooler)
// URL exhausts Postgres connections under a 400k traffic spike. We can't probe
// the endpoint at boot, so we match the well-known pooler hostnames/params used
// by Prisma Accelerate, Supabase, Neon, PgBouncer, RDS Proxy, Upstash, etc.
const POOLED_DB_MARKERS = [
  "accelerate", // Prisma Accelerate
  "pgbouncer", // ?pgbouncer=true / pgbouncer host
  "pooler", // Supabase pooler / generic
  "-pooler.", // Neon pooler host
  "pool", // generic "pool" in host/param
  "proxy", // RDS Proxy
  ":6543", // Supabase/Supavisor transaction-pooler port
];

function looksPooled(databaseUrl: string): boolean {
  const lower = databaseUrl.toLowerCase();
  return POOLED_DB_MARKERS.some((m) => lower.includes(m));
}

const envSchema = baseSchema.superRefine((data, ctx) => {
  // Pair constraint: secret is only meaningful when the URL is configured.
  if (data.WEBHOOK_CENTRAL_URL && (!data.WEBHOOK_CENTRAL_SECRET || data.WEBHOOK_CENTRAL_SECRET.length < 32)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['WEBHOOK_CENTRAL_SECRET'],
      message: 'WEBHOOK_CENTRAL_SECRET must be at least 32 chars when WEBHOOK_CENTRAL_URL is set',
    });
  }

  // In production, refuse to boot against a non-pooled DATABASE_URL. This turns
  // a silent first-traffic-spike outage into a loud, fixable deploy error.
  // Escape hatch: set ALLOW_DIRECT_DB_URL=1 for single-instance container
  // deploys that front Postgres with their own pool.
  if (
    isProd &&
    process.env.ALLOW_DIRECT_DB_URL !== '1' &&
    !looksPooled(data.DATABASE_URL)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['DATABASE_URL'],
      message:
        'Production DATABASE_URL does not look pooled (expected Accelerate/PgBouncer/Supabase pooler/Neon pooler/RDS Proxy). ' +
        'A direct connection will exhaust Postgres connections under load (AGENTS.md §8). ' +
        'Use the pooled connection string, or set ALLOW_DIRECT_DB_URL=1 if you front Postgres with your own pool.',
    });
  }

  // When the dev mock auth provider is active (any non-production env), it MUST
  // have a password or every sign-in silently fails with "credenciales inválidas"
  // and the cause is invisible. Fail fast at boot instead.
  if (!isProd && (data.MOCK_AUTH_PASSWORD === undefined || data.MOCK_AUTH_PASSWORD.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['MOCK_AUTH_PASSWORD'],
      message:
        'MOCK_AUTH_PASSWORD is required when NODE_ENV !== "production" (the dev mock auth provider is live). ' +
        'Set it in .env.local, e.g. MOCK_AUTH_PASSWORD=devpassword.',
    });
  }
});

export type Env = z.infer<typeof baseSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
