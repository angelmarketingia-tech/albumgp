/**
 * Cliente Redis (Upstash REST).
 *
 * Patrón:
 *   - En producción/staging: usa `@upstash/redis` apuntando al endpoint REST.
 *     Esto funciona en Edge runtime (Vercel).
 *   - En desarrollo / tests sin variables de entorno: usa un fallback in-memory
 *     CLARAMENTE marcado como dev-only, con la misma interfaz mínima
 *     (`get`, `set`, `incr`, `expire`). Esto evita pedirle a cada dev que
 *     levante Redis local y permite que los tests corran offline.
 *
 * Singleton: en dev, Next.js recarga módulos en HMR y dispararía múltiples
 * clientes. Usamos un global cache análogo al patrón clásico de Prisma.
 *
 * AGENTS.md sec. 8: NUNCA secretos en el cliente. Este archivo es
 * server-only — no debe importarse desde componentes con `"use client"`.
 */

import { Redis } from "@upstash/redis";

/**
 * Interfaz mínima que tanto el cliente real como el fallback deben cumplir.
 * Sólo exponemos las operaciones que de hecho usamos (rate limit, locks).
 * Si necesitas más adelante, amplíala explícitamente — no exponer todo
 * `@upstash/redis` para mantener la superficie auditable.
 */
export interface RedisPipelineLike {
  incr(key: string): this;
  expire(key: string, seconds: number): this;
  exec(): Promise<unknown[]>;
}

export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    opts?: { ex?: number },
  ): Promise<"OK" | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  /** Optional: real Upstash client exposes this; the in-memory fallback does not. */
  pipeline?(): RedisPipelineLike;
}

/* -------------------------------------------------------------------------- */
/* Fallback in-memory — DEV ONLY                                              */
/* -------------------------------------------------------------------------- */

interface MemEntry {
  value: string;
  /** ms epoch when this entry expires; undefined = no expiration. */
  expiresAt?: number;
}

/**
 * Cliente in-memory que imita la interfaz `RedisLike`.
 *
 * ⚠️  DEV-ONLY. Se construye SÓLO si las env vars de Upstash no están
 * presentes. NUNCA debe alcanzar producción: en prod las env vars son
 * obligatorias y el constructor real toma su lugar.
 *
 * No es thread-safe entre instancias de proceso (cada worker tendría su propio
 * Map). Para tests serializados con Vitest está perfecto.
 */
export class InMemoryRedis implements RedisLike {
  /** Marcador explícito para que sea visible en logs/inspección. */
  public readonly __devOnly = true as const;

  private readonly store = new Map<string, MemEntry>();

  private sweep(key: string): MemEntry | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.sweep(key);
    return entry ? entry.value : null;
  }

  async set(
    key: string,
    value: string,
    opts?: { ex?: number },
  ): Promise<"OK" | null> {
    const entry: MemEntry = { value };
    if (opts?.ex !== undefined) {
      entry.expiresAt = Date.now() + opts.ex * 1000;
    }
    this.store.set(key, entry);
    return "OK";
  }

  async incr(key: string): Promise<number> {
    const entry = this.sweep(key);
    const current = entry ? Number.parseInt(entry.value, 10) : 0;
    const next = (Number.isFinite(current) ? current : 0) + 1;
    const newEntry: MemEntry = { value: String(next) };
    if (entry?.expiresAt !== undefined) newEntry.expiresAt = entry.expiresAt;
    this.store.set(key, newEntry);
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.sweep(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    this.store.set(key, entry);
    return 1;
  }

  /** Util sólo para tests: vacía el store. */
  public _resetForTests(): void {
    this.store.clear();
  }
}

/* -------------------------------------------------------------------------- */
/* Singleton                                                                  */
/* -------------------------------------------------------------------------- */

type GlobalCache = { __albumgpRedis?: RedisLike };
const globalForRedis = globalThis as unknown as GlobalCache;

function buildClient(): RedisLike {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    // Cliente real. `@upstash/redis` retorna `Promise<…>` con tipos propios,
    // adaptamos al subset que necesitamos.
    const upstash = new Redis({ url, token });
    const adapter: RedisLike = {
      async get(key) {
        const v = await upstash.get<string>(key);
        return v ?? null;
      },
      async set(key, value, opts) {
        if (opts?.ex !== undefined) {
          await upstash.set(key, value, { ex: opts.ex });
        } else {
          await upstash.set(key, value);
        }
        return "OK";
      },
      async incr(key) {
        return upstash.incr(key);
      },
      async expire(key, seconds) {
        const res = await upstash.expire(key, seconds);
        return res;
      },
      pipeline() {
        return upstash.pipeline() as unknown as RedisPipelineLike;
      },
    };
    return adapter;
  }

  // Fallback dev-only. Aviso en consola para que sea imposible no notarlo.
  if (process.env.NODE_ENV === "production") {
    // En prod fallar fuerte: no queremos rate-limit fantasma.
    throw new Error(
      "[redis] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN no configurados en producción.",
    );
  }
  // eslint-disable-next-line no-console
  console.warn(
    "[redis] Usando InMemoryRedis DEV-ONLY (sin UPSTASH_REDIS_REST_URL). " +
      "Rate-limit y locks NO son consistentes entre procesos.",
  );
  return new InMemoryRedis();
}

/**
 * Obtiene (o crea una vez) el cliente Redis del proceso actual.
 * Reusar siempre esta función — no instanciar `new Redis(...)` ad-hoc.
 */
export function getRedis(): RedisLike {
  if (!globalForRedis.__albumgpRedis) {
    globalForRedis.__albumgpRedis = buildClient();
  }
  return globalForRedis.__albumgpRedis;
}

/** SÓLO TESTS: reemplaza el singleton por uno limpio. */
export function _resetRedisForTests(client?: RedisLike): void {
  globalForRedis.__albumgpRedis = client ?? new InMemoryRedis();
}
