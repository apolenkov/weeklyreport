import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { LeadReviewFeedback } from "../../review";
import type { StatusOverviewItem } from "../model/status-overview";
import type { StatusOverviewLineageRow } from "../model/status-overview-lineage";
import {
  LineageRowList,
  MobilePeriodsSummary,
} from "./status-overview-lineage-row";

const periods = {
  previouslyPlanned: "24–30 Aug 2026",
  currentWeek: "31 Aug–6 Sep 2026",
  nextWeek: "7–13 Sep 2026",
};

function row(
  index: number,
  overrides: Partial<StatusOverviewItem> = {},
): StatusOverviewLineageRow {
  const item: StatusOverviewItem = {
    key: `current:${String(index)}`,
    recordId: String(index),
    stableId: String(index),
    source: "current",
    editTarget: null,
    text: `Update ${String(index)}`,
    tag: "delivery",
    stageNames: ["Development"],
    pausedReason: null,
    resolution: null,
    outcomeHistory: [],
    comments: [],
    canResolve: false,
    canRestore: false,
    workflowStatus: "in_progress",
    continuity: null,
    ...overrides,
  };
  return {
    key: item.key,
    current: item,
    stableId: null,
    priorCommitment: null,
    answerState: null,
    last: null,
    next: null,
    previousParent: null,
  };
}

function Rows({
  rows = [row(1), row(2), row(3)],
  onAddItem,
}: {
  readonly rows?: readonly StatusOverviewLineageRow[];
  readonly onAddItem?: (target: {
    readonly source: "current" | "next";
    readonly unitKind: "product" | "activity";
    readonly unitId: string;
  }) => void;
}) {
  return (
    <LineageRowList
      rows={rows}
      expanded={false}
      editorSlot={undefined}
      handlers={{ onAddItem }}
    />
  );
}

describe("mobile lineage layout", () => {
  it("anchors feedback only to the commented occurrence, not its derived Next projection", () => {
    const current = row(1);
    if (!current.current) throw new Error("Expected a current item");
    const comments = [
      {
        id: "comment-1",
        reviewerId: "head-1",
        reviewerName: "Head",
        text: "Clarify this update.",
        createdAt: new Date("2026-09-05T08:00:00Z"),
      },
    ];
    const { container } = render(
      <Rows
        rows={[
          {
            ...current,
            current: { ...current.current, comments },
            next: {
              ...current.current,
              source: "next",
              key: "next:1",
              comments: [],
            },
          },
        ]}
      />,
    );
    const targets = container.querySelectorAll('[id="review-record:item:1"]');
    expect(targets).toHaveLength(1);
    expect(targets[0]).toHaveAttribute("data-overview-item-preview");
    expect(targets[0]).toHaveAttribute("tabindex", "-1");
  });

  it("places all dates in one shared three-column strip, not three stacked rows", () => {
    render(<MobilePeriodsSummary periods={periods} />);
    const summary = screen.getByRole("group", { name: "Reporting periods" });
    expect(summary).toBe(screen.getByTestId("overview-mobile-periods"));
    for (const label of ["Last week", "This week", "Next week"]) {
      const heading = within(summary).getByText(label);
      expect(heading).not.toHaveClass("sr-only");
      expect(heading).toHaveClass("block", "text-xs");
      expect(heading.nextElementSibling).toHaveTextContent(/2026/);
    }
    expect(summary).toHaveClass("grid", "grid-cols-3", "md:hidden");
    expect(summary.children).toHaveLength(3);
    for (const period of Object.values(periods)) {
      expect(within(summary).getByText(period)).toBeInTheDocument();
    }
  });

  it("reveals a collapsed Previous row on mobile before focusing its record", async () => {
    const user = userEvent.setup();
    const current = row(3).current;
    if (!current) throw new Error("Expected an item");
    const comments = [
      {
        id: "note-1",
        reviewerId: "head-1",
        reviewerName: "Head",
        text: "Clarify the prior plan.",
        createdAt: new Date("2026-09-05T08:00:00Z"),
      },
    ];
    const previous = {
      ...current,
      source: "previous" as const,
      key: "previous:3",
      text: "Prior plan",
      comments,
    };
    function Harness() {
      const [expanded, setExpanded] = useState(false);
      return (
        <>
          <LeadReviewFeedback
            records={[
              {
                id: "3",
                kind: "item",
                text: "Prior plan",
                productName: "Product",
                comments,
              },
            ]}
            reviews={[]}
          />
          <article id="previous-rows">
            <LineageRowList
              rows={[
                row(1),
                row(2),
                {
                  key: "previous:3",
                  stableId: null,
                  priorCommitment: null,
                  answerState: null,
                  last: previous,
                  current: null,
                  next: null,
                  previousParent: null,
                },
              ]}
              expanded={expanded}
              editorSlot={undefined}
              handlers={{}}
            />
            <button
              aria-expanded={expanded}
              aria-controls="previous-rows"
              onClick={() => setExpanded(!expanded)}
            >
              Show previous rows
            </button>
          </article>
        </>
      );
    }
    render(<Harness />);
    const prior = screen.getByText("Prior plan", { selector: "span" });
    expect(prior.closest("[inert]")).not.toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Show previous rows" }),
    );
    expect(prior.closest("[inert]")).toBeNull();
    expect(prior.closest("button")).toBeNull();
  });

  it("retains unavailable-period context only in the shared strip", () => {
    render(
      <MobilePeriodsSummary
        periods={{ ...periods, previouslyPlanned: null }}
      />,
    );
    expect(screen.getByText("Period unavailable")).toBeInTheDocument();
  });

  it("keeps only the column name inside a populated compact cell", () => {
    const { container } = render(<Rows />);
    const lane = container.querySelector(
      '[data-overview-lineage-lane="current"]',
    );
    expect(lane).toHaveAttribute(
      "aria-labelledby",
      "status-overview-current-week-heading",
    );
    expect(lane).toHaveClass("py-1", "md:py-3");
    for (const period of Object.values(periods)) {
      expect(screen.queryByText(period)).not.toBeInTheDocument();
    }
  });

  it("shows one empty-period hint per unit, outside its rows, including hidden previews", () => {
    const { container } = render(<Rows />);
    expect(screen.queryByText("No items in other periods")).toBeNull();
    const items = container.querySelectorAll("li");
    expect(items[2]).toHaveAttribute("hidden");
    expect(items[2]).toHaveAttribute("inert");
    expect(
      container.querySelector('[data-overview-lineage-lane="previous"]'),
    ).toHaveClass("overview-empty-lane");
  });

  it("does not claim missing periods when all three occurrences exist", () => {
    const current = row(1);
    render(
      <Rows
        rows={[{ ...current, last: current.current, next: current.current }]}
      />,
    );
    expect(
      screen.queryByText("No items in other periods"),
    ).not.toBeInTheDocument();
  });
});

