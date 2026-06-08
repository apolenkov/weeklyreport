/**
 * VA-0a / VA-0b regression catalog — PortfolioOverviewTable
 *
 * Source change: aria-hidden="true" added to GridIcon SVG so the decorative
 * grid icon is hidden from screen readers and the "Portfolio Overview" heading
 * text is the sole accessible label for that region.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PortfolioProduct } from "../dashboard/mock-data";
import { PortfolioOverviewTable } from "./portfolio-overview-table";

function makeProduct(overrides?: Partial<PortfolioProduct>): PortfolioProduct {
  return {
    id: "p1",
    initials: "PA",
    name: "Product Alpha",
    status: "on-track",
    statusLabel: "On track",
    leads: "Alice",
    currentWeekCount: 2,
    nextWeekCount: 1,
    riskCount: 0,
    ...overrides,
  };
}

const ONE_PRODUCT = [makeProduct()];

describe("PortfolioOverviewTable — VA-0a/VA-0b a11y regression", () => {
  it("GridIcon SVG has aria-hidden='true'", () => {
    const { container } = render(
      <PortfolioOverviewTable products={ONE_PRODUCT} />,
    );
    // The GridIcon is the only SVG in the header area; it must be hidden from AT.
    const svgs = container.querySelectorAll("svg");
    // At least one SVG renders (the GridIcon).
    expect(svgs.length).toBeGreaterThan(0);
    const gridIcon = svgs[0];
    expect(gridIcon).toHaveAttribute("aria-hidden", "true");
  });

  it("GridIcon SVG is not accessible to screen readers (excluded from a11y tree)", () => {
    render(<PortfolioOverviewTable products={ONE_PRODUCT} />);
    // aria-hidden="true" means the SVG should not appear in role queries.
    // An SVG with role "img" (or any presentational role) and aria-hidden
    // must not be returned by getByRole.
    const svgImages = screen.queryAllByRole("img");
    // None of the SVGs should be exposed as an accessible image.
    expect(svgImages).toHaveLength(0);
    // The SVG must not be reachable by any accessible text query either.
    const graphicElements = screen.queryAllByRole("graphics-symbol");
    expect(graphicElements).toHaveLength(0);
  });

  it("'Portfolio Overview' text is readable by screen reader without SVG announcement", () => {
    render(<PortfolioOverviewTable products={ONE_PRODUCT} />);
    // The heading text is reachable directly — no aria-hidden ancestor blocks it.
    const heading = screen.getByText("Portfolio Overview");
    expect(heading).toBeInTheDocument();
    // The text node must not be inside an aria-hidden subtree.
    // Walk up to verify no ancestor has aria-hidden="true".
    let node: HTMLElement | null = heading;
    while (node) {
      expect(node.getAttribute("aria-hidden")).not.toBe("true");
      node = node.parentElement;
    }
  });

  it("GridIcon visual rendering: svg has 4 rect children with correct viewBox (snapshot)", () => {
    const { container } = render(
      <PortfolioOverviewTable products={ONE_PRODUCT} />,
    );
    const gridIconSvg = container.querySelector("svg");
    expect(gridIconSvg).not.toBeNull();
    expect(gridIconSvg?.getAttribute("viewBox")).toBe("0 0 24 24");
    const rects = gridIconSvg?.querySelectorAll("rect");
    expect(rects).toHaveLength(4);
    expect(gridIconSvg).toMatchSnapshot();
  });
});
