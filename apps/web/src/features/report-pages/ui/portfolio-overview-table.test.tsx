// GridIcon is aria-hidden so "Portfolio Overview" is the sole accessible label.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  LeadOverviewRow,
  WeeklyPortfolioProduct,
} from "../../report-sections";
import { PortfolioOverviewTable } from "./portfolio-overview-table";

const NOOP_NAVIGATE = () => undefined;

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
      <PortfolioOverviewTable
        products={ONE_PRODUCT}
        onNavigate={NOOP_NAVIGATE}
      />,
    );
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
    const gridIcon = svgs[0];
    expect(gridIcon).toHaveAttribute("aria-hidden", "true");
  });

  it("'Portfolio Overview' text is readable by screen reader without SVG announcement", () => {
    render(
      <PortfolioOverviewTable
        products={ONE_PRODUCT}
        onNavigate={NOOP_NAVIGATE}
      />,
    );
    const heading = screen.getByText("Portfolio Overview");
    expect(heading).toBeInTheDocument();
    const ariaHiddenUpTheTree = ancestorChain(heading).map((node) =>
      node.getAttribute("aria-hidden"),
    );
    expect(ariaHiddenUpTheTree).not.toContain("true");
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
        onNavigate={NOOP_NAVIGATE}
      />,
    );

    expect(screen.getByText("Leads Overview")).toBeInTheDocument();
    expect(screen.getByText("2 leads")).toBeInTheDocument();
    expect(screen.getByText("Anna")).toBeInTheDocument();
    expect(screen.getByText("Boris")).toBeInTheDocument();
    // Product-scope heading is absent.
    expect(screen.queryByText("Portfolio Overview")).toBeNull();
  });

  it("renders an empty lead status as No status instead of On Track", () => {
    render(
      <PortfolioOverviewTable
        scope="lead"
        leads={[makeLeadRow({ worstStatus: "empty" })]}
        onNavigate={NOOP_NAVIGATE}
      />,
    );

    expect(screen.getByText("No status")).toBeInTheDocument();
    expect(screen.queryByText("On Track")).toBeNull();
  });

  it("by-product scope still renders the product heading (unchanged)", () => {
    render(
      <PortfolioOverviewTable
        products={[makeProduct()]}
        onNavigate={NOOP_NAVIGATE}
      />,
    );
    expect(screen.getByText("Portfolio Overview")).toBeInTheDocument();
    // Singular unit when there is exactly one (scope-adaptive copy).
    expect(screen.getByText("1 product")).toBeInTheDocument();
  });

  it("renders empty product status with a neutral surface and explicit label", () => {
    render(
      <PortfolioOverviewTable
        products={[
          makeProduct({
            currentWeekCount: 1,
            status: "empty",
            statusLabel: "No status",
          }),
        ]}
        onNavigate={NOOP_NAVIGATE}
      />,
    );

    expect(screen.getByText("No status")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveStyle({
      background: "var(--color-surface-muted)",
    });
  });

  it("renders lead cards in the order given (the mapper pre-sorts them)", () => {
    render(
      <PortfolioOverviewTable
        scope="lead"
        leads={[
          makeLeadRow({ id: "L1", name: "Zoe" }),
          makeLeadRow({ id: "L2", name: "Amir" }),
        ]}
        onNavigate={NOOP_NAVIGATE}
      />,
    );
    const names = screen
      .getAllByRole("button")
      .map((b) => b.querySelector(".truncate")?.textContent);
    expect(names).toEqual(["Zoe", "Amir"]);
  });

  it("a lead card click lifts the lead id to the report surface, never poking the DOM", () => {
    const onNavigate = vi.fn();
    // Regression: the old handler reached into the section DOM by id; a click
    // must now surface the target through React state only.
    const section = document.createElement("section");
    section.id = "report-lead-L1";
    section.tabIndex = -1;
    document.body.append(section);
    const scrollSpy = vi.fn();
    section.scrollIntoView = scrollSpy;

    render(
      <PortfolioOverviewTable
        scope="lead"
        leads={[makeLeadRow({ id: "L1", name: "Anna" })]}
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByText("Anna"));
    expect(onNavigate).toHaveBeenCalledWith("L1");
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("a product card click lifts the product id to the report surface", () => {
    const onNavigate = vi.fn();
    render(
      <PortfolioOverviewTable
        products={[makeProduct({ id: "p1" })]}
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByText("Product Alpha"));
    expect(onNavigate).toHaveBeenCalledWith("p1");
  });
});
