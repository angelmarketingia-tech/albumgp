import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RarityBadge } from "@/components/cards/RarityBadge";

describe("RarityBadge", () => {
  it("renders common with gray-light bg and white text", () => {
    const { container } = render(<RarityBadge rarity="common" />);
    const span = container.querySelector('[data-rarity="common"]');
    expect(span).not.toBeNull();
    expect(span?.className).toContain("bg-gp-gray-light");
    expect(span?.className).toContain("text-gp-white");
    expect(screen.getByText("Común")).toBeInTheDocument();
  });

  it("renders rare with brand green bg", () => {
    const { container } = render(<RarityBadge rarity="rare" />);
    const span = container.querySelector('[data-rarity="rare"]');
    expect(span?.className).toContain("bg-gp-green");
    expect(span?.className).toContain("text-gp-white");
    expect(screen.getByText("Rara")).toBeInTheDocument();
  });

  it("renders epic with local EPIC_COLOR inline style (not a tailwind token)", () => {
    const { container } = render(<RarityBadge rarity="epic" />);
    const span = container.querySelector(
      '[data-rarity="epic"]',
    ) as HTMLElement | null;
    expect(span).not.toBeNull();
    // Style is applied inline so the color stays contained until the
    // brand team confirms a Manual-approved HEX.
    expect(span?.getAttribute("style") ?? "").toContain("background-color");
    expect(screen.getByText("Épica")).toBeInTheDocument();
  });

  it("renders legendary with the gold gradient utility + shadow", () => {
    const { container } = render(<RarityBadge rarity="legendary" />);
    const span = container.querySelector('[data-rarity="legendary"]');
    expect(span?.className).toContain("bg-gp-gold-gradient");
    expect(span?.className).toContain("shadow-md");
    expect(screen.getByText("Legendaria")).toBeInTheDocument();
  });
});
