"use client";

// Asistente de voz ElevenLabs ConvAI.
//
// Por qué un client component con inyección manual del <script> (y no
// next/script ni un <script> en el JSX server):
//   - El embed de ElevenLabs hace `customElements.define('elevenlabs-convai', …)`
//     al ejecutarse. next/script con afterInteractive a veces NO dispara la
//     ejecución de scripts de terceros que registran custom elements (quedaba
//     solo como <link rel=preload as=script>), así que el widget nunca montaba.
//   - Inyectamos el <script async> en el <body> tal cual lo documenta
//     ElevenLabs, una sola vez, y agregamos el <elevenlabs-convai> al DOM.
//
// La CSP (lib/security/headers.ts + next.config.mjs) habilita unpkg, jsdelivr,
// *.elevenlabs.io, openfpcdn/fpjs, fonts.googleapis/gstatic y storage.googleapis,
// más worker-src blob: y microphone=(self).

import { useEffect } from "react";

const AGENT_ID = "agent_4201kt5bb5hveac8406zc2m9yfpt";
const EMBED_SRC = "https://unpkg.com/@elevenlabs/convai-widget-embed";

export function ElevenLabsWidget(): null {
  useEffect(() => {
    // 1. Asegurar que el custom element exista en el DOM (una sola instancia).
    if (!document.querySelector("elevenlabs-convai")) {
      const el = document.createElement("elevenlabs-convai");
      el.setAttribute("agent-id", AGENT_ID);
      document.body.appendChild(el);
    }

    // 2. Cargar el script del embed una sola vez.
    const already = document.querySelector(
      `script[src="${EMBED_SRC}"]`,
    );
    if (!already) {
      const s = document.createElement("script");
      s.src = EMBED_SRC;
      s.async = true;
      s.type = "text/javascript";
      document.body.appendChild(s);
    }
  }, []);

  return null;
}
