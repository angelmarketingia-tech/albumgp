// Cabeceras de seguridad globales. Definidas en TS en `lib/security/headers.ts`
// y replicadas aquí en JS plano porque `next.config.mjs` se ejecuta antes de
// que TS sea transpilado. Si cambias una, cambia la otra (los tests verifican
// la versión TS, fuente de verdad).
const isProd = process.env.NODE_ENV === "production";

// WHY: prod debe servir CSP estricta sin 'unsafe-inline' (SECURITY.md);
// dev lo necesita para HMR/overlays de Next.
const scriptSrc = isProd
  ? "script-src 'self'"
  : "script-src 'self' 'unsafe-inline'";

const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value:
      "default-src 'self'; " +
      scriptSrc + "; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; " +
      "font-src 'self' data:; " +
      "connect-src 'self'; " +
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
    value: "camera=(), microphone=(), geolocation=(), payment=()",
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
