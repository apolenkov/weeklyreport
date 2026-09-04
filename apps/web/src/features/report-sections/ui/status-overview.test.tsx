import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { StatusOverviewModel } from "../model/status-overview";
import { StatusOverview } from "./status-overview";

function overviewItem(index: number) {
  return {
    key: `current:item-${String(index)}`,
    recordId: `item-${String(index)}`,
    source: "current" as const,
    editTarget: {
      recordId: `item-${String(index)}`,
      source: "current" as const,
    },
    stableId: `item-${String(index)}`,
    text: `Work item ${String(index)}`,
    tag: "delivery",
    workflowStatus: "in_progress" as const,
    continuity: index === 1 ? ("unplanned" as const) : ("continued" as const),
  };
}

const model: StatusOverviewModel = {
  periods: {
    previouslyPlanned: "24–30 Aug 2026",
    currentWeek: "31 Aug–6 Sep 2026",
    nextWeek: "7–13 Sep 2026",
  },
  previousPlanSource: "published",
  sourceCounts: { previouslyPlanned: 0, currentWeek: 5, nextWeek: 0 },
  units: [
    {
      key: "activity:activity-1",
      id: "activity-1",
      kind: "activity",
      name: "Incident duty",
      historical: false,
      status: "blocked",
      stages: [],
      linkedProducts: ["Payments", "Mobile"],
      columns: {
        previouslyPlanned: { availability: "available", items: [] },
        currentWeek: {
          availability: "available",
          items: [1, 2, 3, 4, 5].map(overviewItem),
        },
        nextWeek: { availability: "available", items: [] },
      },
    },
  ],
};

describe("StatusOverview", () => {
  it("renders an explicit empty state when the period has no reporting units", () => {
    render(<StatusOverview model={{ ...model, units: [] }} />);

    expect(
      screen.getByText("No reporting units are available for this period."),
    ).toBeVisible();
  });

  it("shows two previews and expands the remaining items inline accessibly", async () => {
    const user = userEvent.setup();
    render(<StatusOverview model={model} />);

    const disclosure = screen.getByRole("button", { name: "+3 more" });
    const thirdItem = screen.getByText("Work item 3");
    expect(disclosure).toHaveAttribute("aria-expanded", "false");
    expect(disclosure).toHaveAttribute("aria-controls");
    expect(screen.getByText("Work item 1")).toBeVisible();
    expect(screen.getByText("Work item 2")).toBeVisible();
    expect(thirdItem).not.toBeVisible();
    expect(thirdItem.closest("li[hidden]")).toHaveAttribute("inert");
    expect(screen.getByText("+3 more")).toBeVisible();

    await user.click(disclosure);

    expect(disclosure).toHaveAttribute("aria-expanded", "true");
    expect(thirdItem).toBeVisible();
    expect(screen.queryByText("+3 more")).not.toBeInTheDocument();
  });

  it("uses a flat editable row and emits the explicit current-item target", async () => {
    const user = userEvent.setup();
    const onEditItem = vi.fn();
    render(<StatusOverview model={model} onEditItem={onEditItem} />);

    const edit = screen.getByRole("button", { name: "Edit Work item 1" });
    expect(edit).not.toHaveClass("border");
    expect(edit.closest("li")).not.toHaveClass("rounded-[var(--radius-sm)]");

    await user.click(edit);

    expect(onEditItem).toHaveBeenCalledWith({
      recordId: "item-1",
      source: "current",
    });
  });

  it("expands only the column named by each disclosure control", async () => {
    const user = userEvent.setup();
    const baseUnit = model.units[0];
    if (!baseUnit) throw new Error("Expected one overview unit");
    const independentModel: StatusOverviewModel = {
      ...model,
      units: [
        {
          ...baseUnit,
          columns: {
            ...baseUnit.columns,
            nextWeek: {
              availability: "available",
              items: [1, 2, 3].map((index) => ({
                ...overviewItem(index),
                key: `next:item-${String(index)}`,
                recordId: `next-item-${String(index)}`,
                source: "next" as const,
                editTarget: {
                  recordId: `next-item-${String(index)}`,
                  source: "next" as const,
                },
                text: `Next item ${String(index)}`,
              })),
            },
          },
        },
      ],
    };
    render(<StatusOverview model={independentModel} />);

    const nextThird = screen.getByText("Next item 3");
    expect(nextThird).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: "+3 more" }));

    expect(screen.getByText("Work item 3")).toBeVisible();
    expect(nextThird).not.toBeVisible();
    expect(screen.getByRole("button", { name: "+1 more" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("keeps previous and read-only rows non-interactive", () => {
    const baseUnit = model.units[0];
    if (!baseUnit) throw new Error("Expected one overview unit");
    const inertModel: StatusOverviewModel = {
      ...model,
      units: [
        {
          ...baseUnit,
          columns: {
            ...baseUnit.columns,
            previouslyPlanned: {
              availability: "available",
              items: [
                {
                  ...overviewItem(8),
                  key: "previous:item-8",
                  source: "previous",
                  editTarget: null,
                  text: "Immutable prior plan",
                },
              ],
            },
            currentWeek: {
              availability: "available",
              items: [
                {
                  ...overviewItem(9),
                  editTarget: null,
                  text: "Submitted current item",
                },
              ],
            },
          },
        },
      ],
    };
    render(<StatusOverview model={inertModel} onEditItem={vi.fn()} />);

    expect(screen.getByText("Immutable prior plan")).toBeInTheDocument();
    expect(screen.getByText("Submitted current item")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Immutable prior plan/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Submitted current item/i }),
    ).toBeNull();
  });

  it("renders canonical status, linked labels, and all three real period ranges", () => {
    render(<StatusOverview model={model} />);

    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("Products: Payments, Mobile")).toBeInTheDocument();
    expect(screen.getAllByText("24–30 Aug 2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("31 Aug–6 Sep 2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText("7–13 Sep 2026").length).toBeGreaterThan(0);
    expect(screen.getByText("Unplanned")).toBeInTheDocument();
  });

  it("offers one full-report edit action instead of repeating it per row", () => {
    render(<StatusOverview model={model} detailsHref="/report?mode=edit" />);

    expect(
      screen.getAllByRole("link", { name: "Edit full report" }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "Edit full report" }),
    ).toHaveAttribute("href", "/report?mode=edit");
  });
});
