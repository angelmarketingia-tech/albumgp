import { render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", async () => {
  const mod = await import("../setup/framer-motion-mock");
  return mod;
});

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const {
      src,
      alt,
      width,
      height,
      className,
      priority: _priority,
      fill: _fill,
      sizes: _sizes,
    } = props as {
      src: string;
      alt: string;
      width?: number;
      height?: number;
      className?: string;
      priority?: boolean;
      fill?: boolean;
      sizes?: string;
    };
    return (
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
      />
    );
  },
}));

import { EnvelopeFlow } from "@/components/envelope/EnvelopeFlow";
import {
  PACK_VERSION_CURRENT,
  type PackResult,
  type Prize,
} from "@/lib/prizes/types";

const guaranteed: Prize[] = [
  { type: "sports_credit", amount: 10, currency: "USD", label: "Crédito" },
  {
    type: "casino_spins",
    count: 200,
    game_name: "Clover Super Pot",
    label: "Giros",
  },
  { type: "deposit_match", multiplier: 3, label: "Triplicamos" },
];

const variable: Prize[] = [
  {
    type: "collectible",
    collectible_id: "c1",
    label: "Mascota",
    rarity: "common",
  },
  { type: "none", label: "Sigue intentando" },
];

const pack: PackResult = {
  guaranteed,
  variable,
  pack_version: PACK_VERSION_CURRENT,
};

const CtaSlot = (): JSX.Element => (
  <a data-testid="cta-canjear" href="/canjear">
    Canjear premios
  </a>
);

describe("EnvelopeFlow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("after hydration, settles into the `opening` phase: renders EnvelopeOpening, NOT PackReveal nor ctaSlot", () => {
    // EnvelopeFlow is SSR-safe: the very first render is `done` so users see
    // the pack even if hydration fails. Once the client hydrates, the
    // useEffect rewinds to `opening` to play the animation. RTL flushes
    // effects synchronously, so by the time render() returns we should see
    // the post-hydration state.
    const { container } = render(
      <EnvelopeFlow pack={pack} country="SV" ctaSlot={<CtaSlot />} />,
    );
    const root = container.querySelector("[data-envelope-flow]");
    expect(root?.getAttribute("data-phase")).toBe("opening");
    expect(container.querySelector("[data-envelope-opening]")).not.toBeNull();
    expect(container.querySelector("[data-pack-reveal]")).toBeNull();
    expect(screen.queryByTestId("cta-canjear")).toBeNull();
  });

  it("after the opening timer elapses, transitions to `revealing`: mounts PackReveal and unmounts EnvelopeOpening", () => {
    const { container } = render(
      <EnvelopeFlow pack={pack} country="SV" ctaSlot={<CtaSlot />} />,
    );
    act(() => {
      // EnvelopeOpening total is ~1600ms — give it a comfortable margin.
      vi.advanceTimersByTime(1700);
    });
    const root = container.querySelector("[data-envelope-flow]");
    expect(root?.getAttribute("data-phase")).toBe("revealing");
    expect(container.querySelector("[data-envelope-opening]")).toBeNull();
    expect(container.querySelector("[data-pack-reveal]")).not.toBeNull();
    // CTAs still hidden in `revealing`.
    expect(screen.queryByTestId("cta-canjear")).toBeNull();
  });

  it("after PackReveal finishes, transitions to `done` and renders the ctaSlot", () => {
    const { container } = render(
      <EnvelopeFlow pack={pack} country="SV" ctaSlot={<CtaSlot />} />,
    );
    // Phase 1: opening timer fires (~1600ms total).
    act(() => {
      vi.advanceTimersByTime(1700);
    });
    // Phase 2: PackReveal mounted; its effect schedules a timer at this
    // point. Advance enough for it to fire (5 * 150 + 500 = 1250ms).
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    const root = container.querySelector("[data-envelope-flow]");
    expect(root?.getAttribute("data-phase")).toBe("done");
    expect(screen.getByTestId("cta-canjear")).toBeInTheDocument();
    expect(container.querySelector("[data-pack-reveal]")).not.toBeNull();
  });

  it("with skipAnimation=true, jumps straight to `done` and renders ctaSlot", () => {
    const { container } = render(
      <EnvelopeFlow
        pack={pack}
        country="GT"
        ctaSlot={<CtaSlot />}
        skipAnimation
      />,
    );
    const root = container.querySelector("[data-envelope-flow]");
    expect(root?.getAttribute("data-phase")).toBe("done");
    expect(container.querySelector("[data-envelope-opening]")).toBeNull();
    expect(container.querySelector("[data-pack-reveal]")).not.toBeNull();
    expect(screen.getByTestId("cta-canjear")).toBeInTheDocument();
  });

  it("propagates `country` into EnvelopeOpening during the opening phase", () => {
    const { container } = render(
      <EnvelopeFlow pack={pack} country="GT" ctaSlot={<CtaSlot />} />,
    );
    const opening = container.querySelector("[data-envelope-opening]");
    expect(opening?.getAttribute("data-country")).toBe("GT");
  });
});
