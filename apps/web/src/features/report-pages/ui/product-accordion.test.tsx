/**
 * head-report-accordion-redesign (user sign-off 2026-06-23): the product card
 * body is the uniform "Editorial Gutter" grid — every row (item / risk /
 * decision) shares one column grid (priority | rail | stage+owner gutter |
 * content | status badge), so stage labels and content share one left edge.
 *
 * Contract covered here:
 * - prioritized items sort first and carry a gold rank mark in the rank column
 *   (duplicate ranks render without React key warnings; rows key on item.id);
 * - workflow status reads from a right-side status BADGE (report-card-clarity:
 *   the stage gutter stays an identity surface, never a status fill);
 * - owner initials render on item, risk, AND decision rows;
 * - risks render structured Impact / Mitigation;
 * - ChevronDown aria-hidden + rotation + accordion expand/collapse grid;
 * - Needs Attention dedup against a rendered item.
 */
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../test-utils/expect-defined.js";
import type {
  WeeklyProductReport,
  WeeklyReportDecision,
  WeeklyReportItem,
  WeeklyReportRisk,
} from "../../report-sections";
import { ProductAccordion } from "./product-accordion";

function makeReport(
  overrides?: Partial<WeeklyProductReport>,
): WeeklyProductReport {
  return {
    id: "p1",
    authorIds: ["author-1"],
    initials: "PA",
    name: "Product Alpha",
    status: "on-track",
    statusLabel: "On track",
    leads: "Alice",
    currentWeek: [],
    nextWeek: [],
    risks: [],
    decisions: [],
    priorities: [],
    ...overrides,
  };
}

function makeItem(
  overrides: Partial<WeeklyReportItem> & { id: string },
): WeeklyReportItem {
  return {
    stageLead: "Dev · AL",
    stage: "Development",
    owner: "AL",
    text: `Item ${overrides.id}`,
    status: "in-progress",
    ...overrides,
  };
}

function makeRisk(
  overrides: Partial<WeeklyReportRisk> & { id: string },
): WeeklyReportRisk {
  return {
    badge: "Product Alpha · Development",
    stage: "Development",
    owner: "AL",
    severity: "at-risk",
    text: "Problem — Impact: I — Mitigation: M",
    problem: "Problem",
    impact: "I",
    mitigation: "M",
    ...overrides,
  };
}

function makeDecision(
  overrides: Partial<WeeklyReportDecision> & { id: string },
): WeeklyReportDecision {
  return {
    badge: "Product Alpha",
    owner: "AL",
    text: `Decision ${overrides.id}`,
    ...overrides,
  };
}

/** Report with at least one content item so hasContent=true and ChevronDown renders. */
const reportWithContent = makeReport({
  currentWeek: [makeItem({ id: "c1", text: "Ship it", priorityRank: 1 })],
});

const itemRows = (container: HTMLElement) => [
  ...container.querySelectorAll('[data-accordion-row="item"]'),
];

describe("ProductAccordion prioritized items", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders duplicate-rank prioritized items without a React key warning", () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [
            makeItem({ id: "a", text: "First priority", priorityRank: 1 }),
            makeItem({ id: "b", text: "Second priority", priorityRank: 1 }),
            makeItem({ id: "c", text: "Third priority", priorityRank: 2 }),
          ],
        })}
      />,
    );

    expect(screen.getByText("First priority")).toBeInTheDocument();
    expect(screen.getByText("Second priority")).toBeInTheDocument();
    expect(screen.getByText("Third priority")).toBeInTheDocument();

    const sameKeyWarning = errorSpy.mock.calls.find((call) =>
      call.some((arg) => String(arg).includes("same key")),
    );
    expect(sameKeyWarning).toBeUndefined();
  });

  it("sorts prioritized items first (rank asc), unranked keep their order", () => {
    const { container } = render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [
            makeItem({ id: "u1", text: "Unranked one" }),
            makeItem({ id: "r2", text: "Rank two", priorityRank: 2 }),
            makeItem({ id: "r1", text: "Rank one", priorityRank: 1 }),
            makeItem({ id: "u2", text: "Unranked two" }),
          ],
        })}
      />,
    );

    const texts = itemRows(container).map((row) => row.textContent);
    expect(texts[0]).toContain("Rank one");
    expect(texts[1]).toContain("Rank two");
    expect(texts[2]).toContain("Unranked one");
    expect(texts[3]).toContain("Unranked two");
  });

  it("prioritized item carries a gold rank mark; unranked items carry none", () => {
    render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [
            makeItem({ id: "r1", text: "Ranked", priorityRank: 1 }),
            makeItem({ id: "u1", text: "Unranked" }),
          ],
        })}
      />,
    );

    expect(screen.getByTitle("Priority 1")).toHaveTextContent("1");
    expect(screen.queryByTitle("Priority 2")).not.toBeInTheDocument();
  });

  it("renders a rank mark per priority (several priorities scale)", () => {
    render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [
            makeItem({ id: "r1", text: "One", priorityRank: 1 }),
            makeItem({ id: "r2", text: "Two", priorityRank: 2 }),
          ],
        })}
      />,
    );
    expect(screen.getByTitle("Priority 1")).toHaveTextContent("1");
    expect(screen.getByTitle("Priority 2")).toHaveTextContent("2");
  });

  it("pluralizes the Current Week count: '1 item' at one, 'N items' otherwise", () => {
    const { rerender } = render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [makeItem({ id: "c1", text: "Only item" })],
        })}
      />,
    );
    expect(screen.getByText("Current Week")).toBeInTheDocument();
    expect(screen.getByText("1 item")).toBeInTheDocument();

    rerender(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [
            makeItem({ id: "c1", text: "First" }),
            makeItem({ id: "c2", text: "Second" }),
          ],
        })}
      />,
    );
    expect(screen.getByText("2 items")).toBeInTheDocument();
  });

  it("does not render the removed TOP PRIORITIES section even when priorities data is present", () => {
    render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [makeItem({ id: "c1" })],
          priorities: [{ rank: 1, text: "Legacy priority entry" }],
        })}
      />,
    );

    expect(screen.queryByText("Top Priorities")).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy priority entry")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Status badge: workflow status reads from a right-side badge, not the gutter.
