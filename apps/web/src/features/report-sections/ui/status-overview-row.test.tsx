import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import type { StatusOverviewUnit } from "../model/status-overview";
import { StatusOverviewUnitRow } from "./status-overview-row";

const unit: StatusOverviewUnit = {
  key: "activity:a1",
  id: "a1",
  kind: "activity",
  name: "Duty",
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
};

it("starts an entry in the selected Product and week", async () => {
  const user = userEvent.setup();
  const onAddItem = vi.fn();
  render(
    <StatusOverviewUnitRow
      unit={{ ...unit, kind: "product", key: "product:p1", id: "p1" }}
      rows={[]}
      expanded={false}
      onToggle={vi.fn()}
      panelId="panel"
      healthPanelId="health"
      healthExpanded={false}
      onInspect={vi.fn()}
      onCloseHealth={vi.fn()}
      onAddItem={onAddItem}
      ownedStageStarts={["Development", "Testing"]}
    />,
  );
  await user.click(
    screen.getByRole("button", {
      name: "Add what happened — Duty, This week",
    }),
  );
  await user.click(
    screen.getByRole("button", {
      name: "Plan something — Duty, Next week",
    }),
  );
  expect(onAddItem.mock.calls).toEqual([
    [
      {
        source: "current",
        unitKind: "product",
        unitId: "p1",
      },
    ],
    [
      {
        source: "next",
        unitKind: "product",
        unitId: "p1",
      },
    ],
  ]);
});

it("does not show stage starts for activities, historical products, or absent ownership", () => {
  const props = {
    rows: [],
    expanded: false,
    onToggle: vi.fn(),
    panelId: "panel",
    healthPanelId: "health",
    healthExpanded: false,
    onInspect: vi.fn(),
    onCloseHealth: vi.fn(),
    onAddItem: vi.fn(),
  };
  const { rerender } = render(
    <StatusOverviewUnitRow
      {...props}
      unit={unit}
      ownedStageStarts={["Testing"]}
    />,
  );
  expect(
    screen.queryByRole("button", { name: /Testing/ }),
  ).not.toBeInTheDocument();
  rerender(
    <StatusOverviewUnitRow
      {...props}
      unit={{ ...unit, kind: "product", historical: true }}
      ownedStageStarts={["Testing"]}
    />,
  );
  expect(
    screen.queryByRole("button", { name: /Testing/ }),
  ).not.toBeInTheDocument();
  rerender(
    <StatusOverviewUnitRow {...props} unit={{ ...unit, kind: "product" }} />,
  );
  expect(
    screen.queryByRole("button", { name: /Testing/ }),
  ).not.toBeInTheDocument();
});

it("offers one contextual action in each writable week even for an empty unit", async () => {
  const user = userEvent.setup();
  const onAddItem = vi.fn();
  render(
    <StatusOverviewUnitRow
      unit={unit}
      rows={[]}
      expanded={false}
      onToggle={vi.fn()}
      panelId="panel"
      healthPanelId="health"
      healthExpanded={false}
      onInspect={vi.fn()}
      onCloseHealth={vi.fn()}
      onAddItem={onAddItem}
      headerAction={<button>Other action</button>}
    />,
  );
  const article = screen.getByRole("article", { name: "Activity Duty" });
  const buttons = within(article).getAllByRole("button", {
    name: /^(Add what happened|Plan something)/,
  });
  expect(buttons).toHaveLength(2);
  expect(
    within(article).getByRole("button", { name: "Other action" }),
  ).toBeInTheDocument();
  expect(
    within(article).queryByRole("button", { name: /Add item.*Previously/ }),
  ).not.toBeInTheDocument();
  await user.click(
    within(article).getByRole("button", {
      name: "Add what happened — Duty, This week",
    }),
  );
  await user.click(
    within(article).getByRole("button", {
      name: "Plan something — Duty, Next week",
    }),
  );
  expect(onAddItem.mock.calls).toEqual([
    [{ source: "current", unitKind: "activity", unitId: "a1" }],
    [{ source: "next", unitKind: "activity", unitId: "a1" }],
  ]);
});

it("places the create editor only in its matching unit and week", () => {
  render(
    <StatusOverviewUnitRow
      unit={unit}
      rows={[]}
      expanded={false}
      onToggle={vi.fn()}
      panelId="panel"
      healthPanelId="health"
      healthExpanded={false}
      onInspect={vi.fn()}
      onCloseHealth={vi.fn()}
      onAddItem={vi.fn()}
      editorSlot={{
        mode: "create",
        unitKey: unit.key,
        source: "next",
        recordId: null,
        content: <div>Next composer</div>,
      }}
    />,
  );
  expect(
    screen.getByText("Next composer").closest("[data-overview-create-lane]"),
  ).toHaveAttribute("data-overview-create-lane", "next");
});
