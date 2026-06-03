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
 * cerrar el principal vector de XSS.
 *
 * `style-src` mantiene `'unsafe-inline'` porque la UI usa atributos `style={{}}`
 * de React en runtime (barras de progreso, halos por rareza, delays, gradientes
 * dinámicos). NO es por framer-motion (la app no lo usa; animaciones = CSS puro).
 * Quitar `'unsafe-inline'` de style-src rompería esos estilos inline.
 *
 * TODO(seguridad/fase-prod, NO bloqueante): para una CSP estricta de estilos,
 * migrar los `style={{}}` restantes a clases/CSS-vars y usar nonces por request
 * vía middleware. Ref:
 * https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
 */
const IS_PROD: boolean = process.env.NODE_ENV === "production";

// ElevenLabs ConvAI widget: embed servido por unpkg; conecta por HTTPS/WSS a la
// API de ElevenLabs, usa Web Workers (blob:) y pide micrófono. Orígenes acotados.
const ELEVENLABS_SCRIPT = "https://unpkg.com https://*.elevenlabs.io";
const ELEVENLABS_CONNECT =
  "https://*.elevenlabs.io wss://*.elevenlabs.io https://unpkg.com";

const CSP_DIRECTIVES: ReadonlyArray<string> = [
  "default-src 'self'",
  IS_PROD
    ? `script-src 'self' ${ELEVENLABS_SCRIPT}`
    : `script-src 'self' 'unsafe-inline' ${ELEVENLABS_SCRIPT}`,
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  "img-src 'self' data: blob: https://*.elevenlabs.io",
  "media-src 'self' blob: https://*.elevenlabs.io",
  "font-src 'self' data:",
  `connect-src 'self' ${ELEVENLABS_CONNECT}`,
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
    // microphone=(self) habilita el asistente de voz ElevenLabs en este origen.
    value: "camera=(), microphone=(self), geolocation=(), payment=()",
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
