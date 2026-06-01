import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor wrapper config for the iOS/Android store builds.
//
// IMPORTANT — server-driven, NOT static export. This Next.js app uses server
// routes (Prisma, SSO, Redis rate-limiting) and CANNOT be `output: 'export'`-ed.
// So the native shell does NOT bundle a static webDir; instead it loads the
// LIVE deployed app from `server.url`. This is the supported pattern for
// server-rendered Next apps wrapped in Capacitor.
//
// Set CAP_SERVER_URL to your production HTTPS origin at build time, e.g.
//   CAP_SERVER_URL=https://album.ganaplay.com npx cap sync
//
// `webDir` still must point at a real folder for `cap` tooling; we ship a
// minimal `native/www` shell (a redirect/splash) used only if server.url is
// ever unset. See STORE_RELEASE.md for the full flow.

const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.ganaplay.album",
  appName: "GanaPlay Álbum",
  webDir: "native/www",
  // Brand-green background behind the webview while it loads.
  backgroundColor: "#034419",
  server: serverUrl
    ? {
        url: serverUrl,
        // HTTPS only — the app handles auth + redemption; never allow cleartext.
        cleartext: false,
      }
    : undefined,
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
