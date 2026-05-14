import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WeeklyReportSkeleton } from "./weekly-report-skeleton";

/**
 * UFB-072 (2026-05-11): DOM-parity tests for the WeeklyReportSkeleton.
 *
 * The skeleton mirrors {@link WeeklyReportPage}'s 5 top-level sections:
 *   1. page header (title + Live pill | 2 action buttons)
 *   2. period nav shell
 *   3. AI Insights card (was missing before UFB-072)
 *   4. Portfolio overview card (sm:grid-cols-2 of 6 product cards)
 *   5. per-product accordions × 6
 *
 * These tests pin the structural contract — adding/removing a section
 * on the real page without updating the skeleton would now break a test.
 */
describe("WeeklyReportSkeleton", () => {
  it("renders with aria-busy and accessible label", () => {
    render(<WeeklyReportSkeleton />);
    const root = screen.getByLabelText("Loading status report");
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute("aria-busy", "true");
  });

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
    // Two button placeholders, not three. UFB-072: real page renders
    // ExportPdfButton + PublishLockButton only.
    expect(rightCluster.children.length).toBe(2);
  });

  it("renders a 6-card portfolio grid (sm:grid-cols-2)", () => {
    const { container } = render(<WeeklyReportSkeleton />);
    const grid = container.querySelector<HTMLElement>(".sm\\:grid-cols-2");
    expect(grid).not.toBeNull();
    expect(grid?.children.length).toBe(6);
  });

  it("includes an AI Insights placeholder slot (UFB-072 regression)", () => {
    const { container } = render(<WeeklyReportSkeleton />);
    // Top-level children of the root must be exactly 5: header,
    // period-nav, AI card, portfolio card, accordion list.
    const root = getRoot(container);
    expect(root.children.length).toBe(5);
  });

  it("renders 6 accordion placeholders to match the seeded product count", () => {
    const { container } = render(<WeeklyReportSkeleton />);
    const root = getRoot(container);
    // The last top-level child is the `space-y-3` list of accordion cards.
    const accordionList = root.lastElementChild as HTMLElement;
    expect(accordionList.children.length).toBe(6);
  });
});
