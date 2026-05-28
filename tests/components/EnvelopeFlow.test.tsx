import { render, screen, act, fireEvent } from "@testing-library/react";
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

describe("EnvelopeFlow (interactive suspense)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders in `idle` stage by default: envelope visible, no cards revealed yet", () => {
    const { container } = render(
      <EnvelopeFlow pack={pack} country="SV" ctaSlot={<CtaSlot />} />,
    );
    const root = container.querySelector("[data-envelope-flow]");
    expect(root?.getAttribute("data-stage")).toBe("idle");
    expect(container.querySelector("[data-envelope-idle]")).not.toBeNull();
    // CTAs ocultos mientras la grilla no esta lista
    expect(screen.queryByTestId("cta-canjear")).toBeNull();
  });

  it("renders the 'Abrir el sobre' button in idle stage", () => {
    render(<EnvelopeFlow pack={pack} country="SV" ctaSlot={<CtaSlot />} />);
    expect(
      screen.getByRole("button", { name: /abrir el sobre/i }),
    ).toBeInTheDocument();
  });

  it("transitions to `revealing` when the envelope is clicked, then to `done`", () => {
    const { container } = render(
      <EnvelopeFlow pack={pack} country="SV" ctaSlot={<CtaSlot />} />,
    );
    const openBtn = screen.getByRole("button", { name: /abrir el sobre/i });
    act(() => {
      fireEvent.click(openBtn);
    });
    let root = container.querySelector("[data-envelope-flow]");
    expect(root?.getAttribute("data-stage")).toBe("revealing");

    // Advance well past 5 cards * 1100ms + 500ms transition.
    // We do it in chunks to let React process state updates between.
    for (let i = 0; i < 10; i += 1) {
      act(() => {
        vi.advanceTimersByTime(1200);
      });
    }
    root = container.querySelector("[data-envelope-flow]");
    expect(root?.getAttribute("data-stage")).toBe("done");
    expect(screen.getByTestId("cta-canjear")).toBeInTheDocument();
  });

  it("with skipAnimation=true jumps straight to `done` and shows CTAs", () => {
    const { container } = render(
      <EnvelopeFlow
        pack={pack}
        country="GT"
        ctaSlot={<CtaSlot />}
        skipAnimation
      />,
    );
    const root = container.querySelector("[data-envelope-flow]");
    expect(root?.getAttribute("data-stage")).toBe("done");
    expect(screen.getByTestId("cta-canjear")).toBeInTheDocument();
    // Grilla con las 5 cartas
    const grid = container.querySelector("[data-pack-reveal]");
    expect(grid?.getAttribute("data-card-count")).toBe("5");
  });

  it("propagates `country` to data attribute", () => {
    const { container } = render(
      <EnvelopeFlow pack={pack} country="GT" ctaSlot={<CtaSlot />} />,
    );
    const root = container.querySelector("[data-envelope-flow]");
    expect(root?.getAttribute("data-country")).toBe("GT");
  });
});
