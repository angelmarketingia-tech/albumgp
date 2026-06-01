// PWA Web App Manifest — served at /manifest.webmanifest by Next 14's
// metadata API. Required for "Add to Home Screen" and as the base config
// the Capacitor wrappers (iOS/Android) read for name/theme/icons.
//
// AGENTS.md §8 (mobile-first, high-traffic) + store readiness.
//
// ICONS: references PWA icon sizes the owner must drop into /public/icons/.
// Until final art lands, /icon-192.png and /icon-512.png are derived from the
// white logo on the brand green. `purpose: "maskable"` variants are REQUIRED
// by Play Store / Android adaptive icons — keep a safe-zone padded version.

import type { MetadataRoute } from "next";

// Brand green (#00783E) per brand/README.md — official palette, NOT the
// AGENTS.md §2 placeholder. Matches tailwind `gp.green` + bg-gp-radial center.
const BRAND_GREEN = "#00783E";
const BRAND_GREEN_DEEP = "#034419";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GanaPlay Álbum",
    short_name: "GanaPlay",
    description: "Abrí tu sobre, revelá tus premios y armá tu colección GanaPlay.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BRAND_GREEN_DEEP,
    theme_color: BRAND_GREEN,
    lang: "es",
    dir: "ltr",
    categories: ["entertainment", "games", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
