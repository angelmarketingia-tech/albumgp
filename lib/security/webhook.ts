/**
 * Firma y verificación de webhooks salientes a la plataforma central.
 *
 * Esquema (acordado en AGENTS.md sec. 7 + decisión de Fase 0):
 *   - HMAC-SHA256(secret, "<timestamp>.<body>")
 *   - El receptor verifica firma Y que `|now - timestamp| < tolerancia` para
 *     prevenir replays.
 *
 * Cabeceras convencionadas (las consume Fase 3 cuando construya el sender):
 *   - `X-AlbumGP-Timestamp`  → epoch en segundos, string decimal.
 *   - `X-AlbumGP-Signature`  → hex lowercase del HMAC.
 *
 * Reglas (AGENTS.md sec. 8):
 *   - NUNCA `Math.random`. Aquí usamos `node:crypto` (HMAC + timingSafeEqual).
 *   - El secret JAMÁS llega al cliente; este módulo es server-only.
 *   - Helper PURO (sin I/O, sin envío HTTP). Fase 3 conecta el transporte.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export interface SignedWebhook {
  /** Hex lowercase de HMAC-SHA256 sobre `<timestamp>.<payload>`. */
  signature: string;
  /** Epoch en segundos, como string decimal. */
  timestamp: string;
}

/**
 * Calcula la firma de un payload para un secret dado.
 *
 * @param payload - Cuerpo del request en string (típicamente JSON.stringify).
 * @param secret  - Secret compartido con la plataforma central. ≥ 32 bytes.
 * @param now     - Override de timestamp (en ms) — para tests deterministas.
 */
export function signWebhookPayload(
  payload: string,
  secret: string,
  now: number = Date.now(),
): SignedWebhook {
  if (!secret || secret.length < 16) {
    // No leakeamos el valor en el error; sólo señalamos que está mal.
    throw new Error("[webhook] secret faltante o demasiado corto (<16 chars).");
  }
  const timestamp = Math.floor(now / 1000).toString();
  const signedBody = `${timestamp}.${payload}`;
  const signature = createHmac("sha256", secret)
    .update(signedBody, "utf8")
    .digest("hex");
  return { signature, timestamp };
}

/**
 * Verifica una firma recibida (uso simétrico — útil si recibimos webhooks o
 * para tests). Comparación timing-safe.
 *
 * @param payload   - Body original (en string, exactamente como se firmó).
 * @param secret    - Secret compartido.
 * @param signature - Firma recibida (hex lowercase).
 * @param timestamp - Timestamp recibido (string decimal de epoch s).
 * @param opts.toleranceSeconds - Ventana aceptable (default 300s = 5 min).
 *                                  Si es <=0 se omite la validación temporal
 *                                  (útil sólo en tests).
 * @param opts.now  - Override de "ahora" en ms — sólo tests.
 */
export function verifyWebhookSignature(
  payload: string,
  secret: string,
  signature: string,
  timestamp: string,
  opts: { toleranceSeconds?: number; now?: number } = {},
): boolean {
  const tolerance = opts.toleranceSeconds ?? 300;
  const now = opts.now ?? Date.now();

  // Validar formato de timestamp.
  const tsNum = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(tsNum) || tsNum <= 0) return false;

  if (tolerance > 0) {
    const ageSeconds = Math.abs(Math.floor(now / 1000) - tsNum);
    if (ageSeconds > tolerance) return false;
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`, "utf8")
    .digest("hex");

  // timingSafeEqual exige buffers del mismo tamaño.
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Nombres canónicos de las cabeceras. Exportados para que Fase 3 los reuse y
 * que el receptor (plataforma central) tenga una referencia única.
 */
export const WEBHOOK_HEADER_TIMESTAMP = "X-AlbumGP-Timestamp";
export const WEBHOOK_HEADER_SIGNATURE = "X-AlbumGP-Signature";