// ---------------------------------------------------------------------------

describe("ProductAccordion — item status badge", () => {
  it("maps each workflow status to its badge label", () => {
    render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [
            makeItem({ id: "b", text: "B", status: "blocked" }),
            makeItem({ id: "p", text: "P", status: "in-progress" }),
            makeItem({ id: "d", text: "D", status: "completed" }),
          ],
          nextWeek: [makeItem({ id: "n", text: "N", status: "planned" })],
        })}
      />,
    );
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Planned")).toBeInTheDocument();
  });

  it("blocked item gets a red rail; non-blocked gets a neutral rail", () => {
    const { container } = render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [
            makeItem({ id: "b", text: "Blocked one", status: "blocked" }),
            makeItem({ id: "p", text: "Progress one", status: "in-progress" }),
          ],
        })}
      />,
    );
    const railTone = (rowText: string) => {
      const row = itemRows(container).find((r) =>
        r.textContent.includes(rowText),
      );
      // the rail is the row's second grid cell (rank | RAIL | gutter | …)
      const rail = row?.children[1] as HTMLElement | undefined;
      return rail?.getAttribute("style") ?? "";
    };
    expect(railTone("Blocked one")).toContain("var(--color-destructive)");
    expect(railTone("Progress one")).toContain("var(--color-border)");
  });

  it("the stage gutter is identity-only: no status label leaks into it", () => {
    const { container } = render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [
            makeItem({
              id: "x",
              text: "Work text",
              stage: "Development",
              owner: "AL",
              status: "blocked",
            }),
          ],
        })}
      />,
    );
    const row = expectDefined(itemRows(container)[0]);
    // the gutter (3rd cell) names the stage + owner, never the status word
    const gutter = row.children[2] as HTMLElement | undefined;
    expect(gutter?.textContent).toContain("Development");
    expect(gutter?.textContent).toContain("AL");
    expect(gutter?.textContent).not.toContain("Blocked");
  });
});

// ---------------------------------------------------------------------------
// Owner initials render on every content row.
// ---------------------------------------------------------------------------

