import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { LeadReviewFeedback } from "../../review";
import type {
  StatusOverviewItem,
  StatusOverviewUnit,
} from "../model/status-overview";
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

function overviewUnit(
  overrides: Partial<StatusOverviewUnit> = {},
): StatusOverviewUnit {
  return {
    key: "product:product-1",
    id: "product-1",
    kind: "product",
    name: "Payments",
    historical: false,
    status: "on-track",
    stages: [],
    linkedProducts: [],
    columns: {
      previouslyPlanned: { availability: "available", items: [] },
      currentWeek: { availability: "available", items: [] },
      nextWeek: { availability: "available", items: [] },
    },
    ...overrides,
  };
}

function Rows({
  rows = [row(1), row(2), row(3)],
  unit = overviewUnit(),
  onAddItem,
}: {
  readonly rows?: readonly StatusOverviewLineageRow[];
  readonly unit?: StatusOverviewUnit;
  readonly onAddItem?: (target: {
    readonly source: "current" | "next";
    readonly unitKind: "product" | "activity";
    readonly unitId: string;
  }) => void;
}) {
  return (
    <LineageRowList
      rows={rows}
      unit={unit}
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
              unit={overviewUnit()}
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

describe("contextual creation in timeline lanes", () => {
  function lane(container: HTMLElement, source: string): HTMLElement {
    const element = [
      ...container.querySelectorAll<HTMLElement>(
        "[data-overview-lineage-lane]",
      ),
    ].find((candidate) => candidate.dataset.overviewLineageLane === source);
    if (!element) throw new Error(`Expected a ${source} lane`);
    return element;
  }

  it("offers only Current and Next creation, never for the previous plan", () => {
    const onAddItem = vi.fn();
    const { container } = render(<Rows onAddItem={onAddItem} />);
    const currentLane = lane(container, "current");
    const nextLane = lane(container, "next");
    const previousLane = lane(container, "previous");

    expect(
      within(currentLane).getByRole("button", {
        name: "Add current week update to Payments",
      }),
    ).toBeInTheDocument();
    expect(
      within(nextLane).getByRole("button", {
        name: "Add next week update to Payments",
      }),
    ).toBeInTheDocument();
    expect(
      within(previousLane).queryByRole("button", {
        name: /Add .* update to Payments/,
      }),
    ).not.toBeInTheDocument();
    expect(within(previousLane).queryByRole("button")).not.toBeInTheDocument();
    // One target per lane, whichever occurrence fills it.
    expect(
      within(currentLane).getAllByRole("button", {
        name: "Add current week update to Payments",
      }),
    ).toHaveLength(1);
    expect(
      within(nextLane).getAllByRole("button", {
        name: "Add next week update to Payments",
      }),
    ).toHaveLength(1);
  });

  it("passes the lane week and the unit through the canonical create handler", async () => {
    const user = userEvent.setup();
    const onAddItem = vi.fn();
    const { container } = render(<Rows onAddItem={onAddItem} />);

    await user.click(
      within(lane(container, "next")).getByRole("button", {
        name: "Add next week update to Payments",
      }),
    );
    expect(onAddItem).toHaveBeenLastCalledWith({
      source: "next",
      unitKind: "product",
      unitId: "product-1",
    });

    await user.click(
      within(lane(container, "current")).getByRole("button", {
        name: "Add current week update to Payments",
      }),
    );
    expect(onAddItem).toHaveBeenLastCalledWith({
      source: "current",
      unitKind: "product",
      unitId: "product-1",
    });
  });

  it("keeps the dash and screen-reader emptiness in a creatable empty lane", () => {
    const { container } = render(<Rows onAddItem={vi.fn()} />);
    const nextLane = lane(container, "next");

    expect(
      within(nextLane).getByRole("button", {
        name: "Add next week update to Payments",
      }),
    ).toBeInTheDocument();
    expect(within(nextLane).getByText("—")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(within(nextLane).getByText("No item in this period")).toHaveClass(
      "sr-only",
    );
    // Empty lanes stay collapsed on mobile; the unit header owns touch creation.
    expect(nextLane).toHaveClass("hidden", "md:flex");
  });

  it("offers both lanes when the row only holds a next-week occurrence", () => {
    const current = row(1).current;
    if (!current) throw new Error("Expected an item");
    const next = { ...current, source: "next" as const, key: "next:1" };
    const { container } = render(
      <Rows
        rows={[
          {
            key: "next:1",
            previous: null,
            current: null,
            next,
            previousParent: null,
          },
        ]}
        onAddItem={vi.fn()}
      />,
    );

    expect(
      within(lane(container, "next")).getByRole("button", {
        name: "Add next week update to Payments",
      }),
    ).toBeInTheDocument();
    expect(
      within(lane(container, "current")).getByRole("button", {
        name: "Add current week update to Payments",
      }),
    ).toBeInTheDocument();
  });

  it("offers no creation control for a historical or read-only unit", () => {
    const { container: historical } = render(
      <Rows unit={overviewUnit({ historical: true })} onAddItem={vi.fn()} />,
    );
    expect(
      historical.querySelectorAll("[data-overview-create-origin]"),
    ).toHaveLength(0);

    const { container: readOnly } = render(<Rows />);
    expect(
      readOnly.querySelectorAll("[data-overview-create-origin]"),
    ).toHaveLength(0);
  });

  it("offers no creation in an unavailable lane", () => {
    const { container } = render(
      <Rows
        unit={overviewUnit({
          columns: {
            previouslyPlanned: { availability: "available", items: [] },
            currentWeek: {
              availability: "unavailable",
              reason: "Period unavailable",
              items: [],
            },
            nextWeek: { availability: "available", items: [] },
          },
        })}
        onAddItem={vi.fn()}
      />,
    );

    expect(
      within(lane(container, "current")).queryByRole("button", {
        name: /Add current week update/,
      }),
    ).not.toBeInTheDocument();
  });
});
