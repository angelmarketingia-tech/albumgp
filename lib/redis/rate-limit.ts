/**
 * Rate limiting fixed-window con Redis (`INCR` + `EXPIRE`).
 *
 * Por qué fixed-window y no token-bucket:
 *   - INCR es atómico en Redis. Dos operaciones (`INCR` + `EXPIRE`) son
 *     suficientes y baratísimas vía Upstash REST (latencia desde edge).
 *   - Tradeoff conocido: hasta 2× requests permitidos en el límite entre
 *     ventanas. Aceptable para nuestro perfil de abuso (códigos brute-force).
 *
 * AGENTS.md sec. 5 + 8:
 *   - Hash SHA-256 del código antes de usarlo como key — no queremos códigos
 *     en claro en métricas/logs de Redis.
 *   - IP extraída de `x-forwarded-for` (primera entrada). Vercel respeta este
 *     header con la IP del cliente al inicio. Sanitización mínima.
 */

import { createHash } from "node:crypto";
import { getRedis, type RedisLike } from "./client";

export interface RateLimitOptions {
  /** Key opaca. Debe estar pre-namespaceada (ej. `rl:ip:open:1.2.3.4`). */
  key: string;
  /** Máximo de requests permitidos dentro de `windowSeconds`. */
  max: number;
  /** Tamaño de la ventana en segundos. */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** ms epoch en que se resetea esta ventana. */
  resetAt: number;
}

/**
 * Aplica rate limit. Devuelve `allowed=false` cuando se excede `max`.
 *
 * Usa `INCR` para obtener el contador atómicamente; si el resultado es 1,
 * acabamos de crear la key y le ponemos TTL. Si por race condition la key
 * existe pero sin TTL (caso raro: server muere entre INCR e EXPIRE), el
 * próximo request normalizará — peor caso es una ventana extendida.
 */
export async function rateLimit(
  opts: RateLimitOptions,
  redis: RedisLike = getRedis(),
): Promise<RateLimitResult> {
  const { key, max, windowSeconds } = opts;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  const allowed = count <= max;
  const remaining = Math.max(0, max - count);
  const resetAt = Date.now() + windowSeconds * 1000;
  return { allowed, remaining, resetAt };
}

/* -------------------------------------------------------------------------- */
/* Helpers de keys                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Extrae la primera IP del header `x-forwarded-for`.
 *
 * Vercel pone la IP real del cliente como primer elemento de la cadena
 * (`client, proxy1, proxy2`). Tomamos sólo la primera, recortada y sanitizada
 * para evitar caracteres raros que pudieran inyectarse en una key.
 *
 * Sanitización: sólo se permiten `0-9`, `a-f`, `A-F`, `.` , `:`. Cualquier
 * otra cosa se descarta y caemos a `'unknown'`.
 *
 * TODO(seguridad/prod): En Vercel también está disponible `request.ip` en
 * middleware Edge. Considerar usar eso cuando estemos en Edge runtime para
 * evitar spoofing de `x-forwarded-for` cuando la app corra detrás de un
 * proxy adicional. Hoy en serverless functions el header es confiable.
 */
export function keyForIp(req: Request, suffix: string): string {
  const xff = req.headers.get("x-forwarded-for") ?? "";
  const first = xff.split(",")[0]?.trim() ?? "";
  const sanitized = /^[0-9a-fA-F.:]+$/.test(first) ? first : "";
  const ip = sanitized || "unknown";
  return `rl:ip:${suffix}:${ip}`;
}

/**
 * Construye una key de rate-limit basada en un código de canje. El código se
 * hashea SHA-256 para que NUNCA aparezca en claro como key de Redis.
 *
 * El hash es determinista (mismo código → misma key) que es justo lo que
 * necesitamos para contar intentos sobre el mismo código.
 */
export function keyForCode(code: string, suffix: string): string {
  const hash = createHash("sha256").update(code, "utf8").digest("hex");
  return `rl:code:${suffix}:${hash}`;
}
