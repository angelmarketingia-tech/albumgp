// QA — E2E tests for the EntryForm client component (app/(entry)/EntryForm.tsx).
//
// We don't render the server `EntryPage` shell here (that's a smoke test in
// `page-render-smoke.test.tsx`). This file targets the *form* — the only
// piece with real client-side behavior: code validation, fetch, redirect.
//
// Mocking strategy:
//   - `next/navigation` → `useRouter` returns a stable `{ push }` spy so we
//     can assert redirects WITHOUT actually navigating jsdom.
//   - `global.fetch` → swapped per-test via the helpers in
//     `tests/setup/page-utils.tsx`. The form only ever calls `/api/open`.
//   - We do NOT mock `CodeInput`, `ActionButton`, or `normalizeCode` — the
//     point of an E2E test is to exercise the real composition.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EntryForm } from "@/app/(entry)/EntryForm";
import {
  mockFetchError,
  mockFetchResponse,
} from "@/tests/setup/page-utils";

// --- next/navigation mock ----------------------------------------------------

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: (): { push: ReturnType<typeof vi.fn> } => ({ push: pushMock }),
}));

// --- Test helpers ------------------------------------------------------------

const VALID_CODE = "ABCDEFGHJKLMNPQR";

function typeCode(value: string): void {
  const input = screen.getByLabelText(/código de canje/i) as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
}

