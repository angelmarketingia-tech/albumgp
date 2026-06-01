// Terms of Service — /terminos.
//
// REQUIRED for store submission alongside the privacy policy. Linked from the
// footer of every page and from the manifest.
//
// ⚠️ LEGAL REVIEW REQUIRED (AGENTS.md §12): TEMPLATE describing the product as
// built. Counsel must review and localize for El Salvador 🇸🇻 / Guatemala 🇬🇹
// gaming regulation (promotions, prize liability, dispute resolution, governing
// law) before launch.

import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { BRAND_NAME } from "@/lib/brand/constants";

export const metadata: Metadata = {
  title: "Términos y Condiciones — GanaPlay Álbum",
  description:
    "Términos de uso de la promoción GanaPlay Álbum: canje de códigos y premios.",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalShell title="Términos y Condiciones" updated="1 de junio de 2026">
      <p>
        Estos Términos rigen tu uso de <strong>GanaPlay Álbum</strong> (la
        &ldquo;App&rdquo;), una promoción de {BRAND_NAME}. Al ingresar un código
        o canjear premios, aceptás estos Términos.
      </p>

      <h2>1. Elegibilidad</h2>
      <p>
        Debés ser <strong>mayor de 18 años</strong> y residente de un país donde{" "}
        {BRAND_NAME} opere legalmente (El Salvador o Guatemala). La participación
        está sujeta a la verificación de tu cuenta en la plataforma {BRAND_NAME}.
      </p>

      <h2>2. Cómo funciona</h2>
      <ul>
        <li>
          Ingresás un <strong>código de un solo uso</strong> entregado por{" "}
          {BRAND_NAME}.
        </li>
        <li>
          Abrís el sobre y ves los premios. Abrir <em>no</em> acredita nada.
        </li>
        <li>
          Para acreditar los premios iniciás sesión con tu cuenta {BRAND_NAME}.
          El canje es definitivo y <strong>cada código se usa una sola vez</strong>.
        </li>
      </ul>

      <h2>3. Premios</h2>
      <p>
        Los premios (bonos, giros, créditos para pronosticar y coleccionables)
        están sujetos a disponibilidad y a las{" "}
        <strong>condiciones de la plataforma {BRAND_NAME}</strong> (requisitos de
        apuesta, vigencia, etc.). Los premios no son transferibles ni canjeables
        por dinero salvo que se indique expresamente.{" "}
        <strong>[CONFIRMAR_TEXTO_LEGAL]</strong> — la redacción exacta de cada
        premio queda sujeta a revisión legal y de marketing.
      </p>

      <h2>4. Conducta y abuso</h2>
      <p>
        Está prohibido intentar adivinar, generar o automatizar el ingreso de
        códigos, eludir los límites de uso, o interferir con la seguridad de la
        App. {BRAND_NAME} puede invalidar códigos, suspender cuentas y anular
        premios obtenidos de forma fraudulenta.
      </p>

      <h2>5. Juego responsable</h2>
      <p>
        Jugá responsablemente. Si sentís que el juego deja de ser entretenimiento,
        buscá ayuda. {BRAND_NAME} promueve límites y herramientas de autocontrol
        en su plataforma.
      </p>

      <h2>6. Disponibilidad y cambios</h2>
      <p>
        La App se ofrece &ldquo;tal cual&rdquo;. Podemos modificar, suspender o
        finalizar la promoción en cualquier momento conforme a la ley aplicable y
        a las bases de la promoción.
      </p>

      <h2>7. Responsabilidad</h2>
      <p>
        En la medida permitida por la ley, {BRAND_NAME} no será responsable por
        daños indirectos derivados del uso de la App. Nada en estos Términos
        limita derechos que no puedan limitarse legalmente.
      </p>

      <h2>8. Ley aplicable</h2>
      <p>
        Estos Términos se rigen por las leyes del país de residencia del usuario
        (El Salvador o Guatemala) según corresponda.{" "}
        <strong>[CONFIRMAR_JURISDICCION]</strong>.
      </p>

      <h2>9. Contacto</h2>
      <p>
        Consultas:{" "}
        <a href="mailto:soporte@ganaplay.com">soporte@ganaplay.com</a>{" "}
        <strong>[CONFIRMAR_EMAIL_SOPORTE]</strong>.
      </p>
    </LegalShell>
  );
}
