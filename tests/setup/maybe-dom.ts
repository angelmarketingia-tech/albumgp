// Conditional setup file. We register a single Vitest setup file but
// only pull in the DOM-side helpers (jest-dom, RTL cleanup) when the
// active environment provides a `window` — i.e. jsdom. Under node the
// import would error out trying to access browser-only APIs.

if (typeof window !== "undefined") {
  await import("./dom");
}

export {};
