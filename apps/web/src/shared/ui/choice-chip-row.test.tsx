import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChoiceChipRow } from "./choice-chip-row";

type Severity = "at-risk" | "blocked";

const CHOICES = [
  {
    value: "at-risk" as Severity,
    label: "! At Risk",
    bg: "var(--color-status-at-risk-bg)",
    color: "var(--color-status-at-risk-fg)",
    border: "var(--color-status-dot-at-risk)",
  },
  {
    value: "blocked" as Severity,
    label: "✕ Blocked",
    bg: "var(--color-status-blocked-bg)",
    color: "var(--color-destructive)",
    border: "var(--color-destructive)",
  },
];

describe("ChoiceChipRow", () => {
  it("renders one button per choice, labelled per choice.label", () => {
    render(
      <ChoiceChipRow choices={CHOICES} value="at-risk" onSelect={vi.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: "! At Risk" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "✕ Blocked" }),
    ).toBeInTheDocument();
  });

  it("marks the selected choice aria-pressed=true and others false", () => {
    render(
      <ChoiceChipRow choices={CHOICES} value="blocked" onSelect={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "! At Risk" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "✕ Blocked" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("calls onSelect with the clicked choice's value", () => {
    const onSelect = vi.fn();
    render(
      <ChoiceChipRow choices={CHOICES} value="at-risk" onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "✕ Blocked" }));
    expect(onSelect).toHaveBeenCalledWith("blocked");
  });

  it("styles the selected chip with its own bg/color/border and the idle chip with the neutral outline", () => {
    render(
      <ChoiceChipRow choices={CHOICES} value="at-risk" onSelect={vi.fn()} />,
    );
    const selectedBtn = screen.getByRole("button", { name: "! At Risk" });
    expect(selectedBtn.style.background).toBe("var(--color-status-at-risk-bg)");
    expect(selectedBtn.style.color).toBe("var(--color-status-at-risk-fg)");
    expect(selectedBtn.style.border).toBe(
      "1.5px solid var(--color-status-dot-at-risk)",
    );
    const idleBtn = screen.getByRole("button", { name: "✕ Blocked" });
    expect(idleBtn.style.background).toBe("transparent");
    expect(idleBtn.style.border).toBe("1.5px solid rgba(0, 0, 0, 0.15)");
  });
});
