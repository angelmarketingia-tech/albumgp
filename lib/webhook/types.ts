/**
 * Contrato del payload de webhook saliente para `/api/redeem`.
 *
 * Decisión de Fase 3 (Ola 2): la central no participa en el diseño —
 * nosotros definimos el contrato. Está documentado en SECURITY.md §6.
 *
 * NO incluimos el código en claro. Mandamos `code_id` (UUID) y `code_hash`
 * (SHA-256 hex del código) para que la central pueda correlacionar sin
 * conocer ni almacenar códigos en plaintext en su lado tampoco.
 *
 * `delivery_id` lo genera el caller (route handler) con `crypto.randomUUID`
 * y se pasa como `idempotency-key` para que si nuestro retry llega después
 * de un 200 perdido, la central no procese dos veces.
 */

import { z } from "zod";
import { packResultSchema } from "@/lib/prizes";
import type { PackResult } from "@/lib/prizes";

export interface RedemptionWebhookPayload {
  event: "redemption";
  /** UUID del Code (NO el código en claro). */
  code_id: string;
  /** SHA-256 hex del código en claro — para correlación. */
  code_hash: string;
  country: "SV" | "GT";
  /** Identificador opaco proveniente del IdentityProvider. */
  account_id: string;
  /** Snapshot tal cual se persistió en `redemptions.result`. */
  prizes: PackResult;
  /** ISO 8601 — timestamp en el que quedó registrado el canje. */
  redeemed_at: string;
  /** UUID — idempotency key, usado como header `idempotency-key`. */
  delivery_id: string;
}

const uuidV4Like = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha256Hex = /^[0-9a-f]{64}$/;

/**
 * Schema Zod equivalente al tipo de arriba. QA lo usa para validar la forma
 * exacta sin replicar la definición.
 */
export const redemptionWebhookPayloadSchema: z.ZodType<RedemptionWebhookPayload> =
  z.object({
    event: z.literal("redemption"),
    code_id: z.string().regex(uuidV4Like, "invalid_uuid"),
    code_hash: z.string().regex(sha256Hex, "invalid_sha256"),
    country: z.union([z.literal("SV"), z.literal("GT")]),
    account_id: z.string().min(1),
    prizes: packResultSchema,
    redeemed_at: z.string().datetime(),
    delivery_id: z.string().regex(uuidV4Like, "invalid_uuid"),
  });
