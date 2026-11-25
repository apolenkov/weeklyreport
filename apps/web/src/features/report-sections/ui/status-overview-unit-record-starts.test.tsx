// @vitest-environment jsdom
// A risk or decision is raised from the Product or Activity it belongs to
// (openspec: lead-contextual-quick-entry, "A record is started from its
// reporting unit").
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { StatusOverviewUnit } from "../model/status-overview";
import { OverviewUnitRecords } from "./overview-unit-records";
import { StatusOverviewTimelineFooter } from "./status-overview-timeline-footer";

function unit(overrides: Partial<StatusOverviewUnit> = {}): StatusOverviewUnit {
  return {
    key: "product:product-1",
    id: "product-1",
    kind: "product",
    name: "Billing",
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

describe("unit risk and decision starts", () => {
  it("keeps the unit editor visible when starts are disabled without assigning a week", () => {
    render(
      <StatusOverviewTimelineFooter
        unit={unit()}
        recordSlot={{
          unitKey: unit().key,
          content: <form aria-label="Risk input">Retained input</form>,
        }}
      />,
    );
    const form = screen.getByRole("form", { name: "Risk input" });
    expect(form.closest("[data-overview-create-lane]")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("binds a record raised from an Activity to that Activity", async () => {
    const onAddRecord = vi.fn();
    render(
      <OverviewUnitRecords
        unit={unit({ key: "activity:a-1", id: "a-1", kind: "activity" })}
        onAddRecord={onAddRecord}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "+ Risk or decision" }),
    );

    expect(onAddRecord).toHaveBeenCalledWith({
      kind: "risk",
      unitKind: "activity",
      unitId: "a-1",
    });
  });

  it("offers no start where records cannot be written", () => {
    const { rerender } = render(
      <StatusOverviewTimelineFooter unit={unit()} onAddItem={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /Add risk/u })).toBeNull();

    rerender(
      <StatusOverviewTimelineFooter
        unit={unit({ historical: true })}
        onAddItem={vi.fn()}
        onAddRecord={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});

it("starts a contextual record with the header action", async () => {
  const open = vi.fn();
  render(<OverviewUnitRecords unit={unit()} onAddRecord={open} />);
  expect(
    screen.getByRole("button", { name: "0 risks · 0 decisions" }),
  ).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "+ Risk or decision" }),
  );
  expect(open).toHaveBeenCalledWith({
    kind: "risk",
    unitKind: "product",
    unitId: "product-1",
  });
});
