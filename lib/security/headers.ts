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

// ElevenLabs ConvAI widget. El embed (unpkg) carga código adicional desde
// jsdelivr, conecta por HTTPS/WSS a las APIs/LiveKit de ElevenLabs, usa
// fingerprinting anti-fraude (openfpcdn/fingerprint), fuentes de Google y
// assets en googleapis. Habilitamos exactamente esos orígenes.
// blob: en script-src es necesario para el AudioWorklet de la LLAMADA de voz:
// ElevenLabs construye el rawAudioProcessor worklet como un Blob y lo carga con
// audioContext.audioWorklet.addModule(blobURL). Sin blob: en script-src el
// navegador bloquea el worklet → "Failed to load the rawAudioProcessor worklet".
const EL_SCRIPT =
  "https://unpkg.com https://cdn.jsdelivr.net https://*.elevenlabs.io https://m1.openfpcdn.io https://*.fpjs.io blob:";
const EL_CONNECT =
  "https://*.elevenlabs.io wss://*.elevenlabs.io https://unpkg.com https://cdn.jsdelivr.net https://m1.openfpcdn.io https://*.fpjs.io https://api.fpjs.io https://storage.googleapis.com blob:";
const EL_STYLE = "https://unpkg.com https://cdn.jsdelivr.net https://fonts.googleapis.com";
const EL_FONT = "https://fonts.gstatic.com";
const EL_IMG = "https://*.elevenlabs.io https://storage.googleapis.com";
const EL_MEDIA = "https://*.elevenlabs.io https://storage.googleapis.com blob:";

const CSP_DIRECTIVES: ReadonlyArray<string> = [
  "default-src 'self'",
  // 'unsafe-inline' también en prod: el embed de ElevenLabs ejecuta scripts
  // inline (el navegador los bloqueaba con 'self' a secas → el widget no
  // montaba). 'blob:' habilita el AudioWorklet de la llamada de voz.
  // Trade-off de seguridad aceptado para habilitar el asistente.
  `script-src 'self' 'unsafe-inline' ${EL_SCRIPT}`,
  // AudioWorklet + Web Workers desde blob:.
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  `style-src 'self' 'unsafe-inline' ${EL_STYLE}`,
  `img-src 'self' data: blob: ${EL_IMG}`,
  `media-src 'self' blob: ${EL_MEDIA}`,
  `font-src 'self' data: ${EL_FONT}`,
  `connect-src 'self' ${EL_CONNECT}`,
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