function clickSubmit(): void {
  // Use the submit button (the form's only submit). Other buttons may
  // exist in the wider EntryPage shell but here we only render EntryForm.
  const btn = screen.getByRole("button", { name: /abrir sobre|abriendo/i });
  fireEvent.click(btn);
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const originalFetch = global.fetch;

beforeEach(() => {
  pushMock.mockReset();
});

afterEach(() => {
  global.fetch = originalFetch;
});

// =============================================================================

describe("EntryForm — initial render", () => {
  it("renders the code input and the 'Abrir sobre' submit button", () => {
    render(<EntryForm />);
    expect(screen.getByLabelText(/código de canje/i)).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /abrir sobre/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("type", "submit");
  });

  it("does not show an error message before any submit", () => {
    render(<EntryForm />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("EntryForm — client-side validation", () => {
  it("typing too few chars + submit → does NOT call fetch, shows generic error", async () => {
    const fetchMock = mockFetchResponse(200, { pack: {}, country: "SV" });
    global.fetch = fetchMock;

    render(<EntryForm />);
    typeCode("ABCD"); // 4 chars — fails the strict 16-char regex.
    clickSubmit();

    expect(fetchMock).not.toHaveBeenCalled();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/código inválido o no disponible/i);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("typing only forbidden chars (I/O/0/1) + submit → no fetch, error shown", async () => {
    // CodeInput strips these char-by-char, so the effective value the form
    // sees is "" → normalizeCode("") === null → error state, no fetch.
    const fetchMock = mockFetchResponse(200, { pack: {}, country: "SV" });
    global.fetch = fetchMock;

    render(<EntryForm />);
    typeCode("IIIIIIIIIIIIIIII");
    clickSubmit();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("empty input + submit → no fetch, error shown", async () => {
    const fetchMock = mockFetchResponse(200, { pack: {}, country: "SV" });
    global.fetch = fetchMock;

    render(<EntryForm />);
    clickSubmit();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

describe("EntryForm — happy path", () => {
  it("valid code → fetch posts JSON { code } to /api/open", async () => {
    const fetchMock = mockFetchResponse(200, { pack: {}, country: "SV" });
    global.fetch = fetchMock;

    render(<EntryForm />);
    typeCode(VALID_CODE);
    clickSubmit();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe("/api/open");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ code: VALID_CODE });
  });

  it("on 200 → router.push('/sobre/<code>') is invoked", async () => {
    global.fetch = mockFetchResponse(200, { pack: {}, country: "SV" });

    render(<EntryForm />);
    typeCode(VALID_CODE);
    clickSubmit();

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledTimes(1);
    });
    expect(pushMock).toHaveBeenCalledWith(
      `/sobre/${encodeURIComponent(VALID_CODE)}`,
    );
  });

  it("submits the normalized (uppercase, trimmed) code even when input has whitespace", async () => {
    // CodeInput already strips whitespace char-by-char, so the input value
    // is always pre-normalized. We confirm the network payload matches the
    // normalized form, not whatever the user "typed".
    const fetchMock = mockFetchResponse(200, { pack: {}, country: "SV" });
    global.fetch = fetchMock;

    render(<EntryForm />);
    // Simulate paste with surrounding spaces + lowercase.
    typeCode(`  ${VALID_CODE.toLowerCase()}  `);
    clickSubmit();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ code: VALID_CODE });
  });
});

describe("EntryForm — error responses", () => {
  it("on 404 → shows generic error, does NOT redirect", async () => {
    global.fetch = mockFetchResponse(404, {
      error: "not_found_or_unavailable",
    });

    render(<EntryForm />);
    typeCode(VALID_CODE);
    clickSubmit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/código inválido o no disponible/i);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("on 429 → shows generic error, does NOT redirect", async () => {
    global.fetch = mockFetchResponse(429, { error: "rate_limited" });

    render(<EntryForm />);
    typeCode(VALID_CODE);
    clickSubmit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/código inválido o no disponible/i);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("on 500 → shows generic error, does NOT redirect", async () => {
    global.fetch = mockFetchResponse(500, { error: "internal" });

    render(<EntryForm />);
    typeCode(VALID_CODE);
    clickSubmit();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("fetch throws (network failure) → shows generic error", async () => {
    global.fetch = mockFetchError("offline");

    render(<EntryForm />);
    typeCode(VALID_CODE);
    clickSubmit();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("the generic error never leaks server detail (no 'expired', no 'redeemed', etc.)", async () => {
    // SECURITY.md §2 — the form must surface the same message regardless of
    // the actual server reason. We try several plausible "leaky" payloads.
    for (const body of [
      { error: "expired" },
      { error: "redeemed" },
      { error: "disabled" },
      { error: "not_found_or_unavailable", detail: "secret leak" },
    ]) {
      global.fetch = mockFetchResponse(404, body);

      const { unmount } = render(<EntryForm />);
      typeCode(VALID_CODE);
      clickSubmit();

      const alert = await screen.findByRole("alert");
      const text = alert.textContent ?? "";
      expect(text).not.toMatch(/expired/i);
      expect(text).not.toMatch(/redeemed/i);
      expect(text).not.toMatch(/disabled/i);
      expect(text).not.toMatch(/secret leak/i);
      unmount();
    }
  });
});

describe("EntryForm — loading + recovery", () => {
  it("while fetching, the submit button is disabled (aria-busy)", async () => {
    // Construct a fetch that never resolves so we can observe the in-flight state.
    const deferred = createDeferred<Response>();
    const fetchMock = vi.fn(() => deferred.promise);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<EntryForm />);
    typeCode(VALID_CODE);
    clickSubmit();

    const btn = await screen.findByRole("button", {
      name: /abriendo|abrir sobre/i,
    });
    await waitFor(() => {
      expect(btn).toBeDisabled();
    });
    expect(btn).toHaveAttribute("aria-busy", "true");

    // Resolve so the test exits cleanly.
    deferred.resolve(
      new Response(JSON.stringify({ pack: {}, country: "SV" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });

  it("after an error, typing in the input clears the error message", async () => {
    global.fetch = mockFetchResponse(404, {
      error: "not_found_or_unavailable",
    });

    render(<EntryForm />);
    typeCode(VALID_CODE);
    clickSubmit();
    await screen.findByRole("alert");

    // Now type something else — the EntryForm clears state to "idle".
    typeCode("ABCD");
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
