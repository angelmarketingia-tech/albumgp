/**
 * Sender de webhook saliente firmado para `/api/redeem`.
 *
 * SERVER ONLY. Importarlo desde un componente `'use client'` rompería el
 * build (importamos `node:crypto` indirectamente vía `signWebhookPayload`).
 *
 * Comportamiento (decisiones cerradas por el líder, Fase 3 Ola 2):
 *   - Si `WEBHOOK_CENTRAL_URL` está vacío → DRY-RUN: loggea el payload
 *     firmado (sin filtrar la firma completa: sólo los primeros 8 hex chars
 *     para correlación) y devuelve `{ status: 'sent', attempts: 0 }`. NO
 *     incrementa attempts, NO toca BD. El handler de redeem interpreta este
 *     `attempts: 0` como "no se intentó realmente, fue dry-run".
 *   - Si hay URL → POST firmado con retries 1s/5s/30s. Total 3 intentos
 *     (1 inicial + 2 retries). Timeout 10s por intento vía AbortController.
 *   - El secret JAMÁS aparece en logs ni en errores.
 *
 * SECURITY.md §6 — ver documentación del contrato.
 */

import {
  signWebhookPayload,
  WEBHOOK_HEADER_SIGNATURE,
  WEBHOOK_HEADER_TIMESTAMP,
} from "@/lib/security/webhook";
import type { RedemptionWebhookPayload } from "./types";

/** Resultado del envío para el caller (handler de redeem). */
export interface WebhookDeliveryResult {
  /**
   * - `'sent'`  → en dry-run (URL vacía) o cuando algún intento devolvió 2xx.
   * - `'failed'` → 3 intentos consecutivos sin éxito.
   */
  status: "sent" | "failed";
  /**
   * Número de intentos REALES (fetch) ejecutados. Dry-run siempre devuelve 0.
   * El handler usa este número para `redemptions.webhook_attempts`.
   */
  attempts: number;
  /** Mensaje truncado del último error si `status === 'failed'`. */
  lastError?: string;
}

export interface SendWebhookOptions {
  /** Override de `fetch` para tests. */
  fetchImpl?: typeof fetch;
  /** Override de `setTimeout`-like, para tests deterministas. */
  sleepImpl?: (ms: number) => Promise<void>;
  /** Override de "now" para timestamp determinista en tests. */
  nowImpl?: () => number;
}

/** Backoff entre intentos: espera ANTES del intento `i+1`. */
const BACKOFF_MS: readonly number[] = [1000, 5000, 30000];
const MAX_ATTEMPTS = 3;
const PER_ATTEMPT_TIMEOUT_MS = 10_000;
const MAX_ERROR_LEN = 500;

/** Sleep por defecto: setTimeout en Promise. */
function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Trunca el mensaje de error para que no bombardee la columna en BD. */
function truncateError(err: unknown): string {
  let msg: string;
  if (err instanceof Error) {
    msg = err.message;
  } else if (typeof err === "string") {
    msg = err;
  } else {
    msg = "unknown_error";
  }
  return msg.length > MAX_ERROR_LEN ? msg.slice(0, MAX_ERROR_LEN) : msg;
}

interface LogFields {
  delivery_id: string;
  code_id: string;
  attempt?: number;
  status_code?: number;
  error?: string;
}

/** Log estructurado JSON (una sola línea, grep-friendly). */
function logInfo(event: string, fields: LogFields): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ level: "info", event, ...fields }));
}

function logWarn(event: string, fields: LogFields): void {
  // eslint-disable-next-line no-console
  console.warn(JSON.stringify({ level: "warn", event, ...fields }));
}

function logError(event: string, fields: LogFields): void {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ level: "error", event, ...fields }));
}

/**
 * Ejecuta UN intento de fetch con timeout. Devuelve `{ ok, statusCode? }`
 * indicando si la respuesta fue 2xx, o lanza si fetch revienta.
 */
