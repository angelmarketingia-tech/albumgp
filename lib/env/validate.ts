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
});

const envSchema = baseSchema.superRefine((data, ctx) => {
  // Pair constraint: secret is only meaningful when the URL is configured.
  if (data.WEBHOOK_CENTRAL_URL && (!data.WEBHOOK_CENTRAL_SECRET || data.WEBHOOK_CENTRAL_SECRET.length < 32)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['WEBHOOK_CENTRAL_SECRET'],
      message: 'WEBHOOK_CENTRAL_SECRET must be at least 32 chars when WEBHOOK_CENTRAL_URL is set',
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
