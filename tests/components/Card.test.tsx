import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", async () => {
  const mod = await import("../setup/framer-motion-mock");
  return mod;
});

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // next/image isn't available in jsdom — render a plain <img> with the
    // same alt + src so tests can assert about the visible UI.
    const { src, alt, fill: _fill, sizes: _sizes, ...rest } = props as {
      src: string;
      alt: string;
      fill?: boolean;
      sizes?: string;
    };
    return <img src={src} alt={alt} {...rest} />;
  },
}));

import { Card } from "@/components/cards/Card";
import type { Prize } from "@/lib/prizes/types";

describe("Card", () => {
  it("renders sports_credit with amount, currency and label", () => {
    const prize: Prize = {
      type: "sports_credit",
      amount: 10,
      currency: "USD",
      label: "Crédito deportivo",
    };
    render(<Card prize={prize} />);
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("USD")).toBeInTheDocument();
    expect(screen.getByText("Crédito deportivo")).toBeInTheDocument();
  });

  it("renders casino_spins with count, GIROS GRATIS label and game name", () => {
    const prize: Prize = {
      type: "casino_spins",
      count: 200,
      game_name: "Clover Super Pot",
      label: "Giros de bienvenida",
    };
    render(<Card prize={prize} />);
    expect(screen.getByText("200")).toBeInTheDocument();
    expect(screen.getByText(/giros gratis/i)).toBeInTheDocument();
    expect(screen.getByText("Clover Super Pot")).toBeInTheDocument();
  });

  it("renders deposit_match with multiplier × and TU DEPOSITO copy", () => {
    const prize: Prize = {
      type: "deposit_match",
      multiplier: 3,
      label: "Triplicamos tu primer depósito",
    };
    render(<Card prize={prize} />);
    // Multiplier digit is co-located with "×"; assert text inclusion.
    expect(screen.getByText(/3/)).toBeInTheDocument();
    expect(screen.getByText(/tu depósito/i)).toBeInTheDocument();
    expect(screen.getByText(/triplicamos/i)).toBeInTheDocument();
  });

  it("renders physical prize with label", () => {
    const prize: Prize = {
      type: "physical",
      sku: "MUG-001",
      label: "Taza GanaPlay",
      redemption_instructions: "Retira en sucursal",
    };
    render(<Card prize={prize} />);
    expect(screen.getByText("Taza GanaPlay")).toBeInTheDocument();
  });

  it("renders external_code with provider", () => {
    const prize: Prize = {
      type: "external_code",
      provider: "Spotify",
      label: "1 mes Premium",
    };
    render(<Card prize={prize} />);
    expect(screen.getByText("1 mes Premium")).toBeInTheDocument();
    expect(screen.getByText("Spotify")).toBeInTheDocument();
  });

  it("renders collectible with RarityBadge", () => {
    const prize: Prize = {
      type: "collectible",
      collectible_id: "hero-001",
      label: "Capitán GP",
      rarity: "legendary",
    };
    const { container } = render(<Card prize={prize} />);
    expect(screen.getByText("Capitán GP")).toBeInTheDocument();
    expect(
      container.querySelector('[data-rarity="legendary"]'),
    ).not.toBeNull();
  });

  it("renders collectible with image_url via next/image stub", () => {
    const prize: Prize = {
      type: "collectible",
      collectible_id: "hero-002",
      label: "Mascota",
      rarity: "rare",
      image_url: "/assets/collectible/mascota.png",
    };
    render(<Card prize={prize} />);
    const img = screen.getByAltText("Mascota") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("/assets/collectible/mascota.png");
  });

  it("renders none with sober gray surface", () => {
    const prize: Prize = { type: "none", label: "Sigue intentando" };
    const { container } = render(<Card prize={prize} />);
    expect(screen.getByText("Sigue intentando")).toBeInTheDocument();
    const root = container.querySelector("[data-card]");
    expect(root?.getAttribute("data-prize-type")).toBe("none");
  });

  it("exposes data-revealed=false when revealed prop is false", () => {
    const prize: Prize = {
      type: "sports_credit",
      amount: 10,
      currency: "USD",
      label: "x",
    };
    const { container } = render(<Card prize={prize} revealed={false} />);
    const root = container.querySelector("[data-card]");
    expect(root?.getAttribute("data-revealed")).toBe("false");
    // Back face is present.
    expect(container.querySelector('[data-face="back"]')).not.toBeNull();
  });

  it("applies the lg size class", () => {
    const prize: Prize = { type: "none", label: "x" };
    const { container } = render(<Card prize={prize} size="lg" />);
    const root = container.querySelector("[data-card]");
    expect(root?.className).toContain("w-64");
    expect(root?.className).toContain("h-96");
  });
});
