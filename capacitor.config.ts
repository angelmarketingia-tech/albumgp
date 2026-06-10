import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor wrapper config for the iOS/Android store builds.
//
// IMPORTANT — server-driven, NOT static export. This Next.js app uses server
// routes (Prisma, SSO, Redis rate-limiting) and CANNOT be `output: 'export'`-ed.
// So the native shell does NOT bundle a static webDir; instead it loads the
// LIVE deployed app from `server.url`. This is the supported pattern for
// server-rendered Next apps wrapped in Capacitor.
//
// Dominio de producción: albumgp.vercel.app (la web debe estar desplegada en
// HTTPS ahí antes de que la app nativa funcione). Cuando el dominio propio
// (album2026.ganaplay.lat) tenga el DNS configurado y resolviendo, cambiá
// PROD_URL de vuelta y re-corré `npm run cap:sync`. Override con CAP_SERVER_URL
// para staging/pruebas:
//   CAP_SERVER_URL=https://staging.album.ganaplay.lat npx cap sync
//
// `webDir` apunta a una carpeta real para el tooling de `cap`; servimos un shell
// mínimo `native/www` (redirect/splash) usado solo si server.url no estuviera
// seteado. Ver STORE_RELEASE.md para el flujo completo.

const PROD_URL = "https://albumgp.vercel.app";
const serverUrl = process.env.CAP_SERVER_URL ?? PROD_URL;

const config: CapacitorConfig = {
  appId: "com.ganaplay.album",
  appName: "GanaPlay Álbum",
  webDir: "native/www",
  // Brand-green background behind the webview while it loads.
  backgroundColor: "#034419",
  server: {
    url: serverUrl,
    // HTTPS only — la app maneja canje + redirecciones; nunca cleartext.
    cleartext: false,
    // Hosts que se navegan DENTRO del WebView. La app vive en ganaplay.lat y el
    // canje redirige al login oficial en ganaplay.sv/gt — los incluimos para que
    // el flujo SSO no expulse al usuario a un navegador externo a mitad de canje.
    // Cualquier otro host se abre fuera (comportamiento por defecto de Capacitor).
    allowNavigation: [
      "albumgp.vercel.app",
      "*.vercel.app",
      "album2026.ganaplay.lat",
      "*.ganaplay.lat",
      "ganaplay.sv",
      "*.ganaplay.sv",
      "ganaplay.gt",
      "*.ganaplay.gt",
    ],
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#034419",
  },
  android: {
    backgroundColor: "#034419",
    // Allow the in-app browser tab for the external SSO/deposit redirects.
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#034419",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
  },
};

export default config;
