import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Mirror the `@/*` path alias from tsconfig.json so route handlers that
    // use `@/lib/...` imports load correctly under Vitest.
    alias: {
      "@": here,
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
