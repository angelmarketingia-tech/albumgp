# SECURITY.md — GanaPlay Álbum (operativo)

Documento corto y operativo. Resume cómo el código maneja seguridad HOY (Fase 0). NO es un policy doc legal — ese vive en el lado del dueño.

Lectura obligatoria antes de tocar `/lib/security/`, `/lib/redis/` o endpoints en `/app/api/`.

---

## 1. Secretos

- Solo en variables de entorno del servidor. NUNCA prefijados con `NEXT_PUBLIC_`.
- Cliente nunca ve: `DATABASE_URL`, `DIRECT_DATABASE_URL`, `REDIS_URL`, `UPSTASH_REDIS_REST_*`, `WEBHOOK_CENTRAL_SECRET`.
- `.env.example` se commitea **sin valores**. Reales solo en Vercel/CI.
- `WEBHOOK_CENTRAL_SECRET` mínimo 32 bytes random. Generar con `openssl rand -hex 32`.
- No loggear secretos. No incluirlos en mensajes de error.

## 2. Flujo de validación de código (resumen)

Cuando el usuario envía un código por el input:

1. Endpoint valida con Zod (formato, longitud, charset permitido).
2. Pasa por `withRateLimit`: si excede IP o code-hash → `429 rate_limited`.
3. Lookup en BD con índice único. Resultado **nunca** se devuelve crudo:
   - Si no existe / disabled / expired / redeemed → misma respuesta `404 not_found_or_unavailable`.
4. Si es válido + abierto: marca `opened_at` (no consume) y devuelve `pack_result` fijado.
5. Para CANJEAR: requiere sesión SSO (Fase 3). Update condicional atómico `WHERE status='active'`. Si filas afectadas = 0 → `409 conflict` (ya canjeado por otro). Firma + envía webhook saliente.

Detalle sensible (existe vs consumido vs expirado) queda solo en logs server-side.

## 3. Rate limiting (propuesta de tasas)

Implementado vía `lib/redis/rate-limit.ts` (fixed-window con `INCR` + `EXPIRE`). Reglas se construyen por endpoint:

| Endpoint        | Por IP            | Por código           | Notas |
|-----------------|-------------------|----------------------|-------|
| `POST /api/open`   | 10 req/min        | 5 req/min            | Pre-validación + reveal. Pegada por IP es la primera defensa; código aplica cuando el body trae uno parseable. |
| `POST /api/redeem` | 5 req/min         | 1 req/min            | Canje es one-shot. Más de 1 intento/min por código es prácticamente siempre abuso o bug del cliente. |
| Resto de `/api/*`  | Heredan defaults  | —                    | Defaults vienen de `RATE_LIMIT_IP_PER_MIN`. |

- IP se extrae de `x-forwarded-for` (primera entrada, sanitizada). En Vercel es confiable; ver TODO en `keyForIp`.
- Código se hashea con SHA-256 antes de usarse como key — NUNCA aparece en claro en Redis ni en métricas.
- Fallback in-memory `InMemoryRedis` SOLO en dev local sin Upstash. En producción el cliente Redis falla fuerte si las env vars faltan.

## 4. Cabeceras de seguridad

Definidas en `lib/security/headers.ts` y aplicadas globalmente desde `next.config.mjs` a `/(.*)`.

- **Content-Security-Policy** — `default-src 'self'`, sin wildcards. Detalles en `headers.ts`.
- **Strict-Transport-Security** — 2 años, includeSubDomains, preload.
- **X-Frame-Options** — `DENY`.
- **X-Content-Type-Options** — `nosniff`.
- **Referrer-Policy** — `strict-origin-when-cross-origin`.
- **Permissions-Policy** — bloquea camera, microphone, geolocation, payment.
- **X-XSS-Protection** — NO se usa (deprecado).

Además, `lib/security/response.ts` re-aplica todas las cabeceras a cada `NextResponse.json` (defensiva por si el middleware no corre).

## 5. Convención de respuestas

Toda respuesta de `/api/*` usa `genericError` u `ok`:

```ts
import { genericError, ok } from "@/lib/security/response";

return genericError(404, "not_found_or_unavailable");
return ok({ pack: [...] });
```

Códigos de error permitidos (enum cerrado, ver `response.ts`):

- `invalid_input` — Zod falló o el cuerpo no parseó. 400.
- `not_found_or_unavailable` — código no existe, está consumido, expirado o disabled. 404. **Una sola respuesta** para todos esos casos: no revelar cuál.
- `rate_limited` — 429.
- `conflict` — race en canje (ya canjeado, sesión duplicada). 409.
- `unauthenticated` — falta sesión SSO en endpoint que la requiere. 401.
- `internal` — fallback. 500. Nunca con stack, nunca con detalle.

Cualquier desambiguación útil va a logs estructurados server-side.

## 6. Webhook saliente (firma)

Cuando `/api/redeem` confirme un canje, dispara un webhook firmado a la plataforma central (Fase 3). Esquema definido hoy en `lib/security/webhook.ts`:

- HMAC-SHA256(secret, `<timestamp>.<body>`)
- Cabeceras: `X-AlbumGP-Timestamp` (epoch s) y `X-AlbumGP-Signature` (hex).
- Receptor verifica firma + `|now - timestamp| < tolerancia` (default 5 min) para frenar replays.
- Implementado sólo el helper de firma/verify; el transporte HTTP es Fase 3.

## 7. Inputs

- Todo input cliente → Zod. Sin `as any`, sin coerciones silenciosas.
- Strings nunca se interpolan crudas en queries (Prisma cubre esto, pero confirmar en cada PR).
- Códigos: charset y longitud validados antes de tocar BD o Redis.

## 8. Logs

- Sin secretos (`secret`, `token`, `Authorization`).
- Sin códigos en claro (loggear `code_hash` = SHA-256 hex si hay que correlacionar).
- IPs sí (legítimo para auditoría / abuso).

## 9. Pendientes / TODOs

- **CSP estricta con nonces** — hoy `'unsafe-inline'` por requerimiento de Next 14. Migrar a nonces antes de prod final. Ref en `lib/security/headers.ts`.
- **IP detrás de Vercel Edge** — usar `request.ip` (Edge runtime) o `geo` cuando movamos endpoints calientes a Edge, en vez de confiar en `x-forwarded-for`. Comentario TODO en `keyForIp`.
- **SSO real (Fase 3)** — hoy bloqueado. Cuando entre, validar PKCE/state, no almacenar tokens en localStorage, cookies `Secure+HttpOnly+SameSite=Lax`.
- **Auditoría de canjes** — tabla `redemptions` ya en schema. Falta sink inmutable (append-only) y retención mínima.
- **Verificación de edad / 18+** — responsabilidad del dueño / SSO. La UI muestra avisos (AGENTS.md sec. 12).
