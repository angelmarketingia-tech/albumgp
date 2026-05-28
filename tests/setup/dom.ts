// DOM-side test setup. Loaded by Vitest for every test file (no cost in
// node-env tests beyond importing jest-dom matchers, which only register
// when `expect` is available). The `environmentMatchGlobs` rule in
// `vitest.config.ts` ensures `tests/components/**` runs under `jsdom`.

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "@testing-library/jest-dom/vitest";

// React Testing Library doesn't auto-cleanup under Vitest the way it
// does under Jest; without this hook each `render()` leaks DOM nodes
// from previous `it()` blocks and `getBy*` queries find duplicates.
afterEach(() => {
  cleanup();
});
