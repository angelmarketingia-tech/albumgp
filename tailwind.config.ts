import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // PLACEHOLDER: aproximacion del logo. Confirmar con
        // [CONFIRMAR_HEX_OFICIALES] del Manual de Marca
        // (brand/MANUAL_DE_MARCA.pdf, ver brand/README.md).
        gp: {
          "green-core": "#008745",
          green: "#01783E",
          "green-deep": "#00602F",
          white: "#FFFFFF",
          gold: "#FFD600",
        },
      },
      backgroundImage: {
        "gp-radial":
          "radial-gradient(circle at 50% 45%, #008745 0%, #01783E 70%, #00602F 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
