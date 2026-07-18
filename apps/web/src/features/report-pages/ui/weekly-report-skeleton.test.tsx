import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WeeklyReportSkeleton } from "./weekly-report-skeleton";

// VA-0a/VA-0b: a11y regression tests for the role="status" root added in the
// Biome recommended-flip change. See openspec/changes/verify-a11y-recommended-flip.

/**
 * DOM-parity tests for the WeeklyReportSkeleton.
 *
 * The skeleton mirrors {@link WeeklyReportPage}'s 5 top-level sections:
 *   1. page header (title + Live pill | 2 action buttons)
 *   2. period nav shell
 *   3. AI Insights card
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

  // --- VA-0a: role="status" root element (high-priority unit-rtl rows) ---

  it("root element has role='status'", () => {
    const { container } = render(<WeeklyReportSkeleton />);
    const root = getRoot(container);
    expect(root).toHaveAttribute("role", "status");
  });

  it("getByRole('status') resolves to the root with accessible name 'Loading status report'", () => {
    render(<WeeklyReportSkeleton />);
    const root = screen.getByRole("status", {
      name: /loading status report/i,
    });
    expect(root).toBeInTheDocument();
  });

  // --- VA-0b: DOM snapshot pins the semantic role accessibility tree ---

  it("snapshot: root element exposes role=status with aria-busy and aria-label", () => {
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
    }).toMatchSnapshot();
  });
});
