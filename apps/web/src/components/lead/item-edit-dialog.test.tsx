/**
 * A13 regression: typed text must survive parent re-renders that pass a new
 * stagesForProduct function reference (autosave → React Query invalidate cycle).
 *
 * Before fix: useEffect has stagesForProduct in deps → fires on new ref →
 *             setText(initial.text) wipes user input.
 * After fix:  stagesForProduct removed from deps → text preserved.
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ItemEditDialog } from "./item-edit-dialog";
import type { KanbanItem, Product } from "./mock-data";

const products: Product[] = [
  { id: "p1", name: "DevOps Tools", overallStatus: "on-track", stages: [] },
];

describe("ItemEditDialog — A13 form-race regression", () => {
  it("preserves typed text when parent re-renders with a new stagesForProduct ref", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const stagesV1 = () => ["Dev", "Testing"] as const;

    const { rerender } = render(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        stagesForProduct={stagesV1}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    const textField = screen.getByLabelText(/Description \*/i);
    fireEvent.change(textField, {
      target: { value: "user typed this — must survive" },
    });
    expect(textField).toHaveValue("user typed this — must survive");

    // Simulate autosave parent re-render: new function reference, same return value.
    const stagesV2 = () => ["Dev", "Testing"] as const;
    rerender(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        stagesForProduct={stagesV2}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    // A13 bug: before fix, text was wiped back to '' by useEffect firing on
    // the new stagesForProduct reference.
    expect(textField).toHaveValue("user typed this — must survive");
  });
});

describe("ItemEditDialog — D-12 reopen reset", () => {
  it("resets draft text, status, stageIds and errors when reopened", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const item: KanbanItem = {
      id: "item-1",
      productId: "p1",
      productName: "DevOps Tools",
      text: "Persisted item text",
      status: "blocked",
      author: "Test Lead",
      stageIds: ["Dev"],
    };

    const { rerender } = render(
      <ItemEditDialog
        open={true}
        item={item}
        products={products}
        week="current"
        stagesForProduct={() => ["Dev", "Testing"]}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Description \*/i), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /In Progress/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Testing" }));
    fireEvent.click(screen.getByRole("button", { name: /Save Item/i }));

    expect(screen.getByText("Description is required")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /In Progress/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("checkbox", { name: "Testing" })).toBeChecked();

    rerender(
      <ItemEditDialog
        open={false}
        item={item}
        products={products}
        week="current"
        stagesForProduct={() => ["Dev", "Testing"]}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );
    rerender(
      <ItemEditDialog
        open={true}
        item={item}
        products={products}
        week="current"
        stagesForProduct={() => ["Dev", "Testing"]}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByLabelText(/Description \*/i)).toHaveValue(
      "Persisted item text",
    );
    expect(screen.getByRole("button", { name: /Blocked/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("checkbox", { name: "Dev" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Testing" })).not.toBeChecked();
    expect(
      screen.queryByText("Description is required"),
    ).not.toBeInTheDocument();
  });
});

describe("ItemEditDialog — T-D12 save+reopen status reset", () => {
  it("shows updated item.status on reopen after save, not the previously-edited draft status", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const baseItem: KanbanItem = {
      id: "item-d12",
      productId: "p1",
      productName: "DevOps Tools",
      text: "Deploy pipeline",
      status: "completed",
      author: "Test Lead",
    };

    const { rerender } = render(
      <ItemEditDialog
        open={true}
        item={baseItem}
        products={products}
        week="current"
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    // Verify initial status chip reflects item.status = "completed"
    expect(
      screen.getByRole("button", { name: /Completed/i }),
    ).toHaveAttribute("aria-pressed", "true");

    // User clicks "In Progress" chip then saves
    fireEvent.click(screen.getByRole("button", { name: /In Progress/i }));
    expect(
      screen.getByRole("button", { name: /In Progress/i }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Save Item/i }));

    // Parent receives saved item and updates its own state to status:"in-progress"
    const savedItem: KanbanItem = { ...baseItem, status: "in-progress" };

    // Parent closes dialog
    rerender(
      <ItemEditDialog
        open={false}
        item={savedItem}
        products={products}
        week="current"
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    // Parent reopens dialog with the updated item
    rerender(
      <ItemEditDialog
        open={true}
        item={savedItem}
        products={products}
        week="current"
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    // T-D12 assertion: dialog must reflect the CURRENT item.status ("in-progress"),
    // not the stale draft ("completed" from the previous open session).
    expect(
      screen.getByRole("button", { name: /In Progress/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /Completed/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});

describe("ItemEditDialog — UFB-014 stageIds", () => {
  it("saves selected stageIds from the create dialog", () => {
    const onSave = vi.fn();
    render(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        stagesForProduct={() => ["Dev", "Testing"]}
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Description \*/i), {
      target: { value: "Implement OAuth callback" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Testing" }));
    fireEvent.click(screen.getByRole("button", { name: /Save Item/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      text: "Implement OAuth callback",
      stageIds: ["Dev"],
    });
  });
});
