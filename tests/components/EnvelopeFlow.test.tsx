import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

describe("EnvelopeFlow (server-rendered cards + CSS staggered reveal)", () => {
  it("renders in `idle` stage by default: envelope visible, no cards revealed yet", () => {
    const { container } = render(
      <EnvelopeFlow
        pack={pack}
        country="SV"
        ctaSlot={<CtaSlot />}
        openHref="/sobre/X?reveal=1"
      />,
    );
    const root = container.querySelector("[data-envelope-flow]");
    expect(root?.getAttribute("data-stage")).toBe("idle");
    expect(container.querySelector("[data-envelope-idle]")).not.toBeNull();
    expect(screen.queryByTestId("cta-canjear")).toBeNull();
  });

  it("idle stage renders an <a> when openHref is provided (URL navigation, no JS required)", () => {
    render(
      <EnvelopeFlow
        pack={pack}
        country="SV"
        ctaSlot={<CtaSlot />}
        openHref="/sobre/X?reveal=1"
      />,
    );
    const link = screen.getByRole("link", { name: /abrir el sobre/i });
    expect(link).toHaveAttribute("href", "/sobre/X?reveal=1");
  });

  it("with initialStage='revealing', renders ALL 5 cards + CTAs from SSR", () => {
    const { container } = render(
      <EnvelopeFlow
        pack={pack}
        country="SV"
        ctaSlot={<CtaSlot />}
        initialStage="revealing"
      />,
    );
    const root = container.querySelector("[data-envelope-flow]");
    expect(root?.getAttribute("data-stage")).toBe("revealing");
    const grid = container.querySelector("[data-pack-reveal]");
    expect(grid?.getAttribute("data-card-count")).toBe("5");
    // CTAs presentes desde el primer render (no esperan a JS).
    expect(screen.getByTestId("cta-canjear")).toBeInTheDocument();
    // El boton "TOCA PARA ABRIR" ya no aparece.
    expect(container.querySelector("[data-envelope-idle]")).toBeNull();
  });

  it("with skipAnimation=true, jumps to revealing and shows CTAs immediately", () => {
    const { container } = render(
      <EnvelopeFlow
        pack={pack}
        country="GT"
        ctaSlot={<CtaSlot />}
        skipAnimation
      />,
    );
    const root = container.querySelector("[data-envelope-flow]");
    expect(root?.getAttribute("data-stage")).toBe("revealing");
    expect(screen.getByTestId("cta-canjear")).toBeInTheDocument();
    // El divider de cierre aparece inmediatamente con skipAnimation. Copy:
    // "Sobre {TIER} · N premio(s)". Sin tier defectea a "GANAPLAY".
    // Usamos function-matcher porque React puede dividir el texto en
    // multiples nodes dentro del span (interpolaciones).
    expect(
      screen.getByText((_content, el) => {
        if (!el || el.tagName.toLowerCase() !== "span") return false;
        const t = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
        return /^Sobre\s+\S+\s+·\s+\d+\s+premio/i.test(t);
      }),
    ).toBeInTheDocument();
  });

  it("propagates `country` to data attribute on both stages", () => {
    const { container: idle } = render(
      <EnvelopeFlow
        pack={pack}
        country="GT"
        ctaSlot={<CtaSlot />}
        openHref="/x"
      />,
    );
    expect(
      idle.querySelector("[data-envelope-flow]")?.getAttribute("data-country"),
    ).toBe("GT");

    const { container: rev } = render(
      <EnvelopeFlow
        pack={pack}
        country="SV"
        ctaSlot={<CtaSlot />}
        initialStage="revealing"
      />,
    );
    expect(
      rev.querySelector("[data-envelope-flow]")?.getAttribute("data-country"),
    ).toBe("SV");
  });
});
