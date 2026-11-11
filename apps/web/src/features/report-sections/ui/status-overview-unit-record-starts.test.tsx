// @vitest-environment jsdom
// A risk or decision is raised from the Product or Activity it belongs to
// (openspec: lead-contextual-quick-entry, "A record is started from its
// reporting unit").
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { StatusOverviewUnit } from "../model/status-overview";
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
      previouslyPlanned: { availability: "available", items: [] },
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

  it.each([
    ["risk", "Add risk to Billing"],
    ["decision", "Add decision to Billing"],
  ] as const)("starts a %s bound to its Product", async (kind, name) => {
    const onAddRecord = vi.fn();
    render(
      <StatusOverviewTimelineFooter
        unit={unit()}
        onAddItem={vi.fn()}
        onAddRecord={onAddRecord}
      />,
    );

    const start = screen.getByRole("button", { name });
    expect(start).toHaveClass("min-h-[var(--touch-target-min)]");
    await userEvent.click(start);

    expect(onAddRecord).toHaveBeenCalledWith({
      kind,
      unitKind: "product",
      unitId: "product-1",
    });
  });

  it("binds a record raised from an Activity to that Activity", async () => {
    const onAddRecord = vi.fn();
    render(
      <StatusOverviewTimelineFooter
        unit={unit({ key: "activity:a-1", id: "a-1", kind: "activity" })}
        onAddItem={vi.fn()}
        onAddRecord={onAddRecord}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Add risk to Billing" }),
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
