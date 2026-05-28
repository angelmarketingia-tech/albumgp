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
import { rateLimit, type RateLimitResult } from "../redis/rate-limit";
import { genericError } from "./response";

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
    for (const rule of rules) {
      const result: RateLimitResult = await rateLimit(rule);
      if (!result.allowed) {
        return genericError(429, "rate_limited");
      }
    }
    return handler(req, ctx);
  };
}
