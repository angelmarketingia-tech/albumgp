// QA — E2E tests for the RedeemForm client component
// (app/canjear/RedeemForm.tsx).
//
// The server `CanjearPage` does the auth gate via `auth()`. We do NOT
// re-test that here — `tests/auth-require.test.ts` already covers the
// auth helper. This file targets the client form, which is concerned
// only with the POST /api/redeem round-trip and the post-success
// redirect.
//
// Mocking strategy mirrors `entry.test.tsx`:
//   - `next/navigation` → `useRouter` returns spies for `push` and `back`.
//   - `global.fetch` → swapped per-test via tests/setup/page-utils helpers.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RedeemForm } from "@/app/canjear/RedeemForm";
import {
  mockFetchError,
  mockFetchResponse,
} from "@/tests/setup/page-utils";

// --- next/navigation mock ----------------------------------------------------

const pushMock = vi.fn();
const backMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: (): {
    push: ReturnType<typeof vi.fn>;
    back: ReturnType<typeof vi.fn>;
  } => ({ push: pushMock, back: backMock }),
}));

// --- helpers -----------------------------------------------------------------

const VALID_CODE = "ABCDEFGHJKLMNPQR";

function clickConfirm(): void {
  fireEvent.click(
    screen.getByRole("button", { name: /confirmar canje|canjeando/i }),
  );
}

function clickCancel(): void {
  fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
}

const originalFetch = global.fetch;

beforeEach(() => {
  pushMock.mockReset();
  backMock.mockReset();
});

afterEach(() => {
  global.fetch = originalFetch;
});

// =============================================================================

describe("RedeemForm — initial render", () => {
  it("renders the 'Confirmar canje' and 'Cancelar' buttons", () => {
    render(<RedeemForm code={VALID_CODE} />);
    expect(
      screen.getByRole("button", { name: /confirmar canje/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /cancelar/i }),
    ).toBeInTheDocument();
  });

  it("does not show an error before any action", () => {
    render(<RedeemForm code={VALID_CODE} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("RedeemForm — cancel", () => {
  it("'Cancelar' calls router.back() and does NOT call fetch", () => {
    const fetchMock = mockFetchResponse(200, { status: "redeemed" });
    global.fetch = fetchMock;

    render(<RedeemForm code={VALID_CODE} />);
    clickCancel();

    expect(backMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe("RedeemForm — confirm happy path", () => {
  it("'Confirmar canje' POSTs { code } to /api/redeem", async () => {
    const fetchMock = mockFetchResponse(200, {
      status: "redeemed",
      prizes: {},
      country: "SV",
    });
    global.fetch = fetchMock;

    render(<RedeemForm code={VALID_CODE} />);
    clickConfirm();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe("/api/redeem");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ code: VALID_CODE });
  });

  it("on 200 → router.push('/album?just_redeemed=1') is invoked", async () => {
    global.fetch = mockFetchResponse(200, { status: "redeemed" });

    render(<RedeemForm code={VALID_CODE} />);
    clickConfirm();

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledTimes(1);
    });
    expect(pushMock).toHaveBeenCalledWith("/album?just_redeemed=1");
  });
});

describe("RedeemForm — error responses", () => {
  // The current implementation surfaces a single generic message on ANY
  // non-2xx response (SECURITY.md §2). We assert that for each status the
  // form:
  //   - shows the generic alert.
  //   - does NOT redirect.
  //   - does NOT swallow the error silently.

  const cases: ReadonlyArray<{ name: string; status: number; body: unknown }> =
    [
      { name: "401 unauthorized", status: 401, body: { error: "unauthorized" } },
      {
        name: "404 not_found_or_unavailable",
        status: 404,
        body: { error: "not_found_or_unavailable" },
      },
      {
        name: "409 already redeemed",
        status: 409,
        body: { error: "conflict" },
      },
      { name: "429 rate_limited", status: 429, body: { error: "rate_limited" } },
      { name: "500 internal", status: 500, body: { error: "internal" } },
    ];

  for (const c of cases) {
    it(`on ${c.name} → shows generic error, no push, no back`, async () => {
      global.fetch = mockFetchResponse(c.status, c.body);

      render(<RedeemForm code={VALID_CODE} />);
      clickConfirm();

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(
        /no pudimos canjear este código|probá nuevamente/i,
      );
      expect(pushMock).not.toHaveBeenCalled();
      expect(backMock).not.toHaveBeenCalled();
    });
  }

  // QA observation (not a bug, design choice): the form does NOT redirect
  // to /auth/signin on 401. The current contract is that the page-level
  // server component (CanjearPage) already enforced auth, so a 401 here
  // is treated as just-another-failure. If product wants a soft re-auth
  // we'd need a code change. Reported in the QA summary.

  it("fetch throws (network) → shows generic error", async () => {
    global.fetch = mockFetchError("offline");

    render(<RedeemForm code={VALID_CODE} />);
    clickConfirm();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("the generic error never leaks server detail", async () => {
    global.fetch = mockFetchResponse(404, {
      error: "expired",
      detail: "the code expired at 2024-01-01",
    });

    render(<RedeemForm code={VALID_CODE} />);
    clickConfirm();

    const alert = await screen.findByRole("alert");
    const text = alert.textContent ?? "";
    expect(text).not.toMatch(/expired/i);
    expect(text).not.toMatch(/2024-01-01/);
  });
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("RedeemForm — loading state", () => {
  it("while fetching, both buttons are disabled", async () => {
    const deferred = createDeferred<Response>();
    global.fetch = vi.fn(() => deferred.promise) as unknown as typeof fetch;

    render(<RedeemForm code={VALID_CODE} />);
    clickConfirm();

    const confirmBtn = await screen.findByRole("button", {
      name: /canjeando|confirmar canje/i,
    });
    const cancelBtn = screen.getByRole("button", { name: /cancelar/i });

    await waitFor(() => {
      expect(confirmBtn).toBeDisabled();
    });
    expect(cancelBtn).toBeDisabled();

    deferred.resolve(
      new Response(JSON.stringify({ status: "redeemed" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  });

  it("clicking confirm twice in flight only POSTs once", async () => {
    const deferred = createDeferred<Response>();
    const fetchMock = vi.fn(() => deferred.promise);
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<RedeemForm code={VALID_CODE} />);
    clickConfirm();
    clickConfirm();

    // disabled prevents the second click from firing the handler,
    // and the in-handler `if (status === 'submitting') return` is a
    // belt-and-suspenders guard.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    deferred.resolve(
      new Response(JSON.stringify({ status: "redeemed" }), { status: 200 }),
    );
  });
});
