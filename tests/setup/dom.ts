// DOM-side test setup. Loaded by Vitest for every test file (no cost in
// node-env tests beyond importing jest-dom matchers, which only register
// when `expect` is available). The `environmentMatchGlobs` rule in
// `vitest.config.ts` ensures `tests/components/**` runs under `jsdom`.

import "@testing-library/jest-dom/vitest";
