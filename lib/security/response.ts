/**
 * Helpers de respuesta para endpoints API (App Router).
 *
 * REGLA (AGENTS.md sec. 5 + 8):
 *   - Mensajes de error genéricos. NUNCA revelar si un código existe, si está
 *     consumido, si la cuenta SSO está logueada, etc. Cualquier desambiguación
 *     útil se loguea server-side, no se devuelve al cliente.
 *   - Todas las respuestas (ok y error) llevan las SECURITY_HEADERS para que
 *     incluso un endpoint olvidado por el middleware tenga defensiva mínima.
 */

import { NextResponse } from "next/server";
import { SECURITY_HEADERS } from "./headers";

/**
 * Único conjunto de códigos de error permitidos en respuestas públicas.
 * Cualquier otra cosa se mapea a `'internal'`.
 */
export type ErrorCode =
  | "invalid_input"
  | "not_found_or_unavailable"
  | "rate_limited"
  | "conflict"
  | "unauthenticated"
  | "internal";

export interface ErrorBody {
  error: ErrorCode;
}

/**
 * Devuelve una respuesta de error genérica con cabeceras de seguridad.
 * NUNCA pongas información sensible en el body — el detalle va al log server.
 *
 * @param status - HTTP status (400/401/404/409/429/500…). Quien llama decide.
 * @param code   - Código del enum `ErrorCode`. Es el ÚNICO contenido del body.
 */
export function genericError(
  status: number,
  code: ErrorCode,
): NextResponse<ErrorBody> {
  return NextResponse.json<ErrorBody>(
    { error: code },
    { status, headers: SECURITY_HEADERS },
  );
}

/**
 * Wrapper para respuestas exitosas. Devuelve el payload tal cual con status
 * 200 y las SECURITY_HEADERS aplicadas.
 */
export function ok<T>(data: T): NextResponse<T> {
  return NextResponse.json<T>(data, {
    status: 200,
    headers: SECURITY_HEADERS,
  });
}
