import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  esbuild: {
    // Component tests use JSX; Next's tsconfig sets `jsx: preserve`, so
    // Vitest needs an explicit transform. `automatic` matches React 17+
    // and lets test files use JSX without importing React.
    jsx: "automatic",
  },
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
    environmentMatchGlobs: [
      ["tests/components/**", "jsdom"],
      ["tests/pages/**", "jsdom"],
    ],
    // Only apply the DOM setup to component tests — node-env tests have
    // no DOM and don't need RTL cleanup or jest-dom matchers.
    setupFiles: ["tests/setup/maybe-dom.ts"],
    globals: false,
  },
});
