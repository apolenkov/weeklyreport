import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

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

function row(index: number): StatusOverviewLineageRow {
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
  };
  return {
    key: item.key,
    current: item,
    previous: null,
    next: null,
    previousParent: null,
  };
}

function Rows({
  rows = [row(1), row(2), row(3)],
}: {
  readonly rows?: readonly StatusOverviewLineageRow[];
}) {
  return (
    <LineageRowList
      rows={rows}
      expanded={false}
      editorSlot={undefined}
      handlers={{}}
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
    for (const label of ["Previously planned", "Current week", "Next week"]) {
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
                  previous,
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
    const target = document.getElementById("review-record:item:3");
    expect(target?.closest("[hidden][inert]")).not.toBeNull();
    const lane = target?.closest("[data-overview-lineage-lane]");
    expect(lane).toHaveAttribute("data-overview-lineage-lane", "previous");
    expect(lane).toHaveClass("block");
    expect(lane).not.toHaveClass("hidden");
    expect(
      within(lane as HTMLElement).getByText("Previously planned"),
    ).toHaveClass("md:hidden");
    await user.click(screen.getByRole("link", { name: "Prior plan" }));
    await waitFor(() => expect(target).toHaveFocus());
    expect(target?.closest("[hidden], [inert]")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Show previous rows" }),
    ).toHaveAttribute("aria-expanded", "true");
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
    expect(lane).toHaveTextContent("Current week");
    expect(lane).toHaveClass("py-1", "md:py-3");
    for (const period of Object.values(periods)) {
      expect(screen.queryByText(period)).not.toBeInTheDocument();
    }
  });

  it("shows one empty-period hint per unit, outside its rows, including hidden previews", () => {
    const { container } = render(<Rows />);
    const hints = screen.getAllByText("No items in other periods");
    expect(hints).toHaveLength(1);
    expect(hints[0]?.closest("li")).toBeNull();
    expect(hints[0]).toHaveClass("md:hidden");
    const items = container.querySelectorAll("li");
    expect(items[2]).toHaveAttribute("hidden");
    expect(items[2]).toHaveAttribute("inert");
    expect(
      container.querySelector('[data-overview-lineage-lane="previous"]'),
    ).toHaveClass("hidden", "md:flex");
  });

  it("does not claim missing periods when all three occurrences exist", () => {
    const current = row(1);
    render(
      <Rows
        rows={[
          { ...current, previous: current.current, next: current.current },
        ]}
      />,
    );
    expect(
      screen.queryByText("No items in other periods"),
    ).not.toBeInTheDocument();
  });
});
