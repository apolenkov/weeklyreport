import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { StatusOverviewUnit } from "../model/status-overview";
import {
  CellCreateButton,
  TimelineFooter,
  UnitAddItemButton,
  UnitWeekCreateControls,
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

    await user.click(add);
    expect(onAddItem).toHaveBeenCalledWith({
      source: "current",
      unitKind: "activity",
      unitId: "activity-1",
    });
  });

  it("renders always-visible mobile Current and Next creation controls", async () => {
    const user = userEvent.setup();
    const onAddItem = vi.fn();
    const unit = overviewUnit({
      key: "product:product-1",
      id: "product-1",
      kind: "product",
      name: "Payments",
    });
    const { container } = render(
      <UnitWeekCreateControls unit={unit} onAddItem={onAddItem} />,
    );

    const controls = container.querySelector("[data-overview-mobile-create]");
    expect(controls).toHaveClass("md:hidden");

    const current = screen.getByRole("button", {
      name: "Add current week update to Payments",
    });
    const next = screen.getByRole("button", {
      name: "Add next week update to Payments",
    });
    for (const control of [current, next]) {
      expect(control).toHaveClass("min-h-[var(--touch-target-min)]");
      expect(control).toHaveClass("min-w-[var(--touch-target-min)]");
      // Always visible: no reveal-only opacity on the mobile affordance.
      expect(control).not.toHaveClass("opacity-0");
    }
    // Three identical "+" icons sit side by side here; the two week controls
    // carry visible labels so they are distinguishable without hovering.
    for (const [control, label] of [
      [current, "Current"],
      [next, "Next"],
    ] as const) {
      const text = within(control).getByText(label);
      expect(text).toBeVisible();
      expect(text).not.toHaveClass("sr-only");
      expect(within(control).getByText(label)).toHaveClass("whitespace-nowrap");
    }
    // The control row wraps rather than overflowing a 375px unit header.
    expect(controls).toHaveClass("flex-wrap");
    expect(current).toHaveAttribute(
      "data-overview-focus",
      "add:product:product-1:mobile:current",
    );
    expect(next).toHaveAttribute(
      "data-overview-focus",
      "add:product:product-1:mobile:next",
    );

    await user.click(current);
    expect(onAddItem).toHaveBeenLastCalledWith({
      source: "current",
      unitKind: "product",
      unitId: "product-1",
    });
    await user.click(next);
    expect(onAddItem).toHaveBeenLastCalledWith({
      source: "next",
      unitKind: "product",
      unitId: "product-1",
    });
  });

  it("names the same Current and Next creation on desktop cells", async () => {
    const user = userEvent.setup();
    const onAddItem = vi.fn();
    render(
      <CellCreateButton
        unit={overviewUnit({
          key: "product:p-1",
          name: "Payments",
          kind: "product",
          id: "p-1",
        })}
        source="next"
        rowKey="current:record-1"
        onAddItem={onAddItem}
      />,
    );

    const add = screen.getByRole("button", {
      name: "Add next week update to Payments",
    });
    expect(add).toHaveAttribute(
      "data-overview-focus",
      "add:product:p-1:row:current:record-1:cell:next",
    );
    expect(add).toHaveAttribute("data-overview-create-source", "next");

    await user.click(add);
    expect(onAddItem).toHaveBeenCalledWith({
      source: "next",
      unitKind: "product",
      unitId: "p-1",
    });
  });

  it("reveals desktop cell creation on hover, keyboard focus and touch", () => {
    render(
      <CellCreateButton
        unit={overviewUnit()}
        source="current"
        rowKey="current:record-1"
        onAddItem={vi.fn()}
      />,
    );

    const add = screen.getByRole("button", {
      name: "Add current week update to Incident duty",
    });
    const classes = add.className;
    expect(classes).toContain("opacity-0");
    expect(classes).toContain("group-hover/lane:opacity-100");
    expect(classes).toContain("group-focus-within/lane:opacity-100");
    // Where hover cannot exist the control stays visible. The arbitrary
    // variant must spell the media feature as `hover:none`, otherwise the
    // generated CSS rule never matches a touch device.
    expect(classes).toContain("[@media(hover:none)]:opacity-100");
    expect(classes).not.toContain("[@media(hover=none)]:opacity-100");
    // Mobile creation lives in the unit header instead.
    expect(classes).toContain("hidden");
    expect(classes).toContain("md:inline-flex");
    for (const hiding of ["invisible", "sr-only"]) {
      expect(add).not.toHaveClass(hiding);
    }
    expect(add).toHaveClass("min-h-[var(--touch-target-min)]");
    expect(add).toHaveClass("min-w-[var(--touch-target-min)]");
  });

  it("offers no creation control for a historical unit", () => {
    const onAddItem = vi.fn();
    render(
      <>
        <UnitAddItemButton
          unit={overviewUnit({ historical: true })}
          onAddItem={onAddItem}
        />
        <UnitWeekCreateControls
          unit={overviewUnit({ historical: true })}
          onAddItem={onAddItem}
        />
      </>,
    );

    expect(
      screen.queryByRole("button", { name: /Add .*week update to/ }),
    ).not.toBeInTheDocument();
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
