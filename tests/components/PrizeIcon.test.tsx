import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PrizeIcon } from "@/components/cards/PrizeIcon";
import type { PrizeType } from "@/lib/prizes/types";

const TYPES: PrizeType[] = [
  "sports_credit",
  "casino_spins",
  "deposit_match",
  "physical",
  "external_code",
  "collectible",
  "none",
];

describe("PrizeIcon", () => {
  for (const type of TYPES) {
    it(`renders an SVG identified for type=${type}`, () => {
      const { container } = render(<PrizeIcon type={type} />);
      const svg = container.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute("data-prize-icon")).toBe(type);
    });
  }

  it("uses stroke=currentColor so the parent decides the color", () => {
    const { container } = render(<PrizeIcon type="sports_credit" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
  });

  it("forwards className for sizing utilities", () => {
    const { container } = render(
      <PrizeIcon type="casino_spins" className="h-8 w-8" />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("h-8");
    expect(svg?.getAttribute("class")).toContain("w-8");
  });
});
