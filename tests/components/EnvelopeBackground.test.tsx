import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // Strip Next-only props (priority, fill, sizes) that jsdom's <img>
    // would warn about; keep src + alt + width + height + className.
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

import { EnvelopeBackground } from "@/components/envelope/EnvelopeBackground";
import { GANAPLAY_SLOGAN, LEGAL_NOTICES } from "@/lib/brand/constants";

describe("EnvelopeBackground", () => {
  it("renders the official slogan", () => {
    render(
      <EnvelopeBackground country="SV">
        <span>child</span>
      </EnvelopeBackground>,
    );
    expect(screen.getByText(GANAPLAY_SLOGAN)).toBeInTheDocument();
  });

  it("renders both legal notices in the footer", () => {
    render(
      <EnvelopeBackground country="GT">
        <span>x</span>
      </EnvelopeBackground>,
    );
    expect(screen.getByText(LEGAL_NOTICES.ageGate)).toBeInTheDocument();
    expect(
      screen.getByText(LEGAL_NOTICES.responsibleGaming),
    ).toBeInTheDocument();
  });

  it("renders the GanaPlay logo and exposes the country", () => {
    const { container } = render(
      <EnvelopeBackground country="SV">
        <span>child</span>
      </EnvelopeBackground>,
    );
    expect(screen.getByAltText("GanaPlay")).toBeInTheDocument();
    const root = container.querySelector("[data-envelope-bg]");
    expect(root?.getAttribute("data-country")).toBe("SV");
  });

  it("renders children inside the constrained main", () => {
    render(
      <EnvelopeBackground country="GT">
        <p data-testid="content">Hola</p>
      </EnvelopeBackground>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });
});
