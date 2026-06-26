/**
 * VA-0a / VA-0b regression catalog — PortfolioOverviewTable
 *
 * Source change: aria-hidden="true" added to GridIcon SVG so the decorative
 * grid icon is hidden from screen readers and the "Portfolio Overview" heading
 * text is the sole accessible label for that region.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { LeadOverviewRow } from "../../lib/mappers";
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

// report-overview-scope-parity: the overview band follows the report scope.
function makeLeadRow(overrides?: Partial<LeadOverviewRow>): LeadOverviewRow {
  return {
    id: "L1",
    name: "Lead One",
    worstStatus: "on-track",
    currentCount: 2,
    nextCount: 1,
    riskCount: 0,
    ...overrides,
  };
}

describe("PortfolioOverviewTable — scope-adaptive (by lead)", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("renders lead cards with a leads heading in lead scope, not product cards", () => {
    render(
      <PortfolioOverviewTable
        scope="lead"
        leads={[
          makeLeadRow({ id: "L1", name: "Anna", worstStatus: "blocked" }),
          makeLeadRow({ id: "L2", name: "Boris", worstStatus: "on-track" }),
        ]}
      />,
    );

    expect(screen.getByText("Leads Overview")).toBeInTheDocument();
    expect(screen.getByText("2 leads")).toBeInTheDocument();
    expect(screen.getByText("Anna")).toBeInTheDocument();
    expect(screen.getByText("Boris")).toBeInTheDocument();
    // Product-scope heading is absent.
    expect(screen.queryByText("Portfolio Overview")).toBeNull();
  });

  it("by-product scope still renders the product heading (unchanged)", () => {
    render(<PortfolioOverviewTable products={[makeProduct()]} />);
    expect(screen.getByText("Portfolio Overview")).toBeInTheDocument();
    // Singular unit when there is exactly one (scope-adaptive copy).
    expect(screen.getByText("1 product")).toBeInTheDocument();
  });

  it("renders lead cards in the order given (the mapper pre-sorts them)", () => {
    render(
      <PortfolioOverviewTable
        scope="lead"
        leads={[
          makeLeadRow({ id: "L1", name: "Zoe" }),
          makeLeadRow({ id: "L2", name: "Amir" }),
        ]}
      />,
    );
    const names = screen
      .getAllByRole("button")
      .map((b) => b.querySelector(".truncate")?.textContent);
    expect(names).toEqual(["Zoe", "Amir"]);
  });

  it("a lead card click scrolls to and focuses report-lead-<id>", () => {
    // The section anchor the page renders for each lead group.
    const section = document.createElement("section");
    section.id = "report-lead-L1";
    section.tabIndex = -1;
    document.body.append(section);
    const scrollSpy = vi.fn();
    const focusSpy = vi.fn();
    section.scrollIntoView = scrollSpy;
    section.focus = focusSpy;

    render(
      <PortfolioOverviewTable
        scope="lead"
        leads={[makeLeadRow({ id: "L1", name: "Anna" })]}
      />,
    );

    fireEvent.click(screen.getByText("Anna"));
    expect(scrollSpy).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    });
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
  });
});
