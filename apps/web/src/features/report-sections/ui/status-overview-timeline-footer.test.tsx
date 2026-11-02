import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { StatusOverviewUnit } from "../model/status-overview";
import {
  TimelineFooter,
  UnitAddItemButton,
} from "./status-overview-timeline-footer";

function overviewUnit(
  overrides: Partial<StatusOverviewUnit> = {},
): StatusOverviewUnit {
  return {
    key: "activity:activity-1",
    id: "activity-1",
    kind: "activity",
    name: "Incident duty",
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

describe("unit creation controls", () => {
  it("keeps the unit-header Add item action on Current week", async () => {
    const user = userEvent.setup();
    const onAddItem = vi.fn();
    render(<UnitAddItemButton unit={overviewUnit()} onAddItem={onAddItem} />);

    const add = screen.getByRole("button", {
      name: "Add item to Incident duty",
    });
    expect(add).toHaveAttribute(
      "data-overview-focus",
      "add:activity:activity-1",
    );
    expect(add).toHaveClass("min-h-[var(--touch-target-min)]");
    expect(add).toHaveClass("min-w-[var(--touch-target-min)]");
    expect(add).not.toHaveClass("opacity-0");
    // A visible label, so the one creation entry reads without hovering.
    expect(within(add).getByText("Add item")).toBeVisible();

    await user.click(add);
    expect(onAddItem).toHaveBeenCalledWith({
      source: "current",
      unitKind: "activity",
      unitId: "activity-1",
    });
  });

  it("offers no creation control for a historical unit", () => {
    const onAddItem = vi.fn();
    render(
      <UnitAddItemButton
        unit={overviewUnit({ historical: true })}
        onAddItem={onAddItem}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Add item to Incident duty" }),
    ).not.toBeInTheDocument();
  });
});

describe("TimelineFooter", () => {
  it("hosts the single create composer in the unit region", () => {
    const { rerender } = render(
      <TimelineFooter
        editorSlot={{
          mode: "create",
          unitKey: "activity:activity-1",
          source: "next",
          recordId: null,
          stableId: null,
          content: <form aria-label="Create next update" />,
        }}
      />,
    );

    expect(screen.getByTestId("report-unit-footer")).toBeInTheDocument();
    expect(screen.getAllByRole("form")).toHaveLength(1);

    rerender(
      <TimelineFooter
        editorSlot={{
          mode: "edit",
          unitKey: "activity:activity-1",
          source: "current",
          recordId: "record-1",
          stableId: "stable-1",
          content: <form aria-label="Edit update" />,
        }}
      />,
    );
    expect(screen.queryByTestId("report-unit-footer")).not.toBeInTheDocument();
  });
});
