// QA — shared mocking helpers for tests/pages/*.
//
// Used by `tests/pages/entry.test.tsx`, `tests/pages/canjear-form.test.tsx`
// (and any future client-form test) to construct typed `fetch` mocks without
// having to retype the `Response` shape every test.
//
// Why this file lives under tests/setup/: it is NOT a vitest setup file
// (it is never auto-loaded). It is a co-located helper that page tests
// import explicitly. Keeping it here avoids polluting `tests/setup/dom.ts`,
// which IS auto-loaded for every DOM test.

import { vi } from "vitest";

/**
 * Build a `fetch`-compatible mock that resolves once with the given
 * status + JSON body. The returned function has the same signature as
 * the global `fetch` so it can be assigned to `global.fetch` safely.
 *
 * The body argument is `unknown` because callers may pass any JSON-able
 * value; the test author controls the shape.
 */
export function mockFetchResponse(
  status: number,
  body: unknown,
): typeof fetch {
  const fn = vi.fn(async (): Promise<Response> => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  return fn as unknown as typeof fetch;
}

/**
 * Build a `fetch`-compatible mock that rejects with an Error. Used to
 * simulate network failures (DNS, offline, etc.).
 */
export function mockFetchError(message = "network error"): typeof fetch {
  const fn = vi.fn(async (): Promise<Response> => {
    throw new Error(message);
  });
  return fn as unknown as typeof fetch;
}

/**
 * Sequenced fetch mock: each call returns the next entry in `responses`
 * (status + body). Useful when a single user action triggers more than
 * one request, or when asserting "first attempt fails, retry succeeds".
 *
 * If `fetch` is called more times than entries provided, the last entry
 * is reused (test author should explicitly assert call count).
 */
export function mockFetchSequence(
  responses: ReadonlyArray<{ status: number; body: unknown }>,
): typeof fetch {
  let i = 0;
  const fn = vi.fn(async (): Promise<Response> => {
    const idx = Math.min(i, responses.length - 1);
    i += 1;
    const entry = responses[idx];
    if (entry === undefined) {
      throw new Error("mockFetchSequence: empty responses");
    }
    return new Response(JSON.stringify(entry.body), {
      status: entry.status,
      headers: { "content-type": "application/json" },
    });
  });
  return fn as unknown as typeof fetch;
}
