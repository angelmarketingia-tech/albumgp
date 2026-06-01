/**
 * HOF para envolver handlers del App Router con rate-limit.
 *
 * Permite combinar varias keys (típicamente IP + hash de código) y aplica el
 * límite más restrictivo: si CUALQUIERA excede, responde 429.
 *
 * No conoce de Zod ni de negocio: sólo gate + handler. La key de código se
 * arma fuera (con `keyForCode`) porque la firma del handler tiene el body ya
 * parseado y nosotros queremos un wrapper agnóstico.
 *
 * AGENTS.md sec. 8: rate limiting estricto en endpoints calientes.
 */

import { NextResponse } from "next/server";
import { getRedis, type RedisPipelineLike } from "../redis/client";
import { INCR_EXPIRE_IF_NEW, rateLimit } from "../redis/rate-limit";
import { genericError } from "./response";

// Structural view of a pipeline that also supports EVAL — Upstash exposes it,
// but our `RedisPipelineLike` interface intentionally stays narrow. Local cast
// keeps the wider surface confined to this hot path.
interface PipelineWithEval extends RedisPipelineLike {
  eval(script: string, keys: string[], args: string[]): this;
}

export interface RateLimitRule {
  key: string;
  max: number;
  windowSeconds: number;
}

export type Handler<TCtx> = (
  req: Request,
  ctx: TCtx,
) => Promise<NextResponse> | NextResponse;

/**
 * Construye las reglas desde el request (necesario porque `keyForIp` lo lee).
 * Si no se quiere usar el contexto se puede pasar una lambda que ignore `req`.
 */
export type RulesBuilder<TCtx> = (
  req: Request,
  ctx: TCtx,
) => ReadonlyArray<RateLimitRule> | Promise<ReadonlyArray<RateLimitRule>>;

/**
 * Envuelve un handler aplicando una o varias reglas de rate-limit en orden.
 * En cuanto una falla, corta con 429 — no consulta las siguientes (cheap).
 *
 * Devuelve siempre un handler tipado por `Handler<TCtx>`.
 */
export function withRateLimit<TCtx>(
  rulesBuilder: RulesBuilder<TCtx>,
  handler: Handler<TCtx>,
): Handler<TCtx> {
  return async (req, ctx) => {
    const rules = await rulesBuilder(req, ctx);
    if (rules.length > 0) {
      // Batch all INCR+EXPIRE pairs in one round-trip when the client supports
      // pipelining + EVAL. Falls back to serial only for the in-memory dev
      // adapter (no pipeline()), which is local and cheap anyway.
      const redis = getRedis();
      const pipeFactory = redis.pipeline?.bind(redis);
      const pipe = pipeFactory ? (pipeFactory() as PipelineWithEval) : null;
      if (pipe && typeof pipe.eval === "function") {
        for (const rule of rules) {
          pipe.eval(INCR_EXPIRE_IF_NEW, [rule.key], [String(rule.windowSeconds)]);
        }
        const results = await pipe.exec();
        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i]!;
          const raw = results[i];
          const count = typeof raw === "number" ? raw : Number(raw);
          if (!(count <= rule.max)) {
            return genericError(429, "rate_limited");
          }
        }
      } else {
        for (const rule of rules) {
          const result = await rateLimit(rule, redis);
          if (!result.allowed) {
            return genericError(429, "rate_limited");
          }
        }
      }
    }
    return handler(req, ctx);
  };
}
