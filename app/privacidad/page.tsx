// Privacy policy — /privacidad.
//
// REQUIRED for App Store + Play Store submission (both mandate a reachable
// privacy policy URL, especially for gambling-adjacent / 18+ apps). Also wired
// into manifest + every page footer.
//
// ⚠️ LEGAL REVIEW REQUIRED (AGENTS.md §12): this is a TEMPLATE describing the
// app's ACTUAL data handling as built. The owner's legal counsel must review,
// localize for El Salvador 🇸🇻 / Guatemala 🇬🇹 gaming + data regulation, and
// confirm the controller entity, contact, and retention periods before launch.

import type { Metadata } from "next";
import { LegalShell } from "@/components/legal/LegalShell";
import { BRAND_NAME } from "@/lib/brand/constants";

export const metadata: Metadata = {
  title: "Política de Privacidad — GanaPlay Álbum",
  description:
    "Cómo GanaPlay Álbum recopila, usa y protege tus datos al canjear códigos.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Política de Privacidad" updated="1 de junio de 2026">
      <p>
        Esta Política describe cómo {BRAND_NAME} trata los datos cuando usás la
        aplicación <strong>GanaPlay Álbum</strong> (la &ldquo;App&rdquo;) para
        canjear códigos y ver tu colección. Al usar la App, aceptás las
        prácticas aquí descritas.
      </p>
      <p>
        <strong>Solo para mayores de 18 años.</strong> La App está destinada
        exclusivamente a personas mayores de edad. No recopilamos
        intencionalmente datos de menores.
      </p>

      <h2>1. Qué datos tratamos</h2>
      <ul>
        <li>
          <strong>Código de canje:</strong> el código que ingresás. Se almacena
          asociado a su estado (activo / canjeado) y nunca se publica.
        </li>
        <li>
          <strong>Identificador de cuenta:</strong> al iniciar sesión vía la
          plataforma GanaPlay para canjear, recibimos un identificador opaco de
          tu cuenta para acreditar los premios. No almacenamos tu contraseña.
        </li>
        <li>
          <strong>Dirección IP:</strong> se procesa de forma transitoria para
          limitar abusos (rate-limiting) y se registra junto al canje con fines
          de auditoría y prevención de fraude.
        </li>
        <li>
          <strong>Datos técnicos:</strong> tipo de navegador/dispositivo
          (user-agent) e idioma, usados para seguridad y compatibilidad.
        </li>
      </ul>
      <p>
        No vendemos tus datos. No usamos cookies de publicidad de terceros ni
        rastreadores de marketing dentro de la App.
      </p>

      <h2>2. Para qué los usamos</h2>
      <ul>
        <li>Validar códigos y entregar los premios correspondientes.</li>
        <li>Prevenir fraude, abuso y uso múltiple de un mismo código.</li>
        <li>Mantener una auditoría de cada canje (requerido por normativa de juego).</li>
        <li>Operar, asegurar y mejorar la App.</li>
      </ul>

      <h2>3. Con quién los compartimos</h2>
      <p>
        Compartimos el resultado de un canje con la plataforma central de{" "}
        {BRAND_NAME} para acreditar tus premios. También podemos usar
        proveedores de infraestructura (hosting, base de datos, caché) que
        procesan datos por cuenta nuestra bajo acuerdos de confidencialidad.
        Podemos divulgar datos si la ley lo exige.
      </p>

      <h2>4. Conservación</h2>
      <p>
        Conservamos los registros de canje el tiempo necesario para cumplir
        obligaciones legales, contables y de prevención de fraude.{" "}
        <strong>[CONFIRMAR_RETENCION]</strong> — el período exacto lo define el
        responsable conforme a la normativa aplicable de SV/GT.
      </p>

      <h2>5. Tus derechos</h2>
      <p>
        Según tu jurisdicción, podés tener derecho a acceder, rectificar o
        solicitar la eliminación de tus datos, sujeto a las obligaciones legales
        de conservación. Para ejercerlos, contactá al responsable (ver abajo).
      </p>

      <h2>6. Seguridad</h2>
      <p>
        Aplicamos medidas técnicas y organizativas (cifrado en tránsito,
        cabeceras de seguridad, control de acceso, minimización de datos) para
        proteger la información. Ningún sistema es 100% infalible, pero
        trabajamos para mantener un estándar alto.
      </p>

      <h2>7. Contacto</h2>
      <p>
        Responsable del tratamiento: <strong>[CONFIRMAR_ENTIDAD_LEGAL]</strong>.
        Consultas de privacidad:{" "}
        <a href="mailto:privacidad@ganaplay.com">privacidad@ganaplay.com</a>{" "}
        <strong>[CONFIRMAR_EMAIL_PRIVACIDAD]</strong>.
      </p>

      <h2>8. Cambios</h2>
      <p>
        Podemos actualizar esta Política. Publicaremos la versión vigente en esta
        página con su fecha de actualización.
      </p>
    </LegalShell>
  );
}
