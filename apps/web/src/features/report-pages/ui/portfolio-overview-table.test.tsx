// GridIcon is aria-hidden so "Portfolio Overview" is the sole accessible label.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  LeadOverviewRow,
  WeeklyPortfolioProduct,
} from "../../report-sections";
import { PortfolioOverviewTable } from "./portfolio-overview-table";

function makeProduct(
  overrides?: Partial<WeeklyPortfolioProduct>,
): WeeklyPortfolioProduct {
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

function ancestorChain(node: HTMLElement | null): HTMLElement[] {
  return node === null ? [] : [node, ...ancestorChain(node.parentElement)];
}

describe("PortfolioOverviewTable — a11y regression", () => {
  it("GridIcon SVG has aria-hidden='true'", () => {
    const { container } = render(
      <PortfolioOverviewTable products={ONE_PRODUCT} />,
    );
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    const gridIcon = svgs[0];
    expect(gridIcon).toHaveAttribute("aria-hidden", "true");
  });

  it("'Portfolio Overview' text is readable by screen reader without SVG announcement", () => {
    render(<PortfolioOverviewTable products={ONE_PRODUCT} />);
    const heading = screen.getByText("Portfolio Overview");
    expect(heading).toBeInTheDocument();
    const ariaHiddenUpTheTree = ancestorChain(heading).map((node) =>
      node.getAttribute("aria-hidden"),
    );
    expect(ariaHiddenUpTheTree).not.toContain("true");
  });

  it("GridIcon renders the intended four-cell grid", () => {
    const { container } = render(
      <PortfolioOverviewTable products={ONE_PRODUCT} />,
    );
    const gridIconSvg = container.querySelector("svg");
    expect(gridIconSvg).not.toBeNull();
    expect(gridIconSvg?.getAttribute("viewBox")).toBe("0 0 24 24");
    const rects = Array.from(gridIconSvg?.querySelectorAll("rect") ?? []).map(
      (rect) => ({
        x: rect.getAttribute("x"),
        y: rect.getAttribute("y"),
        width: rect.getAttribute("width"),
        height: rect.getAttribute("height"),
      }),
    );
    expect(rects).toEqual([
      { x: "3", y: "3", width: "7", height: "7" },
      { x: "14", y: "3", width: "7", height: "7" },
      { x: "3", y: "14", width: "7", height: "7" },
      { x: "14", y: "14", width: "7", height: "7" },
    ]);
  });
});

// The overview band follows the report scope (by-product vs by-lead).
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
