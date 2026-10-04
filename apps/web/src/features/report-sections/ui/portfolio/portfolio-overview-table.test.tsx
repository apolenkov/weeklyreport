// GridIcon is aria-hidden so "Portfolio Overview" is the sole accessible label.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeWeeklyReportFixture } from "../../../../test-utils/report-section-fixtures";
import { mapWeeklyReport } from "../../model/weekly-report";
import type {
  LeadOverviewRow,
  WeeklyPortfolioProduct,
} from "../../model/weekly-report-types";
import { PortfolioOverviewTable } from "./portfolio-overview-table";

const NOOP_NAVIGATE = () => undefined;

function makeProduct(
  overrides?: Partial<WeeklyPortfolioProduct>,
): WeeklyPortfolioProduct {
  return {
    id: "p1",
    initials: "PA",
    name: "Product Alpha",
    hasContent: true,
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
  it("exposes the loaded overview geometry landmark", () => {
    render(
      <PortfolioOverviewTable
        products={ONE_PRODUCT}
        onNavigate={NOOP_NAVIGATE}
      />,
    );

    expect(
      screen.getByText("Portfolio Overview").closest(".card-surface"),
    ).toHaveAttribute("data-layout-key", "report-overview-band");
  });

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
          makeLeadRow({
            id: "L1",
            name: "Иванова Анна Петровна",
            worstStatus: "blocked",
          }),
          makeLeadRow({
            id: "L2",
            name: "Кузнецов Борис Сергеевич",
            worstStatus: "on-track",
          }),
        ]}
        onNavigate={NOOP_NAVIGATE}
      />,
    );

    expect(screen.getByText("Leads Overview")).toBeInTheDocument();
    expect(screen.getByText("2 leads")).toBeInTheDocument();
    expect(screen.getByText("Иванова А.П.")).toBeInTheDocument();
    expect(screen.getByText("Кузнецов Б.С.")).toBeInTheDocument();
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

  it("keeps a product with no detailed content muted and disabled", () => {
    const onNavigate = vi.fn();
    render(
      <PortfolioOverviewTable
        products={[
          makeProduct({
            hasContent: false,
            currentWeekCount: 0,
            nextWeekCount: 0,
            riskCount: 0,
            status: "empty",
            statusLabel: "No status",
          }),
        ]}
        onNavigate={onNavigate}
      />,
    );

    const card = screen.getByRole("button", { name: /Product Alpha/u });
    expect(card).toBeDisabled();
    expect(card).toHaveTextContent("No updates");
    fireEvent.click(card);
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it("renders lead cards in the order given (the mapper pre-sorts them)", () => {
    render(
      <PortfolioOverviewTable
        scope="lead"
        leads={[
          makeLeadRow({ id: "L1", name: "Зорина Зоя Ильинична" }),
          makeLeadRow({ id: "L2", name: "Андреев Амир Романович" }),
        ]}
        onNavigate={NOOP_NAVIGATE}
      />,
    );
    const names = screen
      .getAllByRole("button")
      .map((b) => b.querySelector(".truncate")?.textContent);
    expect(names).toEqual(["Зорина З.И.", "Андреев А.Р."]);
  });

  it("a lead card click lifts the lead id to the report surface, never poking the DOM", () => {
    const onNavigate = vi.fn();
    // Navigation must surface the target through React state without DOM lookup.
    const section = document.createElement("section");
    section.id = "report-lead-L1";
    section.tabIndex = -1;
    document.body.append(section);
    const scrollSpy = vi.fn();
    section.scrollIntoView = scrollSpy;

    render(
      <PortfolioOverviewTable
        scope="lead"
        leads={[makeLeadRow({ id: "L1", name: "Иванова Анна Петровна" })]}
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByText("Иванова А.П."));
    expect(onNavigate).toHaveBeenCalledWith("L1");
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("a product card click lifts the product id to the report surface", () => {
    const onNavigate = vi.fn();
    render(
      <PortfolioOverviewTable
        products={[makeProduct({ id: "p1" })]}
        mountedProductIds={new Set(["p1"])}
        onNavigate={onNavigate}
      />,
    );

    const card = screen.getByRole("button", { name: /Product Alpha/u });
    expect(card).toHaveAttribute("aria-controls", "report-product-p1");
    fireEvent.click(card);
    expect(onNavigate).toHaveBeenCalledWith("p1");
  });

  it("keeps a decision-only mapped product enabled and navigable", () => {
    const projectId = "10000000-0000-4000-8000-000000000004";
    const authorId = "10000000-0000-4000-8000-000000000003";
    const projected = mapWeeklyReport(
      makeWeeklyReportFixture({
        portfolioOverview: [
          {
            productId: projectId,
            productName: "Payments",
            worstStatus: "green",
            stageCount: 1,
            leadNames: ["Test Lead"],
            leadIds: [authorId],
          },
        ],
        leadSections: [
          {
            authorId,
            projects: [
              {
                projectId,
                projectName: "Payments",
                trafficLight: "green",
                ownedStages: [
                  {
                    stageId: "stage-planning",
                    stageName: "Planning",
                    sortOrder: 0,
                    status: "green",
                  },
                ],
                stageSet: [
                  {
                    stageId: "stage-planning",
                    stageName: "Planning",
                    sortOrder: 0,
                  },
                ],
              },
            ],
            decisions: [
              {
                id: "decision-1",
                productId: projectId,
                text: "Approve fallback",
                owner: "Test Lead",
                impact: "Keep payments live",
                stageNames: ["Planning"],
              },
            ],
          },
        ],
      }),
    );
    expect(
      projected.products[0]?.decisions.map((decision) => decision.text),
    ).toEqual(["Approve fallback"]);
    const onNavigate = vi.fn();
    render(
      <PortfolioOverviewTable
        products={projected.portfolio}
        mountedProductIds={new Set([projectId])}
        onNavigate={onNavigate}
      />,
    );

    const card = screen.getByRole("button", { name: /Payments/u });
    expect(card).toBeEnabled();
    expect(card).not.toHaveTextContent("No updates");
    expect(card).toHaveAttribute(
      "aria-controls",
      `report-product-${projectId}`,
    );
    fireEvent.click(card);
    expect(onNavigate).toHaveBeenCalledWith(projectId);
  });

  it("omits aria-controls until the product details target is mounted", () => {
    const onNavigate = vi.fn();
    render(
      <PortfolioOverviewTable
        products={[makeProduct({ id: "p1" })]}
        mountedProductIds={new Set()}
        onNavigate={onNavigate}
      />,
    );

    const card = screen.getByRole("button", { name: /Product Alpha/u });
    expect(card).not.toHaveAttribute("aria-controls");
    fireEvent.click(card);
    expect(onNavigate).toHaveBeenCalledWith("p1");
  });

  // R25: the overview must say it is not filtered like the Sections list.
  it("states that product status spans all authors regardless of the Sections filter", () => {
    render(
      <PortfolioOverviewTable
        products={ONE_PRODUCT}
        onNavigate={NOOP_NAVIGATE}
      />,
    );

    expect(
      screen.getByText(
        /Status across all authors, whatever the Sections filter shows/,
      ),
    ).toBeInTheDocument();
  });
});
