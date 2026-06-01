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
// Atomic INCR + conditional EXPIRE. We MUST NOT call EXPIRE on every hit:
// doing so slides the TTL forward forever, so a client that keeps hammering
// while rate-limited never sees the window reset. Matching the non-pipeline
// branch's "only expire on count === 1" semantics, but server-side.
// Exported so batched callers (see `with-rate-limit.ts`) can issue the same
// atomic INCR+conditional-EXPIRE inside a single pipeline.
export const INCR_EXPIRE_IF_NEW = "local v = redis.call('INCR', KEYS[1]); if v == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return v";

// Narrow structural view of an Upstash-like client that exposes EVAL. We
// don't widen RedisLike itself to keep its surface auditable; this cast is
// local to the rate-limit hot path.
interface RedisWithEval {
  eval(script: string, keys: string[], args: string[]): Promise<unknown>;
}

export async function rateLimit(
  opts: RateLimitOptions,
  redis: RedisLike = getRedis(),
): Promise<RateLimitResult> {
  const { key, max, windowSeconds } = opts;
  let count: number;
  const maybeEval = (redis as Partial<RedisWithEval>).eval;
  if (typeof maybeEval === "function") {
    const res = await maybeEval.call(redis, INCR_EXPIRE_IF_NEW, [key], [String(windowSeconds)]);
    count = typeof res === "number" ? res : Number(res);
  } else {
    count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
  }
  const allowed = count <= max;
  const remaining = Math.max(0, max - count);
  const resetAt = Date.now() + windowSeconds * 1000;
  return { allowed, remaining, resetAt };
}

export interface RateLimitRuleInput {
  key: string;
  max: number;
  windowSeconds: number;
}

// Structural view of a pipeline that supports EVAL (Upstash). Kept local so the
// wider surface stays confined to this hot path.
interface RedisPipelineWithEval {
  eval(script: string, keys: string[], args: string[]): unknown;
  exec(): Promise<unknown[]>;
}

interface RedisWithPipeline {
  pipeline?: () => unknown;
}

/**
 * Evaluate several rate-limit rules in ONE Redis round-trip when the client
 * supports pipelining + EVAL (Upstash). Returns `allowed=false` as soon as any
 * rule's post-INCR count exceeds its `max`. Falls back to serial `rateLimit`
 * calls only for the in-memory dev adapter (no `pipeline()`), which is local.
 *
 * This is the shared primitive behind both the HTTP `withRateLimit` HOF and the
 * direct callers (e.g. `openCodeDirect`) so neither pays N sequential HTTP hops
 * to Upstash on the hot path.
 */
export async function rateLimitBatch(
  rules: ReadonlyArray<RateLimitRuleInput>,
  redis: RedisLike = getRedis(),
): Promise<{ allowed: boolean }> {
  if (rules.length === 0) return { allowed: true };

  const pipeFactory = (redis as RedisWithPipeline).pipeline?.bind(redis);
  const pipe = pipeFactory ? (pipeFactory() as Partial<RedisPipelineWithEval>) : null;
  if (pipe && typeof pipe.eval === "function" && typeof pipe.exec === "function") {
    for (const rule of rules) {
      pipe.eval(INCR_EXPIRE_IF_NEW, [rule.key], [String(rule.windowSeconds)]);
    }
    const results = await pipe.exec();
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i]!;
      const raw = results[i];
      const count = typeof raw === "number" ? raw : Number(raw);
      if (!(count <= rule.max)) return { allowed: false };
    }
    return { allowed: true };
  }

  // Serial fallback (in-memory dev adapter).
  for (const rule of rules) {
    const res = await rateLimit(rule, redis);
    if (!res.allowed) return { allowed: false };
  }
  return { allowed: true };
}

