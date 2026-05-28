import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="es">
      <body className="min-h-screen bg-gp-radial">{children}</body>
    </html>
  );
}
