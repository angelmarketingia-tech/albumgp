// QA — smoke tests for pure-shell page components.
//
// "Pure-shell" = no auth gate, no fetch, no async work. Currently only
// the entry page (`app/(entry)/page.tsx`) qualifies; /sobre, /canjear, and
// /album are async server components that touch `headers()`, `auth()`, or
// `fetch()` and require integration scaffolding to render meaningfully
// — those are covered by their respective form/logic tests + the API
// tests in `api-open.test.ts`, `api-redeem.test.ts`, `api-album.test.ts`.
//
// What we're proving here: the entry page composes Logo + heading + form
// + legal footer without throwing, and the legal notices required by
// AGENTS.md §12 actually show up in the DOM.
//
// Mocks:
//   - `next/image` → simple `<img>` to avoid jsdom's missing
//     `IntersectionObserver` (Next's Image triggers lazy-load logic that
//     jsdom doesn't fully implement).
//   - `next/navigation` → `useRouter` for the EntryForm child.
//   - `global.fetch` → no-op; the form never fires on render.

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LEGAL_NOTICES } from "@/lib/brand/constants";

// --- mocks ------------------------------------------------------------------

vi.mock("next/navigation", () => ({
  useRouter: (): { push: ReturnType<typeof vi.fn> } => ({ push: vi.fn() }),
}));

// `useFormStatus` ships with React 19 / Next's bundled React, but is absent
// from React 18.3.1's `react-dom` runtime used by Vitest. Re-export everything
// and provide a no-op stub so SubmitButton renders in jsdom.
vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    useFormStatus: (): {
      pending: boolean;
      data: null;
      method: null;
      action: null;
    } => ({ pending: false, data: null, method: null, action: null }),
  };
});

vi.mock("next/image", () => ({
  default: (props: {
    src: string;
    alt?: string;
    width?: number;
    height?: number;
  }): JSX.Element => {
    // Strip Next-specific props (`priority`, `placeholder`, etc.) so React
    // doesn't warn. Spread only the safe ones.
    return (
      <img
        src={props.src}
        alt={props.alt ?? ""}
        width={props.width}
        height={props.height}
      />
    );
  },
}));

// --- helper -----------------------------------------------------------------

interface EntryPageProps {
  searchParams: { error?: string };
}

async function loadEntryPage(): Promise<
  (props: EntryPageProps) => JSX.Element
> {
  const mod = (await import("@/app/(entry)/page")) as {
    default: (props: EntryPageProps) => JSX.Element;
  };
  return mod.default;
}

const EMPTY_SEARCH: EntryPageProps = { searchParams: {} };

// =============================================================================

describe("EntryPage — render smoke", () => {
  it("renders without throwing", async () => {
    const EntryPage = await loadEntryPage();
    expect(() => render(<EntryPage {...EMPTY_SEARCH} />)).not.toThrow();
  });

  it("renders the Logo (alt='GanaPlay')", async () => {
    const EntryPage = await loadEntryPage();
    render(<EntryPage {...EMPTY_SEARCH} />);
    expect(screen.getByAltText("GanaPlay")).toBeInTheDocument();
  });

  it("renders the main heading 'Abrí tu sobre'", async () => {
    const EntryPage = await loadEntryPage();
    render(<EntryPage {...EMPTY_SEARCH} />);
    expect(
      screen.getByRole("heading", { name: /abrí tu sobre/i }),
    ).toBeInTheDocument();
  });

  it("renders the EntryForm (code input + submit button)", async () => {
    const EntryPage = await loadEntryPage();
    render(<EntryPage {...EMPTY_SEARCH} />);
    expect(screen.getByLabelText(/código de canje/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /abrir sobre/i }),
    ).toBeInTheDocument();
  });

  // El CTA de signin se simplifico de la oracion completa a un link discreto
  // "Mi album ->" en la esquina top-right (decision visual del workflow
  // 2026-05-28: la CTA primaria es Abrir sobre, signin es secundaria).
  it("renders the 'Mi album' link with the correct callbackUrl", async () => {
    const EntryPage = await loadEntryPage();
    render(<EntryPage {...EMPTY_SEARCH} />);
    const link = screen.getByRole("link", { name: /mi álbum/i });
    expect(link).toHaveAttribute(
      "href",
      "/auth/signin?callbackUrl=/album",
    );
  });

  it("renders the mandatory legal notices (AGENTS.md §12)", async () => {
    const EntryPage = await loadEntryPage();
    render(<EntryPage {...EMPTY_SEARCH} />);
    expect(screen.getByText(LEGAL_NOTICES.ageGate)).toBeInTheDocument();
    expect(
      screen.getByText(LEGAL_NOTICES.responsibleGaming),
    ).toBeInTheDocument();
  });
});
