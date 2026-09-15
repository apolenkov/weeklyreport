import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../../../test-utils/expect-defined.js";
import type {
  WeeklyProductReport,
  WeeklyReportDecision,
  WeeklyReportItem,
  WeeklyReportRisk,
} from "../../../report-sections";
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

  it("does not render a TOP PRIORITIES section even when priorities data is present", () => {
    render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [makeItem({ id: "c1" })],
          priorities: [
            { id: "priority-1", rank: 1, text: "Legacy priority entry" },
          ],
        })}
      />,
    );

    expect(screen.queryByText("Top Priorities")).not.toBeInTheDocument();
    expect(screen.queryByText("Legacy priority entry")).not.toBeInTheDocument();
  });
});

describe("ProductAccordion — item status badge", () => {
  it("renders a next commitment, cancellation reason, and expandable outcome audit", () => {
    render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          currentWeek: [
            makeItem({
              id: "continued",
              text: "Delivered API endpoints",
              nextStepText: "Validate production metrics",
            }),
            makeItem({
              id: "cancelled",
              text: "Migrate the legacy client",
              resolution: {
                kind: "wont_do",
                eventId: "10000000-0000-4000-8000-000000000101",
                reason: "The dependency was retired",
                actorId: "10000000-0000-4000-8000-000000000102",
                actorName: "Alex Lead",
                occurredAt: "2026-09-05T08:30:00.000Z",
                previousState: {
                  type: "next",
                  workflowStatus: "planned",
                  pausedReason: null,
                  nextStepText: null,
                  text: null,
                },
              },
              outcomeHistory: [
                {
                  id: "10000000-0000-4000-8000-000000000103",
                  stableId: "10000000-0000-4000-8000-000000000104",
                  outcome: "wont_do",
                  reason: "The dependency was retired",
                  actorId: "10000000-0000-4000-8000-000000000102",
                  actorName: "Alex Lead",
                  occurredAt: "2026-09-05T08:30:00.000Z",
                  beforeState: {
                    type: "next",
                    workflowStatus: "planned",
                    pausedReason: null,
                    nextStepText: null,
                    text: null,
                  },
                  afterState: {
                    type: "next",
                    workflowStatus: "planned",
                    pausedReason: null,
                    nextStepText: null,
                    text: null,
                  },
                  reversesEventId: null,
                },
              ],
            }),
          ],
        })}
      />,
    );

    expect(
      screen.getByText("Next commitment: Validate production metrics"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Won't do: The dependency was retired"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("In Progress")).toHaveLength(1);

    fireEvent.click(screen.getByText("Outcome history"));
    expect(
      screen.getByText(
        /Marked Won't do by Alex Lead.*The dependency was retired/,
      ),
    ).toBeInTheDocument();
  });

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

describe("ProductAccordion — header status tone", () => {
  it("uses the readable on-track text token for the label and dot", () => {
    render(
      <ProductAccordion
        defaultOpen
        report={makeReport({
          status: "on-track",
          statusLabel: "On track",
          currentWeek: [makeItem({ id: "c1" })],
        })}
      />,
    );

    const statusLabel = screen.getByText("On track");
    expect(statusLabel).toHaveStyle({
      color: "var(--color-chip-on-track-text)",
    });
    expect(statusLabel.querySelector("span")).toHaveStyle({
      background: "var(--color-chip-on-track-text)",
    });
  });
});

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

describe("ProductAccordion — ChevronDown SVG aria-hidden", () => {
  it("ChevronDown svg has aria-hidden=true when accordion has content", () => {
    const { container } = render(
      <ProductAccordion report={reportWithContent} />,
    );
    const button = container.querySelector("button");
    const svg = button?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("motion-reduce:transition-none");
  });
});

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
    expect(gridDiv).toHaveClass("motion-reduce:transition-none");
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

describe("ProductAccordion — accessible disclosure", () => {
  it("links the content toggle to a labelled region and makes collapsed content inert", () => {
    render(<ProductAccordion report={reportWithContent} />);

    const toggle = screen.getByRole("button", { name: /Product Alpha/ });
    expect(toggle).toHaveAttribute("id", "report-product-p1-toggle");
    expect(toggle).toHaveAttribute("aria-controls", "report-product-p1-panel");
    expect(toggle).toHaveClass("motion-reduce:transition-none");

    const panel = screen.getByRole("region", { hidden: true });
    expect(panel).toHaveAttribute("id", "report-product-p1-panel");
    expect(panel).toHaveAttribute(
      "aria-labelledby",
      "report-product-p1-toggle",
    );
    expect(panel.firstElementChild).toHaveAttribute("inert");
    expect(panel.firstElementChild).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(panel.firstElementChild).not.toHaveAttribute("inert");
    expect(panel.firstElementChild).toHaveAttribute("aria-hidden", "false");
  });

  it("does not expose a dangling disclosure relationship for an empty report", () => {
    render(<ProductAccordion report={makeReport()} />);

    const toggle = screen.getByRole("button", { name: /Product Alpha/ });
    expect(toggle).toBeDisabled();
    expect(toggle).not.toHaveAttribute("id");
    expect(toggle).not.toHaveAttribute("aria-controls");
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });

  it("disables the card-surface transition when reduced motion is requested", () => {
    const { container } = render(
      <ProductAccordion report={reportWithContent} />,
    );
    expect(container.firstElementChild).toHaveClass(
      "motion-reduce:transition-none",
    );
  });
});

describe("ProductAccordion — highlighted scroll motion", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each([
    { mediaPreference: "reduce", matchMediaMatches: true, behavior: "auto" },
    {
      mediaPreference: "no preference",
      matchMediaMatches: false,
      behavior: "smooth",
    },
    {
      mediaPreference: "unavailable",
      matchMediaMatches: undefined,
      behavior: "smooth",
    },
  ] as const)(
    "uses $behavior scrolling when matchMedia is $mediaPreference",
    ({ matchMediaMatches, behavior }) => {
      vi.useFakeTimers();
      vi.stubGlobal(
        "matchMedia",
        matchMediaMatches === undefined
          ? undefined
          : vi.fn().mockReturnValue({ matches: matchMediaMatches }),
      );
      const scrollIntoView = vi.fn();
      const report = makeReport({
        id: "scroll-target",
        currentWeek: [makeItem({ id: "c1" })],
      });

      const { container } = render(
        <ProductAccordion
          report={report}
          instanceRootId="report-lead-lead-2-product-scroll-target"
          highlighted
          scrollIntoViewOnHighlight
        />,
      );
      const root = container.querySelector<HTMLElement>(
        "#report-lead-lead-2-product-scroll-target",
      );
      if (!root) throw new Error("Product accordion root was not rendered");
      root.scrollIntoView = scrollIntoView;

      vi.runAllTimers();

      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior,
        block: "start",
      });
    },
  );

  it("keeps a manual collapse until the next explicit navigation", () => {
    const { rerender } = render(
      <ProductAccordion
        report={reportWithContent}
        highlighted
        navigationEpoch={1}
      />,
    );
    const toggle = screen.getByRole("button", { name: /Product Alpha/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    rerender(
      <ProductAccordion
        report={{ ...reportWithContent }}
        highlighted
        navigationEpoch={1}
      />,
    );
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    rerender(
      <ProductAccordion
        report={{ ...reportWithContent }}
        highlighted
        navigationEpoch={2}
      />,
    );
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});

// Escalation folds into Risks & Blockers as a leading row, not a separate banner.
describe("ProductAccordion — escalation folds into Risks", () => {
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
