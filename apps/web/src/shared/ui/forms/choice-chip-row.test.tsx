import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Flag } from "lucide-react";
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
    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveClass("min-h-[var(--touch-target-min)]");
      expect(button).not.toHaveClass("md:min-h-[34px]");
    }
    expect(screen.getByRole("button", { name: "! At Risk" })).toHaveAttribute(
      "type",
      "button",
    );
    expect(screen.getByRole("button", { name: "✕ Blocked" })).toHaveAttribute(
      "type",
      "button",
    );
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

  it("calls onSelect when a labelled choice is activated from the keyboard", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ChoiceChipRow choices={CHOICES} value="at-risk" onSelect={onSelect} />,
    );
    await user.tab();
    await user.tab();
    await user.keyboard("{Enter}");
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
    expect(idleBtn.style.border).toBe("1.5px solid var(--color-border-strong)");
  });

  it("renders a decorative icon outside the accessible name", () => {
    render(
      <ChoiceChipRow
        choices={[
          {
            value: "at-risk",
            label: "At risk",
            icon: Flag,
            bg: "var(--color-status-at-risk-bg)",
            color: "var(--color-status-at-risk-fg)",
            border: "var(--color-status-dot-at-risk)",
          },
        ]}
        value="at-risk"
        onSelect={vi.fn()}
      />,
    );
    const button = screen.getByRole("button", { name: "At risk" });
    expect(button.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