describe("timeline lanes", () => {
  function lane(container: HTMLElement, source: string): HTMLElement {
    const element = [
      ...container.querySelectorAll<HTMLElement>(
        "[data-overview-lineage-lane]",
      ),
    ].find((candidate) => candidate.dataset.overviewLineageLane === source);
    if (!element) throw new Error(`Expected a ${source} lane`);
    return element;
  }

  it("offers no creation control in any lane, even with an add handler", () => {
    const { container } = render(
      <Rows
        rows={[row(1, { text: "Ship the importer" })]}
        onAddItem={vi.fn()}
      />,
    );

    // The unit header's Add item is the only creation entry point.
    for (const source of ["previous", "current", "next"]) {
      expect(
        within(lane(container, source)).queryByRole("button", {
          name: /^Add /,
        }),
      ).not.toBeInTheDocument();
    }
    expect(
      container.querySelectorAll("[data-overview-create-origin]"),
    ).toHaveLength(0);
  });

  it("keeps the dash and screen-reader emptiness in an empty lane", () => {
    const { container } = render(<Rows onAddItem={vi.fn()} />);
    const nextLane = lane(container, "next");

    expect(within(nextLane).getByText("—")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(within(nextLane).getByText("No entry in Next week")).toHaveClass(
      "sr-only",
    );
    // Empty lanes stay collapsed on mobile; the unit header owns creation.
    expect(nextLane).toHaveClass("overview-empty-lane");
  });

  it("omits leading left border on the first timeline cell at md breakpoint (C3013)", () => {
    const { container } = render(<Rows rows={[row(1)]} />);
    const lanes = container.querySelectorAll("[data-overview-lineage-lane]");
    expect(lanes).toHaveLength(3);
    // First column: Previously planned (previous) is an EmptyLane in this row
    expect(lanes[0]).toHaveClass("first:md:border-l-0");
    // Second and third columns: Current (populated) and Next (empty) keep md:border-l
    expect(lanes[1]).toHaveClass("md:border-l");
    expect(lanes[2]).toHaveClass("md:border-l");
  });
});
