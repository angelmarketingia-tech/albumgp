import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Official brand palette (see AGENTS.md §2.2).
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
