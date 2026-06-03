// Cabeceras de seguridad globales. Definidas en TS en `lib/security/headers.ts`
// y replicadas aquí en JS plano porque `next.config.mjs` se ejecuta antes de
// que TS sea transpilado. Si cambias una, cambia la otra (los tests verifican
// la versión TS, fuente de verdad).
const isProd = process.env.NODE_ENV === "production";

// WHY: prod debe servir CSP estricta sin 'unsafe-inline' (SECURITY.md);
// dev lo necesita para HMR/overlays de Next.
// ElevenLabs ConvAI widget. El embed (unpkg) carga código adicional desde
// jsdelivr, conecta por HTTPS/WSS a las APIs/LiveKit de ElevenLabs, usa
// fingerprinting anti-fraude (openfpcdn/fingerprint), fuentes de Google y
// assets en googleapis. Habilitamos exactamente esos orígenes.
// IMPORTANTE: mantener en sync con lib/security/headers.ts (fuente de verdad).
// blob: en script-src/connect-src es necesario para el AudioWorklet de la
// LLAMADA de voz: ElevenLabs construye el rawAudioProcessor worklet como Blob y
// lo carga con audioWorklet.addModule(blobURL). Sin blob: → "Failed to load the
// rawAudioProcessor worklet module".
const EL_SCRIPT =
  "https://unpkg.com https://cdn.jsdelivr.net https://*.elevenlabs.io https://m1.openfpcdn.io https://*.fpjs.io blob:";
const EL_CONNECT =
  "https://*.elevenlabs.io wss://*.elevenlabs.io https://unpkg.com https://cdn.jsdelivr.net https://m1.openfpcdn.io https://*.fpjs.io https://api.fpjs.io https://storage.googleapis.com blob:";
const EL_STYLE = "https://unpkg.com https://cdn.jsdelivr.net https://fonts.googleapis.com";
const EL_FONT = "https://fonts.gstatic.com";
const EL_IMG = "https://*.elevenlabs.io https://storage.googleapis.com";
const EL_MEDIA = "https://*.elevenlabs.io https://storage.googleapis.com blob:";

// 'unsafe-inline' también en prod: el embed de ElevenLabs ejecuta scripts
// inline (el navegador los bloqueaba con 'self' a secas → el widget no montaba).
const scriptSrc = `script-src 'self' 'unsafe-inline' ${EL_SCRIPT}`;

const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; " +
      scriptSrc + "; " +
      "worker-src 'self' blob:; " +
      "child-src 'self' blob:; " +
      `style-src 'self' 'unsafe-inline' ${EL_STYLE}; ` +
      `img-src 'self' data: blob: ${EL_IMG}; ` +
      `media-src 'self' blob: ${EL_MEDIA}; ` +
      `font-src 'self' data: ${EL_FONT}; ` +
      `connect-src 'self' ${EL_CONNECT}; ` +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self'",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // microphone=(self) habilita el asistente de voz ElevenLabs en este origen.
    value: "camera=(), microphone=(self), geolocation=(), payment=()",
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // WHY: evita leak de stack via X-Powered-By: Next.js.
  poweredByHeader: false,
  // Cache-bust nunca; assets bajo /brand y /assets son inmutables y versionados por hash.
  images: {
    minimumCacheTTL: 31536000,
    formats: ["image/avif", "image/webp"],
    // WHY: cards se renderizan a <=256px; recortar variantes evita srcsets de 3840w inservibles.
    deviceSizes: [640, 750, 828, 1080],
    imageSizes: [128, 192, 256, 384, 640],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: SECURITY_HEADERS,
      },
      {
        source: "/brand/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/assets/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // WHY: variantes optimizadas son inmutables (clave por url+w+q); cachear en navegador.
        source: "/_next/image(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