describe("ProductAccordion — owner initials on every row", () => {
  it("renders owner initials on item, risk, and decision rows", () => {
    render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [makeItem({ id: "c1", text: "Item", owner: "II" })],
          nextWeek: [makeItem({ id: "n1", text: "Next", owner: "NN" })],
          risks: [makeRisk({ id: "k1", owner: "RR" })],
          decisions: [makeDecision({ id: "d1", owner: "DD" })],
        })}
      />,
    );
    expect(screen.getByText("II")).toBeInTheDocument();
    expect(screen.getByText("NN")).toBeInTheDocument();
    expect(screen.getByText("RR")).toBeInTheDocument();
    expect(screen.getByText("DD")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Risks render structured Impact / Mitigation, not a run-on string.
// ---------------------------------------------------------------------------

describe("ProductAccordion — structured risk row", () => {
  it("renders problem, Impact and Mitigation as separate fields", () => {
    render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          risks: [
            makeRisk({
              id: "k1",
              stage: "DevOps",
              owner: "IV",
              problem: "Cluster capacity not allocated",
              impact: "Release slips a week",
              mitigation: "Raise an infra ticket",
            }),
          ],
        })}
      />,
    );
    expect(
      screen.getByText("Cluster capacity not allocated"),
    ).toBeInTheDocument();
    expect(screen.getByText("Impact")).toBeInTheDocument();
    expect(screen.getByText("Release slips a week")).toBeInTheDocument();
    expect(screen.getByText("Mitigation")).toBeInTheDocument();
    expect(screen.getByText("Raise an infra ticket")).toBeInTheDocument();
    // gutter shows stage + owner
    expect(screen.getByText("DevOps")).toBeInTheDocument();
    expect(screen.getByText("IV")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// ChevronDown SVG aria-hidden
// ---------------------------------------------------------------------------

describe("ProductAccordion — ChevronDown SVG aria-hidden", () => {
  it("ChevronDown svg has aria-hidden=true when accordion has content", () => {
    const { container } = render(
      <ProductAccordion report={reportWithContent} />,
    );
    const button = container.querySelector("button");
    const svg = button?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});

// ---------------------------------------------------------------------------
// ChevronDown rotation transform
// ---------------------------------------------------------------------------

describe("ProductAccordion — ChevronDown rotation transform", () => {
  it("svg has rotate(-90deg) when accordion is collapsed (defaultOpen=false)", () => {
    const { container } = render(
      <ProductAccordion report={reportWithContent} defaultOpen={false} />,
    );
    const svg = container.querySelector("button")?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect((svg as SVGElement).style.transform).toBe("rotate(-90deg)");
  });

  it("svg has rotate(0deg) when accordion is expanded (defaultOpen=true)", () => {
    const { container } = render(
      <ProductAccordion report={reportWithContent} defaultOpen={true} />,
    );
    const svg = container.querySelector("button")?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect((svg as SVGElement).style.transform).toBe("rotate(0deg)");
  });
});

// ---------------------------------------------------------------------------
// Accordion expand/collapse grid behavior
// ---------------------------------------------------------------------------

describe("ProductAccordion — expand/collapse grid", () => {
  it("gridTemplateRows=1fr when expanded (defaultOpen=true)", () => {
    const { container } = render(
      <ProductAccordion report={reportWithContent} defaultOpen={true} />,
    );
    const gridDiv = container.querySelector<HTMLElement>(
      "[style*='grid-template-rows']",
    );
    expect(gridDiv).not.toBeNull();
    expect(gridDiv?.style.gridTemplateRows).toBe("1fr");
  });

  it("gridTemplateRows=0fr when collapsed (defaultOpen=false)", () => {
    const { container } = render(
      <ProductAccordion report={reportWithContent} defaultOpen={false} />,
    );
    const gridDiv = container.querySelector<HTMLElement>(
      "[style*='grid-template-rows']",
    );
    expect(gridDiv).not.toBeNull();
    expect(gridDiv?.style.gridTemplateRows).toBe("0fr");
  });
});

// ---------------------------------------------------------------------------
// Needs Attention dedup
// ---------------------------------------------------------------------------

// head-surface-uat-polish (F2): the escalation no longer renders as a separate
// "Needs Attention" banner — it folds into Risks & Blockers as a leading row.
describe("ProductAccordion — escalation folds into Risks (F2)", () => {
  const DUP_TEXT = "Auth refactor blocked: waiting on IdP access";

  it("suppresses the escalation row when its text matches a rendered item", () => {
    const { container } = render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          needsAttention: DUP_TEXT,
          needsAttentionSeverity: "blocked",
          currentWeek: [
            makeItem({ id: "c1", text: DUP_TEXT, status: "blocked" }),
          ],
        })}
      />,
    );
    expect(
      container.querySelector('[data-accordion-row="escalation"]'),
    ).not.toBeInTheDocument();
    // The text shows once — as the item row, not also as an escalation.
    expect(screen.getAllByText(DUP_TEXT)).toHaveLength(1);
  });

  it("suppresses the escalation row when its text matches a rendered risk", () => {
    const RISK_TEXT = "Partner is late delivering the final connector API";
    const { container } = render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          needsAttention: RISK_TEXT,
          needsAttentionSeverity: "at-risk",
          risks: [makeRisk({ id: "k1", problem: RISK_TEXT })],
        })}
      />,
    );
    expect(
      container.querySelector('[data-accordion-row="escalation"]'),
    ).not.toBeInTheDocument();
    // The text shows once — as the risk row, not also as an escalation.
    expect(screen.getAllByText(RISK_TEXT)).toHaveLength(1);
  });

  it("renders a distinct escalation as a leading Risks & Blockers row", () => {
    const { container } = render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          needsAttention: "Blocked · Development · Vasily",
          needsAttentionSeverity: "blocked",
          currentWeek: [
            makeItem({ id: "c1", text: DUP_TEXT, status: "blocked" }),
          ],
        })}
      />,
    );
    // No standalone banner heading anymore.
    expect(screen.queryByText("Needs Attention")).not.toBeInTheDocument();
    // The escalation surfaces inside Risks & Blockers as an escalation row.
    expect(screen.getByText("Risks & Blockers")).toBeInTheDocument();
    const escalationRow = container.querySelector(
      '[data-accordion-row="escalation"]',
    );
    expect(escalationRow).toBeInTheDocument();
    expect(escalationRow).toHaveTextContent("Blocked · Development · Vasily");
  });
});
