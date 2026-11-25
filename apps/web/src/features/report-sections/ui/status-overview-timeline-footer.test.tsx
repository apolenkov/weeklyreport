import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { StatusOverviewUnit } from "../model/status-overview";
import {
  StatusOverviewTimelineFooter,
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
      lastWeek: { availability: "available", items: [] },
      priorCommitments: { availability: "available", items: [] },
      currentWeek: { availability: "available", items: [] },
      nextWeek: { availability: "available", items: [] },
    },
    ...overrides,
  };
}

describe("unit creation controls", () => {
  it("targets the selected Current week", async () => {
    const user = userEvent.setup();
    const onAddItem = vi.fn();
    render(
      <UnitAddItemButton
        unit={overviewUnit()}
        source="current"
        onAddItem={onAddItem}
      />,
    );

    const add = screen.getByRole("button", {
      name: "Add item to Incident duty, Current week",
    });
    expect(add).toHaveAttribute(
      "data-overview-focus",
      "add:activity:activity-1",
    );
    expect(add).toHaveClass("min-h-[var(--touch-target-min)]");
    expect(add).toHaveClass("min-w-[var(--touch-target-min)]");
    expect(add).not.toHaveClass("opacity-0");
    // A visible label, so the one creation entry reads without hovering.
    expect(within(add).getByText("What happened…")).toBeVisible();

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
        source="current"
        onAddItem={onAddItem}
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: "Add item to Incident duty, Current week",
      }),
    ).not.toBeInTheDocument();
  });

  it("puts the stage selector inside the entry and marks a missing current update",()=>{
    render(<StatusOverviewTimelineFooter unit={overviewUnit({kind:"product"})} onAddItem={vi.fn()} ownedStageStarts={["Planning","Testing"]}/>);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByText("needed to submit")).toBeVisible();
    expect(screen.queryByRole("button",{name:/Planning/})).toBeNull();
  });

});

it("offers one quiet entry line for each editable week", () => {
  render(
    <StatusOverviewTimelineFooter unit={overviewUnit()} onAddItem={vi.fn()} />,
  );
  expect(screen.getByText("What happened…")).toBeVisible();
  expect(screen.getByText("Plan…")).toBeVisible();
});
