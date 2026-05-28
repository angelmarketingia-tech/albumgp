import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

// PLACEHOLDER: Poppins hasta confirmar [CONFIRMAR_TIPOGRAFIA_OFICIAL] del
// Manual de Marca (brand/MANUAL_DE_MARCA.pdf). Es el match mas cercano al
// tagline "Pronosticos deportivos" del logo principal: sans serif
// redondeada, geometrica, peso fuerte.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-gp-sans",
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
    <html lang="es" className={poppins.variable}>
      <body
        className="min-h-screen bg-gp-radial"
        style={{ fontFamily: "var(--font-gp-sans), system-ui, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
