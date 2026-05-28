/**
 * Cabeceras de seguridad globales para la app.
 *
 * Estas cabeceras se aplican a TODAS las rutas vía `next.config.mjs > headers()`.
 * También se reusan desde `lib/security/response.ts` para garantizar que las
 * respuestas JSON de los endpoints API lleven los mismos defensivos básicos.
 *
 * Referencias:
 *  - AGENTS.md sec. 8 (seguridad — CSP, HSTS, sin secretos en cliente).
 *  - OWASP Secure Headers Project.
 */

/**
 * Content-Security-Policy.
 *
 * `'unsafe-inline'` está habilitado en `script-src` y `style-src` porque Next.js
 * 14 (App Router) inyecta scripts/estilos inline en el HTML hidratado y el
 * runtime de React Server Components. Sin él, la app rompe.
 *
 * TODO(seguridad/fase-prod): migrar a CSP estricta con nonces por request,
 * usando un middleware que inyecte `Content-Security-Policy` dinámica con el
 * nonce generado y propagado a `<Script nonce={...}>`. Requiere también
 * eliminar estilos inline o servirlos vía hash. Ref:
 * https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
 */
const CSP_DIRECTIVES: ReadonlyArray<string> = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

export const CONTENT_SECURITY_POLICY: string = CSP_DIRECTIVES.join("; ");

/**
 * Lista de cabeceras de seguridad. Tipada como tuplas `[key, value]` para
 * facilitar tanto el formato esperado por `next.config.mjs` (array de objetos
 * `{ key, value }`) como la inyección en `NextResponse.json(..., { headers })`
 * (objeto plano).
 */
export const SECURITY_HEADERS_LIST: ReadonlyArray<
  Readonly<{ key: string; value: string }>
> = [
  {
    key: "Content-Security-Policy",
    value: CONTENT_SECURITY_POLICY,
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

/**
 * Diccionario plano `{ [headerName]: value }` listo para pasar como `headers`
 * a `NextResponse.json`/`Response`.
 */
export const SECURITY_HEADERS: Readonly<Record<string, string>> =
  Object.freeze(
    SECURITY_HEADERS_LIST.reduce<Record<string, string>>((acc, h) => {
      acc[h.key] = h.value;
      return acc;
    }, {}),
  );

/**
 * Helper para `next.config.mjs > async headers()`. Devuelve la config
 * asignable directamente a `source: '/(.*)' , headers: [...]`.
 */
export function securityHeadersForNextConfig(): Array<{
  key: string;
  value: string;
}> {
  return SECURITY_HEADERS_LIST.map((h) => ({ key: h.key, value: h.value }));
}