/* -------------------------------------------------------------------------- */
/* Helpers de keys                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Extrae la IP del cliente, devolviéndola saneada o un bucket UA-hash si no
 * es válida / no podemos confiar en el header.
 *
 * Por qué la cautela con XFF: cualquier cliente puede enviarlo. Si lo
 * honramos a ciegas fuera de Vercel, un atacante rota el primer hop y evita
 * por completo el rate-limit. Política:
 *   1. En Vercel: confiamos en `x-vercel-forwarded-for` (Vercel lo inyecta
 *      y desecha cualquier valor del cliente). Este header sí pone al
 *      cliente como PRIMER hop.
 *   2. Fuera de Vercel: leemos primero la IP del peer (socket). Sólo si el
 *      peer está en la allowlist `TRUSTED_PROXY_CIDRS` consultamos XFF /
 *      x-real-ip, y en ese caso tomamos el ÚLTIMO hop (el que añadió
 *      nuestro proxy de confianza) — no el primero, que es client-supplied.
 *   3. Si nada de lo anterior produce una IP válida, caemos a un bucket
 *      derivado de UA + Accept-Language (estable per-client; evita que
 *      todos los anónimos compartan un literal "unknown" y se bloqueen
 *      mutuamente).
 */
export function extractClientIp(req: Request): string {
  const isVercel = !!process.env.VERCEL;

  let candidate = "";
  if (isVercel) {
    // Vercel-injected header: client is the first entry. `request.ip` is
    // surfaced here too by the runtime — preferring the header keeps this
    // pure-Request based and testable.
    const vxff = req.headers.get("x-vercel-forwarded-for") ?? "";
    const first = vxff.split(",")[0] ?? "";
    candidate = first.trim();
  } else {
    // Peer/socket IP — set by the platform on the Request (Node adapter),
    // not spoofable by the client. May not exist in plain `Request`.
    const peer = readPeerIp(req);
    if (peer && isTrustedProxy(peer)) {
      // Trusted upstream: honor the chain but read from the END so we get
      // the address our own proxy observed, not whatever the client typed.
      const xff = req.headers.get("x-forwarded-for") ?? "";
      const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
      const lastHop = hops.length > 0 ? hops[hops.length - 1] ?? "" : "";
      candidate = lastHop || (req.headers.get("x-real-ip") ?? "").trim() || peer;
    } else if (peer) {
      candidate = peer;
    }
  }

  // Strip IPv6 brackets first, then any trailing :port (IPv4 only — bracketless
  // IPv6 has colons everywhere, so we don't touch it).
  const debracketed = candidate.replace(/^\[|\]$/g, "");
  const stripped = debracketed.includes(":") && !debracketed.includes(".")
    ? debracketed
    : debracketed.replace(/:\d+$/, "");
  const sanitized = /^[0-9a-fA-F.:]+$/.test(stripped) ? stripped : "";
  if (sanitized) return sanitized;
  // Stable per-client fallback so a single bad actor without a usable IP
  // header doesn't share one bucket with everyone else under literal 'unknown'.
  const ua = req.headers.get("user-agent") ?? "";
  const al = req.headers.get("accept-language") ?? "";
  const hash = createHash("sha256").update(`${ua}\n${al}`, "utf8").digest("hex");
  return `ua:${hash}`;
}

// `Request` doesn't expose the peer socket address in the standard spec,
// but Node/Next adapters often attach it (e.g. `req.ip`, or via a symbol).
// We read it defensively without widening types globally.
function readPeerIp(req: Request): string {
  const anyReq = req as unknown as { ip?: unknown; socket?: { remoteAddress?: unknown } };
  if (typeof anyReq.ip === "string" && anyReq.ip.length > 0) return anyReq.ip;
  const remote = anyReq.socket?.remoteAddress;
  return typeof remote === "string" ? remote : "";
}

// Allowlist of upstream proxies whose XFF we accept. CIDR strings are kept
// as exact-prefix matches (string-startsWith on the network portion) — full
// CIDR math would require a parser we don't want to pull in. Operators are
// expected to list the proxy's exact IP or a short, unambiguous prefix.
function isTrustedProxy(peer: string): boolean {
  const raw = process.env.TRUSTED_PROXY_CIDRS ?? "";
  if (!raw) return false;
  const entries = raw.split(",").map((s) => s.trim()).filter(Boolean);
  for (const entry of entries) {
    if (peer === entry) return true;
    const slash = entry.indexOf("/");
    const network = slash >= 0 ? entry.slice(0, slash) : entry;
    if (network && peer.startsWith(network)) return true;
  }
  return false;
}

/**
 * Construye una key de rate-limit por IP. Reusa `extractClientIp` para
 * obtener la IP saneada y le prepende el namespace `rl:ip:<suffix>:`.
 */
export function keyForIp(req: Request, suffix: string): string {
  return `rl:ip:${suffix}:${extractClientIp(req)}`;
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
