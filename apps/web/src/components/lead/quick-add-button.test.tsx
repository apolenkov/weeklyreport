import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ItemEditDialog } from "./item-edit-dialog";
import { QuickAddButton } from "./quick-add-button";

describe("QuickAddButton", () => {
  it("opens a five-option type picker", () => {
    render(<QuickAddButton onPick={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
    const menu = screen.getByRole("group", { name: "Quick-add record type" });
    expect(menu).toBeInTheDocument();
    const options = within(menu).getAllByRole("button");
    expect(options.map((option) => option.textContent)).toEqual([
      "Current week item",
      "Next week item",
      "Blocker",
      "Risk",
      "Decision",
    ]);
  });

  it("fires onPick with the chosen kind and closes the menu", () => {
    const onPick = vi.fn();
    render(<QuickAddButton onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
    fireEvent.click(screen.getByRole("button", { name: "Blocker" }));
    expect(onPick).toHaveBeenCalledWith("blocker");
    expect(
      screen.queryByRole("group", { name: "Quick-add record type" }),
    ).not.toBeInTheDocument();
  });

  it("is inert while disabled (no products)", () => {
    render(<QuickAddButton onPick={vi.fn()} disabled />);
    const trigger = screen.getByRole("button", { name: "+ Add" });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(
      screen.queryByRole("group", { name: "Quick-add record type" }),
    ).not.toBeInTheDocument();
  });

  it("report-toolbar-layout: stays neutral/outline — no resting solid brand-accent fill", () => {
    // Submit Section keeps the single resting brand-accent fill; + Add must
    // never compete with it, so its background stays transparent.
    render(<QuickAddButton onPick={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "+ Add" });
    expect(trigger.className).toContain("bg-transparent");
    expect(trigger.className).not.toContain(
      "bg-[var(--color-starbucks-accent)]",
    );
  });
});

describe("record-status-derived-from-risk: item dialog has no free Blocked chip", () => {
  const products = [
    {
      id: "p1",
      name: "Product 1",
      overallStatus: "on-track" as const,
      stages: [],
    },
  ];

  it("offers only progress statuses — the blocked/at-risk alarm derives from a covering risk", () => {
    render(
      <ItemEditDialog
        open
        item={null}
        products={products}
        week="current"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "! In Progress" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "✓ Completed" }),
    ).toBeInTheDocument();
    // "set blocked" now routes through blocker (risk) creation, so the free
    // Blocked chip is gone from the item dialog entirely.
    expect(
      screen.queryByRole("button", { name: "✕ Blocked" }),
    ).not.toBeInTheDocument();
  });

  it("opens a legacy stored-blocked item as In Progress (blocked is derived only)", () => {
    render(
      <ItemEditDialog
        open
        item={{
          id: "i1",
          productId: "p1",
          productName: "Product 1",
          status: "blocked",
          text: "Legacy blocked row",
          author: "Lead",
        }}
        products={products}
        week="current"
        stagesForProduct={() => ["Development"]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "! In Progress" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("still enforces a stage choice when several stages are owned", () => {
    const onSave = vi.fn();
    render(
      <ItemEditDialog
        open
        item={null}
        products={products}
        week="current"
        stagesForProduct={() => ["Development", "Testing"]}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Description *"), {
      target: { value: "Needs a stage" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Item" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Select at least one stage.")).toBeInTheDocument();
  });
});
