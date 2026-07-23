import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ToolbarIconButton } from "./toolbar-icon-button";

describe("ToolbarIconButton", () => {
  it("renders the required aria-label and defaults title to it", () => {
    render(
      <ToolbarIconButton aria-label="Do the thing">
        <svg aria-hidden="true" />
      </ToolbarIconButton>,
    );
    const btn = screen.getByRole("button", { name: "Do the thing" });
    expect(btn).toHaveAttribute("title", "Do the thing");
  });

  it("uses an explicit title over the aria-label default", () => {
    render(
      <ToolbarIconButton aria-label="Accessible name" title="Tooltip wording">
        <svg aria-hidden="true" />
      </ToolbarIconButton>,
    );
    const btn = screen.getByRole("button", { name: "Accessible name" });
    expect(btn).toHaveAttribute("title", "Tooltip wording");
  });

  it("derives the shared circle size from the toolbar height token and sets type=button", () => {
    // The token is 32px on desktop and rises to the touch-target floor below
    // `md`, so the size must come from the token, not a hard-coded h-8/w-8.
    render(<ToolbarIconButton aria-label="Sized" />);
    const btn = screen.getByRole("button", { name: "Sized" });
    expect(btn).toHaveAttribute("type", "button");
    expect(btn.className).toContain("h-[var(--toolbar-control-h)]");
    expect(btn.className).toContain("w-[var(--toolbar-control-h)]");
    expect(btn.className).toContain("rounded-full");
  });

  it("appends variant classes after the base classes", () => {
    render(<ToolbarIconButton aria-label="Variant" className="bg-pink-500" />);
    const btn = screen.getByRole("button", { name: "Variant" });
    expect(btn.className).toContain("h-[var(--toolbar-control-h)]");
    expect(btn.className).toContain("bg-pink-500");
  });

  it("propagates disabled and blocks clicks", () => {
    const onClick = vi.fn();
    render(
      <ToolbarIconButton aria-label="Disabled" disabled onClick={onClick} />,
    );
    const btn = screen.getByRole("button", { name: "Disabled" });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});
