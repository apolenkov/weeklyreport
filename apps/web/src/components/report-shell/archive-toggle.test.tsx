import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ArchiveToggle } from "./archive-toggle";

describe("ArchiveToggle", () => {
  it("renders 'Show archived' label when archivedCount is not provided", () => {
    render(<ArchiveToggle checked={false} onChange={vi.fn()} />);
    expect(screen.getByText("Show archived")).toBeInTheDocument();
    // No count badge — the exact strings "0 archived".."N archived" are absent.
    expect(screen.queryByText("1 archived")).not.toBeInTheDocument();
  });

  it("renders 'Show archived' label when archivedCount is 0", () => {
    render(
      <ArchiveToggle checked={false} onChange={vi.fn()} archivedCount={0} />,
    );
    expect(screen.getByText("Show archived")).toBeInTheDocument();
    expect(screen.queryByText("0 archived")).not.toBeInTheDocument();
  });

  it("renders count badge when archivedCount > 0 and hides the text label", () => {
    render(
      <ArchiveToggle checked={false} onChange={vi.fn()} archivedCount={3} />,
    );
    expect(screen.getByText("3 archived")).toBeInTheDocument();
    expect(screen.queryByText("Show archived")).not.toBeInTheDocument();
  });

  it("renders correct count in badge for archivedCount = 1", () => {
    render(
      <ArchiveToggle checked={false} onChange={vi.fn()} archivedCount={1} />,
    );
    expect(screen.getByText("1 archived")).toBeInTheDocument();
  });

  it("is a switch button with aria-checked reflecting the checked prop", () => {
    render(
      <ArchiveToggle checked={true} onChange={vi.fn()} archivedCount={2} />,
    );
    const btn = screen.getByRole("switch");
    expect(btn).toHaveAttribute("aria-checked", "true");
  });
});
