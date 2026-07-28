/**
 * Typed text must survive parent re-renders that pass a new
 * stagesForProduct function reference (autosave → React Query invalidate cycle).
 */

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { KanbanItem, Product } from "../model/types";
import { ItemEditDialog } from "./item-edit-dialog";

const products: Product[] = [
  { id: "p1", name: "DevOps Tools", overallStatus: "on-track", stages: [] },
];

describe("ItemEditDialog — form state across parent renders", () => {
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

    // A new callback identity must not reset the user's local draft.
    expect(textField).toHaveValue("user typed this — must survive");
  });
});

describe("ItemEditDialog — compact touch floor", () => {
  it("footer actions, status chips and the priority select floor below md", () => {
    // jsdom cannot evaluate media queries; the class assertions are the teeth.
    // Desktop density is untouched (md:min-h restores the 40px/34px values).
    render(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        stagesForProduct={() => ["Dev"] as const}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    for (const name of [/^Cancel$/, /Save Item/]) {
      const button = screen.getByRole("button", { name });
      expect(button.className).toContain("min-h-[var(--touch-target-min)]");
      expect(button.className).toContain("md:min-h-[40px]");
    }

    const statusChip = screen.getByRole("button", { name: /In Progress/i });
    expect(statusChip.className).toContain("min-h-[var(--touch-target-min)]");
    expect(statusChip.className).toContain("md:min-h-[34px]");

    const prioritySelect = document.querySelector("#item-priority-rank");
    expect(prioritySelect?.className).toContain(
      "max-md:min-h-[var(--touch-target-min)]",
    );
  });
});

describe("ItemEditDialog — reopen reset", () => {
  it("resets draft text, status, stageNames and errors when reopened", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const item: KanbanItem = {
      id: "item-1",
      productId: "p1",
      productName: "DevOps Tools",
      text: "Persisted item text",
      status: "completed",
      author: "Test Lead",
      stageNames: ["Dev"],
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
    expect(screen.getByRole("button", { name: /Completed/i })).toHaveAttribute(
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

describe("ItemEditDialog — canonical stage labels", () => {
  it("saves a legacy 'Dev' stage as canonical 'Development' without re-toggling", () => {
    const onSave = vi.fn();
    const legacyItem: KanbanItem = {
      id: "legacy-1",
      productId: "p1",
      productName: "DevOps Tools",
      text: "Legacy item stored with the short stage alias",
      status: "in-progress",
      author: "Test Lead",
      stageNames: ["Dev"],
    };

    render(
      <ItemEditDialog
        open={true}
        item={legacyItem}
        products={products}
        week="current"
        stagesForProduct={() => ["Development", "Testing"]}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    // Save without touching the (already-checked) Development stage — the
    // canonical value must still be persisted, never the legacy "Dev".
    fireEvent.click(screen.getByRole("button", { name: /Save Item/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      stageNames: ["Development"],
    });
  });
});

describe("ItemEditDialog — save and reopen status reset", () => {
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

    expect(screen.getByRole("button", { name: /Completed/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: /In Progress/i }));
    expect(
      screen.getByRole("button", { name: /In Progress/i }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: /Save Item/i }));

    const savedItem: KanbanItem = { ...baseItem, status: "in-progress" };

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

    // Reopen must use the updated item, not a stale draft from the prior open.
    expect(
      screen.getByRole("button", { name: /In Progress/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Completed/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

describe("ItemEditDialog — unique rank picker", () => {
  it("disables taken ranks in the select while keeping the own current rank selectable", () => {
    const item: KanbanItem = {
      id: "item-rank",
      productId: "p1",
      productName: "DevOps Tools",
      text: "Deploy pipeline",
      status: "in-progress",
      author: "Test Lead",
      priorityRank: 2,
    };
    // ownPeriodRanks includes item's own rank (2) plus a foreign taken rank (3).
    // The dialog must NOT disable rank 2 (own item's rank) but MUST disable rank 3.
    render(
      <ItemEditDialog
        open={true}
        item={item}
        products={products}
        week="current"
        ownPeriodRanks={[2, 3]}
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );

    const select = screen.getByLabelText<HTMLSelectElement>(/Priority rank/i);
    const opt2 = Array.from(select.options).find((o) => o.value === "2");
    const opt3 = Array.from(select.options).find((o) => o.value === "3");
    const opt1 = Array.from(select.options).find((o) => o.value === "1");

    expect(opt2?.disabled).toBe(false); // own rank — selectable
    expect(opt3?.disabled).toBe(true); // taken by another item — disabled
    expect(opt1?.disabled).toBe(false); // free rank — selectable
  });

  it("allows creating an item with a free rank when other ranks are taken", () => {
    const onSave = vi.fn();
    render(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        ownPeriodRanks={[1, 2]}
        // A single owned stage auto-applies so the save is not blocked by the
        // zero-owned-stage guard.
        stagesForProduct={() => ["Dev"]}
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Description \*/i), {
      target: { value: "New priority item" },
    });
    fireEvent.change(screen.getByLabelText(/Priority rank/i), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Item/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ priorityRank: 3 });
  });

  it("does not crash when legacy data has duplicate ranks in ownPeriodRanks", () => {
    // Legacy: two items both have rank 1 — collision must not throw.
    render(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        ownPeriodRanks={[1, 1, 2]}
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );

    const select = screen.getByLabelText<HTMLSelectElement>(/Priority rank/i);
    // rank 1 is taken (even with duplicates), rank 3 is free
    const opt1 = Array.from(select.options).find((o) => o.value === "1");
    const opt3 = Array.from(select.options).find((o) => o.value === "3");
    expect(opt1?.disabled).toBe(true);
    expect(opt3?.disabled).toBe(false);
  });
});

describe("ItemEditDialog — stageNames", () => {
  it("saves selected stageNames from the create dialog", () => {
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
    // Nothing is pre-selected on create, so clicking "Testing" selects it.
    fireEvent.click(screen.getByRole("checkbox", { name: "Testing" }));
    fireEvent.click(screen.getByRole("button", { name: /Save Item/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      text: "Implement OAuth callback",
      stageNames: ["Testing"],
    });
  });
});

describe("ItemEditDialog — typing immediately on open", () => {
  it("preserves text typed immediately after the dialog opens (create mode)", () => {
    const onSave = vi.fn();
    render(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    // Simulate typing before any async effects could run
    const textField = screen.getByLabelText(/Description \*/i);
    fireEvent.change(textField, { target: { value: "typed immediately" } });

    // No re-renders or async ops — text must be exactly what was typed
    expect(textField).toHaveValue("typed immediately");
  });

  it("preserves text typed immediately after the dialog opens (edit mode)", () => {
    const onSave = vi.fn();
    const item: KanbanItem = {
      id: "item-imm",
      productId: "p1",
      productName: "DevOps Tools",
      text: "existing text",
      status: "in-progress",
      author: "Test Lead",
    };

    render(
      <ItemEditDialog
        open={true}
        item={item}
        products={products}
        week="current"
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    const textField = screen.getByLabelText(/Description \*/i);
    fireEvent.change(textField, {
      target: { value: "existing text — amended" },
    });

    expect(textField).toHaveValue("existing text — amended");
  });
});
