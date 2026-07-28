import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ArchiveToggle } from "./archive-toggle";

// The toggle stays a quiet icon-only indicator: switch semantics are preserved,
// while a numeric badge would incorrectly suggest a separate action.
describe("ArchiveToggle", () => {
  it("renders as a quiet indicator with no numeric count text", () => {
    render(<ArchiveToggle checked={false} onChange={vi.fn()} />);
    const btn = screen.getByRole("switch");
    expect(btn).toHaveTextContent("");
  });

  it("is a token-sized icon button with aria-label and matching tooltip", () => {
    render(<ArchiveToggle checked={false} onChange={vi.fn()} />);
    const btn = screen.getByRole("switch", {
      name: "Show closed (archived) report periods",
    });
    expect(btn).toHaveAttribute(
      "title",
      "Show closed (archived) report periods",
    );
    expect(btn.className).toContain("h-[var(--toolbar-control-h)]");
    expect(btn.className).toContain("w-[var(--toolbar-control-h)]");
  });

  it("is a switch with aria-checked reflecting the checked prop", () => {
    render(<ArchiveToggle checked={true} onChange={vi.fn()} />);
    const btn = screen.getByRole("switch");
    expect(btn).toHaveAttribute("aria-checked", "true");
  });

  it("calls onChange with the toggled value when clicked", () => {
    const onChange = vi.fn();
    render(<ArchiveToggle checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
