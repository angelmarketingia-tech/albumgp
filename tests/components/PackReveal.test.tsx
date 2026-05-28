import { render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", async () => {
  const mod = await import("../setup/framer-motion-mock");
  return mod;
});

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, ...rest } = props as { src: string; alt: string };
    return <img src={src} alt={alt} {...rest} />;
  },
}));

import { PackReveal } from "@/components/envelope/PackReveal";
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

describe("PackReveal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders 5 cards (3 guaranteed + 2 variable)", () => {
    const { container } = render(<PackReveal pack={pack} />);
    const cards = container.querySelectorAll("[data-card]");
    expect(cards.length).toBe(5);
  });

  it("attaches a GARANTIZADO badge to each of the 3 guaranteed cards", () => {
    const { container } = render(<PackReveal pack={pack} />);
    const badges = container.querySelectorAll("[data-guaranteed-badge]");
    expect(badges.length).toBe(3);
    expect(screen.getAllByText(/garantizado/i).length).toBeGreaterThanOrEqual(
      3,
    );
  });

  it("renders the wrapper with data-card-count", () => {
    const { container } = render(<PackReveal pack={pack} />);
    const root = container.querySelector("[data-pack-reveal]");
    expect(root?.getAttribute("data-card-count")).toBe("5");
  });

  it("fires onAllRevealed once after the staged timer", () => {
    const onAllRevealed = vi.fn();
    render(<PackReveal pack={pack} onAllRevealed={onAllRevealed} />);
    expect(onAllRevealed).not.toHaveBeenCalled();
    act(() => {
      // 5 cards * 150ms + 500ms = 1250ms
      vi.advanceTimersByTime(1300);
    });
    expect(onAllRevealed).toHaveBeenCalledTimes(1);
  });

  it("does not double-fire onAllRevealed", () => {
    const onAllRevealed = vi.fn();
    render(<PackReveal pack={pack} onAllRevealed={onAllRevealed} />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onAllRevealed).toHaveBeenCalledTimes(1);
  });
});
