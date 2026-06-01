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
 * Content-Security-Policy construida según `NODE_ENV`.
 *
 * En dev/test mantenemos `'unsafe-inline'` en `script-src` porque Next dev,
 * HMR y React Refresh inyectan scripts inline. En producción se elimina para
 * cerrar el principal vector de XSS; `style-src` mantiene `'unsafe-inline'`
 * temporalmente porque framer-motion inyecta estilos inline en runtime.
 *
 * TODO(launch-blocker, seguridad/fase-prod): migrar a CSP estricta con nonces
 * por request — middleware que genere un nonce, lo propague a `<Script>` y a
 * los `<style>` críticos, y emita `Content-Security-Policy` dinámica. Ref:
 * https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
 */
const IS_PROD: boolean = process.env.NODE_ENV === "production";

const CSP_DIRECTIVES: ReadonlyArray<string> = [
  "default-src 'self'",
  IS_PROD ? "script-src 'self'" : "script-src 'self' 'unsafe-inline'",
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
  // Evita que CDNs / bfcache filtren JSON de packs entre usuarios.
  {
    key: "Cache-Control",
    value: "no-store, must-revalidate, private",
  },
  {
    key: "Pragma",
    value: "no-cache",
  },
  // Previene que proxies compartidos colapsen respuestas entre sesiones distintas.
  {
    key: "Vary",
    value: "Cookie",
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
