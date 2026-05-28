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
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-gp-sans",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  display: "swap",
  variable: "--font-gp-display",
});

export const metadata: Metadata = {
  title: "GanaPlay Álbum",
  description: "Canje de códigos y álbum de premios GanaPlay.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="es" className={`${dmSans.variable} ${fraunces.variable}`}>
      <body className="min-h-screen bg-gp-radial font-sans text-gp-white">
        {children}
      </body>
    </html>
  );
}