async function attemptOnce(
  url: string,
  body: string,
  headers: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<{ ok: boolean; statusCode: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, PER_ATTEMPT_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    const statusCode = res.status;
    const ok = statusCode >= 200 && statusCode < 300;
    return { ok, statusCode };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Envía el webhook con reintentos. Ver módulo header para semántica completa.
 *
 * @param payload  Payload ya construido por el caller. Se serializa una sola
 *                 vez y la misma representación canónica se firma.
 * @param opts     Hooks para tests (fetch, sleep, now). En prod se omiten.
 */
export async function sendRedemptionWebhook(
  payload: RedemptionWebhookPayload,
  opts: SendWebhookOptions = {},
): Promise<WebhookDeliveryResult> {
  const url = process.env.WEBHOOK_CENTRAL_URL ?? "";
  const secret = process.env.WEBHOOK_CENTRAL_SECRET ?? "";
  const fetchImpl = opts.fetchImpl ?? fetch;
  const sleepImpl = opts.sleepImpl ?? defaultSleep;
  const nowImpl = opts.nowImpl ?? Date.now;

  const body = JSON.stringify(payload);

  // Firma siempre — incluso en dry-run — para que QA pueda verificar que la
  // firma queda lista para ser enviada cuando configuremos la URL real.
  // Si el secret no está, esto lanza con un mensaje genérico; en dry-run sin
  // secret seguimos siendo capaces de loggear el payload pero marcamos en logs
  // que no firmamos.
  let signed: { signature: string; timestamp: string } | null = null;
  try {
    signed = signWebhookPayload(body, secret, nowImpl());
  } catch {
    // No leakeamos `err.message` (podría revelar que el secret está vacío).
    // En dry-run sin secret continuamos; en envío real fallaríamos al armar
    // los headers y caemos por el camino de error.
    signed = null;
  }

  // --- DRY-RUN: URL vacía -------------------------------------------------
  if (url.length === 0) {
    const sigPreview = signed ? signed.signature.slice(0, 8) : "unsigned";
    logInfo("webhook.dry_run", {
      delivery_id: payload.delivery_id,
      code_id: payload.code_id,
      // Sólo los primeros 8 chars de la firma — suficiente para correlación
      // sin permitir que un log filtrado reconstruya la firma completa.
      error: `signature_preview=${sigPreview}`,
    });
    return { status: "sent", attempts: 0 };
  }

  // --- ENVÍO REAL ---------------------------------------------------------
  if (signed === null) {
    // No hay secret y la URL sí está → no podemos firmar. Fallamos rápido
    // sin mandar nada en claro a la central.
    logError("webhook.unsigned_blocked", {
      delivery_id: payload.delivery_id,
      code_id: payload.code_id,
      error: "missing_or_invalid_secret",
    });
    return {
      status: "failed",
      attempts: 0,
      lastError: "missing_or_invalid_secret",
    };
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    [WEBHOOK_HEADER_TIMESTAMP]: signed.timestamp,
    [WEBHOOK_HEADER_SIGNATURE]: signed.signature,
    "idempotency-key": payload.delivery_id,
  };

  let lastError = "unknown_error";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const { ok, statusCode } = await attemptOnce(url, body, headers, fetchImpl);
      if (ok) {
        logInfo("webhook.sent", {
          delivery_id: payload.delivery_id,
          code_id: payload.code_id,
          attempt,
          status_code: statusCode,
        });
        return { status: "sent", attempts: attempt };
      }
      lastError = `http_${statusCode}`;
      logWarn("webhook.non_2xx", {
        delivery_id: payload.delivery_id,
        code_id: payload.code_id,
        attempt,
        status_code: statusCode,
      });
    } catch (err) {
      lastError = truncateError(err);
      logWarn("webhook.fetch_error", {
        delivery_id: payload.delivery_id,
        code_id: payload.code_id,
        attempt,
        error: lastError,
      });
    }

    // Si éste no es el último intento, esperar el backoff y reintentar.
    if (attempt < MAX_ATTEMPTS) {
      const backoff = BACKOFF_MS[attempt - 1] ?? BACKOFF_MS[BACKOFF_MS.length - 1] ?? 1000;
      await sleepImpl(backoff);
    }
  }

  logError("webhook.failed", {
    delivery_id: payload.delivery_id,
    code_id: payload.code_id,
    attempt: MAX_ATTEMPTS,
    error: lastError,
  });
  return { status: "failed", attempts: MAX_ATTEMPTS, lastError };
}
