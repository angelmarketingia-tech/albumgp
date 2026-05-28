import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActionButton } from "@/components/ui/ActionButton";

describe("ActionButton", () => {
  it("renders the primary variant by default and submits children", () => {
    render(<ActionButton>Abrir sobre</ActionButton>);
    const btn = screen.getByRole("button", { name: /abrir sobre/i });
    expect(btn.getAttribute("data-variant")).toBe("primary");
    expect(btn.getAttribute("data-size")).toBe("md");
    expect(btn.getAttribute("type")).toBe("button");
  });

  it("forwards the secondary variant marker", () => {
    render(<ActionButton variant="secondary">Cancelar</ActionButton>);
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("data-variant")).toBe("secondary");
  });

  it("forwards the ghost variant marker", () => {
    render(<ActionButton variant="ghost">Más tarde</ActionButton>);
    expect(screen.getByRole("button").getAttribute("data-variant")).toBe(
      "ghost",
    );
  });

  it("respects explicit size=lg", () => {
    render(
      <ActionButton size="lg" variant="primary">
        Canjear
      </ActionButton>,
    );
    expect(screen.getByRole("button").getAttribute("data-size")).toBe("lg");
  });

  it("disables and shows a spinner when loading", () => {
    const onClick = vi.fn();
    render(
      <ActionButton loading onClick={onClick}>
        Validando
      </ActionButton>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect(btn.querySelector("[data-action-spinner]")).not.toBeNull();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("fires onClick when not loading and not disabled", () => {
    const onClick = vi.fn();
    render(<ActionButton onClick={onClick}>OK</ActionButton>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled when disabled=true even without loading", () => {
    render(<ActionButton disabled>OK</ActionButton>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
