import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="es" className={`${dmSans.variable} ${fraunces.variable}`}>
      <body className="min-h-screen relative overflow-x-hidden bg-gp-radial font-sans text-gp-white antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:bg-gp-gold focus:px-4 focus:py-2 focus:font-bold focus:text-gp-green-deep focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white">Saltar al contenido</a>
        <div aria-hidden className="pointer-events-none fixed -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-emerald-400/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none fixed -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-gp-gold/10 blur-3xl" />
        {children}
      </body>
    </html>
  );
}
