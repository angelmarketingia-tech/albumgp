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
    // Component tests live under tests/components/** and need a DOM, while
    // every other test (route handlers, libs, schemas) runs in plain Node.
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    environment: "node",
    environmentMatchGlobs: [["tests/components/**", "jsdom"]],
    setupFiles: ["tests/setup/dom.ts"],
    globals: false,
  },
});
