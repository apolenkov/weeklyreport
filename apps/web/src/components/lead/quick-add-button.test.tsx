import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ItemEditDialog } from "./item-edit-dialog";
import { QuickAddButton } from "./quick-add-button";

describe("QuickAddButton", () => {
  it("opens a five-option type picker", () => {
    render(<QuickAddButton onPick={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add" }));
    const menu = screen.getByRole("menu", { name: "Quick-add record type" });
    expect(menu).toBeInTheDocument();
    const options = screen.getAllByRole("menuitem");
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
    fireEvent.click(screen.getByRole("menuitem", { name: "Blocker" }));
    expect(onPick).toHaveBeenCalledWith("blocker");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("is inert while disabled (no products)", () => {
    render(<QuickAddButton onPick={vi.fn()} disabled />);
    const trigger = screen.getByRole("button", { name: "+ Add" });
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("quick-add blocker preset on the existing item dialog", () => {
  const products = [
    {
      id: "p1",
      name: "Product 1",
      overallStatus: "on-track" as const,
      stages: [],
    },
  ];

  it("pre-selects the Blocked status chip in create mode", () => {
    render(
      <ItemEditDialog
        open
        item={null}
        products={products}
        week="current"
        defaultStatus="blocked"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "✕ Blocked" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("saves a current-week item with blocked status — no new record type", () => {
    const onSave = vi.fn();
    render(
      <ItemEditDialog
        open
        item={null}
        products={products}
        week="current"
        defaultStatus="blocked"
        stagesForProduct={() => ["Development"]}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Description *"), {
      target: { value: "Blocked by vendor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Item" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "blocked",
        text: "Blocked by vendor",
        // Single owned stage auto-applies — the stage invariant holds
        // without a tap when exactly one stage is owned.
        stageIds: ["Development"],
      }),
    );
  });

  it("still enforces a stage choice when several stages are owned", () => {
    const onSave = vi.fn();
    render(
      <ItemEditDialog
        open
        item={null}
        products={products}
        week="current"
        defaultStatus="blocked"
        stagesForProduct={() => ["Development", "Testing"]}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Description *"), {
      target: { value: "Blocked by vendor" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Item" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Select at least one stage.")).toBeInTheDocument();
  });
});
