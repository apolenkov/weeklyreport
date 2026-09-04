import { render, screen, within } from "@testing-library/react";
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

  it.each(["empty", "on-track"] as const)(
    "suppresses the non-actionable %s health badge",
    (status) => {
      const unit = model.units[0];
      if (!unit) throw new Error("Expected one overview unit");
      render(
        <StatusOverview model={{ ...model, units: [{ ...unit, status }] }} />,
      );

      expect(screen.queryByText("No status")).toBeNull();
      expect(screen.queryByText("On track")).toBeNull();
      expect(screen.getByText("Incident duty")).toBeVisible();
    },
  );

  it("uses equal desktop tracks and one trailing continuity/edit rail", () => {
    render(<StatusOverview model={model} onEditItem={vi.fn()} />);

    const edit = screen.getByRole("button", { name: "Edit Work item 1" });
    expect(edit).toHaveClass("grid-cols-[minmax(0,1fr)_auto]");
    expect(edit).toHaveTextContent("Unplanned");
    expect(edit).toHaveTextContent("Edit");
    const row = edit.closest("article")?.firstElementChild;
    expect(row).toHaveClass("min-[80rem]:grid-cols-[repeat(4,minmax(0,1fr))]");
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

  it("groups products and activities, keeps long names readable, and exposes quick-add targets", async () => {
    const user = userEvent.setup();
    const onAddItem = vi.fn();
    const activity = model.units[0];
    if (!activity) throw new Error("Expected one overview unit");
    const longProductName = "Marketing platform with a deliberately long name";
    const product = {
      ...activity,
      key: "product:product-1",
      id: "product-1",
      kind: "product" as const,
      name: longProductName,
      linkedProducts: [],
      columns: {
        ...activity.columns,
        currentWeek: { availability: "available" as const, items: [] },
        nextWeek: { availability: "available" as const, items: [] },
      },
    };

    render(
      <StatusOverview
        model={{ ...model, units: [product, activity] }}
        onAddItem={onAddItem}
      />,
    );

    const products = screen.getByRole("region", { name: "Products" });
    const activities = screen.getByRole("region", {
      name: "Project activities",
    });
    expect(within(products).getByText("1")).toBeVisible();
    expect(within(activities).getByText("1")).toBeVisible();

    const longName = screen.getByText(longProductName);
    expect(longName).not.toHaveClass("truncate");
    expect(longName).toHaveClass("break-words");

    expect(
      screen.getByRole("button", {
        name: `Add current week update to ${longProductName}`,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: `Add next week update to ${longProductName}`,
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Add current week update to Incident duty",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", {
        name: "Add next week update to Incident duty",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: `Add previously planned week update to ${longProductName}`,
      }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Add current week update to Incident duty",
      }),
    );
    expect(onAddItem).toHaveBeenCalledWith({
      source: "current",
      unitKind: "activity",
      unitId: "activity-1",
    });
  });

  it("hides quick-add for historical units even when a handler exists", () => {
    const onAddItem = vi.fn();
    const activity = model.units[0];
    if (!activity) throw new Error("Expected one overview unit");
    render(
      <StatusOverview
        model={{
          ...model,
          units: [{ ...activity, historical: true }],
        }}
        onAddItem={onAddItem}
      />,
    );

    expect(screen.getByText("Work item 1")).toBeVisible();
    expect(
      screen.queryByRole("button", {
        name: "Add current week update to Incident duty",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Add next week update to Incident duty",
      }),
    ).not.toBeInTheDocument();
  });

  it("does not render quick-add controls when no create handler is provided", () => {
    render(<StatusOverview model={model} />);

    expect(
      screen.queryByRole("button", { name: /Add .* week update/ }),
    ).toBeNull();
  });
});
