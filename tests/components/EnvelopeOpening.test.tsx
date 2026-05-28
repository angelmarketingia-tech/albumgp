import { render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Default mock — `useReducedMotion` returns false. Some tests override it
// per-test via `vi.doMock` patterns; we keep this stub small enough that
// flipping the return value works via a module-level setter (see below).
let reducedMotionValue = false;

vi.mock("framer-motion", async () => {
  const mod = await import("../setup/framer-motion-mock");
  return {
    ...mod,
    useReducedMotion: (): boolean => reducedMotionValue,
  };
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

import { EnvelopeOpening } from "@/components/envelope/EnvelopeOpening";

describe("EnvelopeOpening", () => {
  beforeEach(() => {
    reducedMotionValue = false;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the envelope region with the GanaPlay logo and album label", () => {
    render(<EnvelopeOpening country="SV" onOpened={() => undefined} />);
    expect(
      screen.getByRole("region", { name: /apertura del sobre/i }),
    ).toBeInTheDocument();
    expect(screen.getByAltText("GanaPlay")).toBeInTheDocument();
    expect(screen.getByText(/album oficial 2026/i)).toBeInTheDocument();
  });

  it("exposes data-country on the root", () => {
    const { container } = render(
      <EnvelopeOpening country="GT" onOpened={() => undefined} />,
    );
    const root = container.querySelector("[data-envelope-opening]");
    expect(root?.getAttribute("data-country")).toBe("GT");
  });

  it("fires onOpened immediately when skipAnimation=true", () => {
    const onOpened = vi.fn();
    const { container } = render(
      <EnvelopeOpening country="SV" onOpened={onOpened} skipAnimation />,
    );
    // skipAnimation renders the sr-only region (no logo) and schedules a
    // microtask -> 0ms timer.
    const root = container.querySelector("[data-envelope-opening]");
    expect(root?.getAttribute("data-skipped")).toBe("true");
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(onOpened).toHaveBeenCalledTimes(1);
  });

  it("fires onOpened immediately when useReducedMotion()=true", () => {
    reducedMotionValue = true;
    const onOpened = vi.fn();
    const { container } = render(
      <EnvelopeOpening country="SV" onOpened={onOpened} />,
    );
    const root = container.querySelector("[data-envelope-opening]");
    expect(root?.getAttribute("data-skipped")).toBe("true");
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(onOpened).toHaveBeenCalledTimes(1);
  });

  it("does NOT fire onOpened before the total animation timer elapses", () => {
    const onOpened = vi.fn();
    render(<EnvelopeOpening country="SV" onOpened={onOpened} />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onOpened).not.toHaveBeenCalled();
  });

  it("fires onOpened once after the full sequence (~1.6s)", () => {
    const onOpened = vi.fn();
    render(<EnvelopeOpening country="SV" onOpened={onOpened} />);
    act(() => {
      // STEP_APPEAR + STEP_SHAKE + STEP_FLAP + STEP_FLASH + STEP_FADE = 1600ms.
      vi.advanceTimersByTime(1700);
    });
    expect(onOpened).toHaveBeenCalledTimes(1);
  });

  it("stays below the 2s total budget", () => {
    const onOpened = vi.fn();
    render(<EnvelopeOpening country="SV" onOpened={onOpened} />);
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(onOpened).toHaveBeenCalled();
  });

  it("does not double-fire onOpened on re-renders", () => {
    const onOpened = vi.fn();
    const { rerender } = render(
      <EnvelopeOpening country="SV" onOpened={onOpened} />,
    );
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    rerender(<EnvelopeOpening country="SV" onOpened={onOpened} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onOpened).toHaveBeenCalledTimes(1);
  });
});
