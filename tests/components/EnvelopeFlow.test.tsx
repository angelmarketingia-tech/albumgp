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

  it("renders the pack reveal (cards visible from SSR) and country attribute", () => {
    const { container } = render(
      <EnvelopeFlow pack={pack} country="SV" ctaSlot={<CtaSlot />} />,
    );
    const root = container.querySelector("[data-envelope-flow]");
    expect(root).not.toBeNull();
    expect(root?.getAttribute("data-country")).toBe("SV");
    expect(container.querySelector("[data-pack-reveal]")).not.toBeNull();
    // 5 cartas en el grid
    const cards = container.querySelectorAll("[data-card]");
    expect(cards.length).toBe(5);
  });

  it("starts in `intro` stage and transitions to `revealing` then `done`", () => {
    const { container } = render(
      <EnvelopeFlow pack={pack} country="SV" ctaSlot={<CtaSlot />} />,
    );
    let root = container.querySelector("[data-envelope-flow]");
    expect(root?.getAttribute("data-stage")).toBe("intro");

    // Intro = 900ms
    act(() => {
      vi.advanceTimersByTime(950);
    });
    root = container.querySelector("[data-envelope-flow]");
    expect(root?.getAttribute("data-stage")).toBe("revealing");

    // Reveal cascade = 5 * 180 + 600 = 1500ms
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    root = container.querySelector("[data-envelope-flow]");
    expect(root?.getAttribute("data-stage")).toBe("done");
  });

  it("ctaSlot is rendered in DOM from the start (so the user can click even without JS)", () => {
    render(
      <EnvelopeFlow pack={pack} country="SV" ctaSlot={<CtaSlot />} />,
    );
    // ctaSlot está en el árbol desde el primer render — clave para SSR-safe.
    expect(screen.getByTestId("cta-canjear")).toBeInTheDocument();
  });

  it("with skipAnimation=true jumps straight to `done`", () => {
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
  });

  it("propagates `country` to data attribute", () => {
    const { container } = render(
      <EnvelopeFlow pack={pack} country="GT" ctaSlot={<CtaSlot />} />,
    );
    const root = container.querySelector("[data-envelope-flow]");
    expect(root?.getAttribute("data-country")).toBe("GT");
  });
});
