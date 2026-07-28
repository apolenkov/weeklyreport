import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WeeklyReportSkeleton } from "./weekly-report-skeleton";

// DOM-parity for skeleton structure; structural drift vs the real page fails here.
describe("WeeklyReportSkeleton", () => {
  function getRoot(container: HTMLElement): HTMLElement {
    const root = container.querySelector<HTMLElement>(
      '[data-testid="weekly-report-skeleton"]',
    );
    if (!root) throw new Error("skeleton root not found");
    return root;
  }

  it("renders exactly two action-button placeholders in the header (Export + Publish)", () => {
    const { container } = render(<WeeklyReportSkeleton />);
    const root = getRoot(container);
    const headerRow = root.firstElementChild as HTMLElement;
    const rightCluster = headerRow.children[1] as HTMLElement;
    // Two button placeholders, not three. Real page renders
    // ExportPdfButton + PublishLockButton only.
    expect(rightCluster.children).toHaveLength(2);
  });

  it("renders a 6-card portfolio grid (sm:grid-cols-2)", () => {
    const { container } = render(<WeeklyReportSkeleton />);
    const grid = container.querySelector<HTMLElement>(
      String.raw`.sm\:grid-cols-2`,
    );
    expect(grid).not.toBeNull();
    expect(grid?.children).toHaveLength(6);
  });

  it("renders 6 accordion placeholders to match the seeded product count", () => {
    const { container } = render(<WeeklyReportSkeleton />);
    const root = getRoot(container);
    // The last top-level child is the `space-y-3` list of accordion cards.
    const accordionList = root.lastElementChild as HTMLElement;
    expect(accordionList.children).toHaveLength(6);
  });

  it("root element exposes the pinned accessibility attributes", () => {
    render(<WeeklyReportSkeleton />);
    const root = screen.getByRole("status", {
      name: /loading status report/i,
    });
    // Pin the attributes that constitute the a11y contract; class/structure
    // changes that don't affect role/aria attributes will still pass.
    expect({
      role: root.getAttribute("role"),
      ariaBusy: root.getAttribute("aria-busy"),
      ariaLabel: root.getAttribute("aria-label"),
      testId: root.dataset.testid,
    }).toEqual({
      role: "status",
      ariaBusy: "true",
      ariaLabel: "Loading status report",
      testId: "weekly-report-skeleton",
    });
  });
});
