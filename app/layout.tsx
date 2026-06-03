import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { AgeGate } from "@/components/legal/AgeGate";
import { ElevenLabsWidget } from "@/components/widgets/ElevenLabsWidget";
import "./globals.css";

// [CONFIRMAR_TIPOGRAFIA_OFICIAL] — el Manual de Marca especifica:
//   - Stage Grotesk (sans, principal) — comercial, requiere licencia.
//   - Qartella (decorativa) — comercial, requiere licencia.
// Hasta que el dueño provea archivos .woff2 con licencia, usamos near-matches
// gratuitas de Google Fonts:
//   - DM Sans  ≈ Stage Grotesk (sans geométrica, peso fuerte disponible).
//   - Fraunces ≈ Qartella (display serif).
// El swap a las fuentes oficiales reemplaza únicamente estas dos cargas.
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-gp-sans",
  adjustFontFallback: true,
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["700", "900"],
  display: "swap",
  preload: false,
  variable: "--font-gp-display",
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "GanaPlay Álbum",
  description: "Canje de códigos y álbum de premios GanaPlay.",
  openGraph: {
    title: "GanaPlay Álbum 2026",
    description: "Abrí tu sobre y armá tu colección.",
    locale: "es_SV",
    type: "website",
    // images: auto-detected by Next 14 from app/opengraph-image.png.
  },
  twitter: {
    card: "summary_large_image",
    // images: auto-derived from app/opengraph-image.png.
  },
  // PWA / installable-app metadata. `manifest` points at app/manifest.ts.
  manifest: "/manifest.webmanifest",
  applicationName: "GanaPlay Álbum",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GanaPlay",
  },
  formatDetection: {
    // Stop iOS Safari from auto-linking the 16-char code as a phone number.
    telephone: false,
  },
};

// Viewport + theme-color. `viewportFit: "cover"` lets the green background
// bleed under the notch/home-bar so `env(safe-area-inset-*)` padding (added
// in globals.css) can keep content clear of them. `themeColor` paints the
// browser/standalone chrome in brand green. We allow pinch-zoom (no
// maximum-scale lock) for accessibility; iOS input-zoom is prevented by
// keeping input font-size >= 16px instead.
export const viewport: Viewport = {
  themeColor: "#00783E",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="es" className={`${dmSans.variable} ${fraunces.variable} overflow-x-hidden`}>
      <body className="min-h-screen relative overflow-x-hidden bg-gp-radial font-sans text-gp-white antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-gp-gold focus:px-4 focus:py-2 focus:font-bold focus:text-gp-green-deep focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white">Saltar al contenido</a>
        <div aria-hidden className="pointer-events-none fixed -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-gp-green-core/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none fixed -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-gp-gold/10 blur-3xl" />
        {children}
        {/* 18+ confirmation overlay (client island; no-op when already accepted
            or when JS is disabled — the platform age-verifies at signup). */}
        <AgeGate />
        {/* Asistente de voz ElevenLabs (ConvAI). El custom element lo monta el
            script embebido de unpkg. La CSP en next.config.mjs habilita los
            orígenes de ElevenLabs (script/connect/worker/media/img/font).
            Usamos el <script async> NATIVO (no next/script) porque el embed de
            ElevenLabs registra el custom element vía customElements.define, y
            la inyección diferida de next/script no lo ejecuta de forma fiable. */}
        <ElevenLabsWidget />
      </body>
    </html>
  );
}
