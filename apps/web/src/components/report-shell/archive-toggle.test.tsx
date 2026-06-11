import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ArchiveToggle } from "./archive-toggle";

// head-toolbar-parity D4 contract: 32px icon button via ToolbarIconButton,
// switch semantics preserved, non-zero archived count visible as a badge.
describe("ArchiveToggle", () => {
  it("renders no count badge when archivedCount is not provided", () => {
    render(<ArchiveToggle checked={false} onChange={vi.fn()} />);
    const btn = screen.getByRole("switch");
    expect(btn).toHaveTextContent("");
  });

  it("renders no count badge when archivedCount is 0", () => {
    render(
      <ArchiveToggle checked={false} onChange={vi.fn()} archivedCount={0} />,
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("keeps a non-zero archived count visible on the control", () => {
    render(
      <ArchiveToggle checked={false} onChange={vi.fn()} archivedCount={3} />,
    );
    const badge = screen.getByText("3");
    expect(badge).toBeInTheDocument();
    expect(screen.getByRole("switch")).toContainElement(badge);
  });

  it("is a 32px icon button with aria-label and matching tooltip", () => {
    render(
      <ArchiveToggle checked={false} onChange={vi.fn()} archivedCount={2} />,
    );
    const btn = screen.getByRole("switch", {
      name: "Show closed (archived) report periods",
    });
    expect(btn).toHaveAttribute(
      "title",
      "Show closed (archived) report periods",
    );
    expect(btn.className).toContain("h-8");
    expect(btn.className).toContain("w-8");
  });

  it("is a switch with aria-checked reflecting the checked prop", () => {
    render(
      <ArchiveToggle checked={true} onChange={vi.fn()} archivedCount={2} />,
    );
    const btn = screen.getByRole("switch");
    expect(btn).toHaveAttribute("aria-checked", "true");
  });
});
