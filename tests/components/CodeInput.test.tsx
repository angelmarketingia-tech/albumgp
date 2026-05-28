import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  CodeInput,
  formatCodeForDisplay,
  normalizeCode,
} from "@/components/ui/CodeInput";

function Wrapper({
  onChange,
  initial = "",
  error,
}: {
  onChange?: (next: string) => void;
  initial?: string;
  error?: string;
}): JSX.Element {
  const [value, setValue] = useState(initial);
  return (
    <CodeInput
      value={value}
      onChange={(next): void => {
        setValue(next);
        onChange?.(next);
      }}
      {...(error !== undefined ? { error } : {})}
    />
  );
}

describe("CodeInput", () => {
  it("normalizes input to A-HJ-NP-Z2-9 and uppercases", () => {
    expect(normalizeCode(" abc-d1IO0 9k ")).toBe("ABCD9K");
  });

  it("trims the result to 16 chars", () => {
    expect(normalizeCode("ABCDEFGHJKLMNPQRSTUV")).toHaveLength(16);
  });

  it("formats display as XXXX XXXX XXXX XXXX", () => {
    expect(formatCodeForDisplay("ABCDEFGH")).toBe("ABCD EFGH");
    expect(formatCodeForDisplay("ABCDEFGHJK")).toBe("ABCD EFGH JK");
    expect(formatCodeForDisplay("")).toBe("");
  });

  it("fires onChange with normalized value when user types lowercase + symbols", () => {
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    const input = screen.getByLabelText(
      /código de canje/i,
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "ab-cd!ef gh" } });
    expect(onChange).toHaveBeenCalledWith("ABCDEFGH");
  });

  it("shows the formatted display value after change", () => {
    render(<Wrapper />);
    const input = screen.getByLabelText(
      /código de canje/i,
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "abcdefgh" } });
    expect(input.value).toBe("ABCD EFGH");
  });

  it("discards forbidden chars I, O, 0, 1", () => {
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    const input = screen.getByLabelText(
      /código de canje/i,
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "IO01ABCD" } });
    expect(onChange).toHaveBeenCalledWith("ABCD");
  });

  it("renders error message with role=alert when error is set", () => {
    render(<Wrapper error="Código inválido" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Código inválido");
    const input = screen.getByLabelText(/código de canje/i);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("data-has-error")).toBe("true");
  });

  it("does not call onChange if the normalized value is unchanged", () => {
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} initial="ABCD" />);
    const input = screen.getByLabelText(
      /código de canje/i,
    ) as HTMLInputElement;
    // Type the same letters formatted differently — normalize should
    // produce the same value and skip the callback.
    fireEvent.change(input, { target: { value: "ABCD" } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
