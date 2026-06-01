import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Paleta oficial extraída del Manual de Marca (brand/MANUAL_DE_MARCA.pdf,
        // páginas "PALETA DE COLOR" y "MANEJO DE LOGO"). Verde y blanco son las
        // únicas variantes permitidas del logo (verde sobre claro, blanco sobre
        // verde/oscuro). Los grises son secundarios — nunca más prominentes que
        // el verde. El dorado NO existe en el Manual: `gold` es una propuesta
        // nuestra para acentos de premios destacados (ver [CONFIRMAR_DORADO_OFICIAL]).
        gp: {
          green: "#00783E",       // Verde principal — RGB 0,120,62
          "green-core": "#008745", // Centro del gradiente de marca (AGENTS.md §2.2)
          "green-deep": "#034419", // Verde oscuro — RGB 3,68,20
          white: "#FFFFFF",
          "gray-dark-1": "#6D6E71",
          "gray-dark-2": "#333333",
          "gray-light": "#A7A9AC",
          // [CONFIRMAR_DORADO_OFICIAL] — propuesta del líder para acentos.
          // El Manual define un "gradiente dorado libre" pero no un HEX puntual.
          gold: "#D4A017",
        },
      },
      backgroundImage: {
        // Gradiente de marca: el Manual lo define como "no lineal".
        // Aproximamos con radial que enfatiza verde principal en el centro y
        // baja a verde oscuro hacia los bordes.
        "gp-radial":
          "radial-gradient(circle at 50% 45%, #00783E 0%, #034419 100%)",
        // Gradiente dorado libre (referencia al Manual). Útil para acentos de
        // premios destacados / CTA secundarios.
        "gp-gold-gradient":
          "linear-gradient(135deg, #B8860B 0%, #D4A017 50%, #F4D03F 100%)",
      },
      fontFamily: {
        // [CONFIRMAR_TIPOGRAFIA_OFICIAL] — el Manual especifica Stage Grotesk
        // (titulares + cuerpo) y Qartella (decorativa). Ambas son comerciales.
        // Hasta tener licencia, usamos near-matches gratuitas vía Google Fonts:
        // DM Sans ≈ Stage Grotesk, Fraunces ≈ Qartella.
        sans: ["var(--font-gp-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-gp-display)", "Georgia", "serif"],
      },
      keyframes: {
        "envelope-breathe": {
          "0%, 100%": { transform: "translateY(0) scale(1)", filter: "brightness(1)" },
          "50%": { transform: "translateY(-6px) scale(1.02)", filter: "brightness(1.08)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "page-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "notif-flash": {
          "0%": { opacity: "0", transform: "scale(0.7) translateY(-10px)" },
          "50%": { opacity: "1", transform: "scale(1.1) translateY(0)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "card-pop": {
          "0%": { opacity: "0", transform: "translateY(-80px) scale(0.7)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "cta-appear": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "rarity-glow": {
          "0%,100%": { opacity: "0.85" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "envelope-breathe": "envelope-breathe 6s cubic-bezier(0.4,0,0.6,1) infinite",
        shimmer: "shimmer 3s linear infinite",
        "page-in": "page-in 240ms cubic-bezier(0.22,1,0.36,1) both",
        "notif-flash": "notif-flash 700ms ease-out both",
        "card-pop": "card-pop 700ms cubic-bezier(0.34,1.56,0.64,1) both",
        "cta-appear": "cta-appear 500ms ease-out both",
        "rarity-glow": "rarity-glow 2.4s ease-in-out infinite",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0,0,0,0.37)",
        "gold-glow": "0 10px 30px -10px rgba(212,160,23,0.45)",
      },
    },
  },
  plugins: [],
};

export default config;
