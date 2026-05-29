/**
 * A13 regression: typed text must survive parent re-renders that pass a new
 * availableStages array reference (autosave → React Query invalidate cycle).
 *
 * Before fix: useEffect has availableStages in deps → fires on new ref →
 *             setText('') wipes user input.
 * After fix:  availableStages removed from deps → state preserved.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DecisionEditDialog } from "./decision-edit-dialog";
import type { Product } from "./mock-data";

const products: Product[] = [
  { id: "p1", name: "CRM", overallStatus: "on-track", stages: [] },
];

describe("DecisionEditDialog — A13 form-race regression", () => {
  it("preserves typed text when parent re-renders with a new availableStages ref", () => {
    const stagesV1 = ["Planning", "Dev"] as const;

    const { rerender } = render(
      <DecisionEditDialog
        open={true}
        decision={null}
        defaultOwner="Test Lead"
        availableStages={stagesV1}
        products={products}
        defaultProductId="p1"
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );

    const textField = screen.getByLabelText(/^Decision \*/i);
    fireEvent.change(textField, {
      target: { value: "user typed this — must survive" },
    });
    expect(textField).toHaveValue("user typed this — must survive");

    // Simulate autosave parent re-render: new array reference, same values.
    const stagesV2 = ["Planning", "Dev"] as const;
    rerender(
      <DecisionEditDialog
        open={true}
        decision={null}
        defaultOwner="Test Lead"
        availableStages={stagesV2}
        products={products}
        defaultProductId="p1"
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );

    // A13 bug: before fix, text was wiped back to '' by useEffect firing on
    // the new availableStages reference.
    expect(textField).toHaveValue("user typed this — must survive");
  });

  it("saves with required fields when text, owner and impact are filled", () => {
    const onSave = vi.fn();
    render(
      <DecisionEditDialog
        open={true}
        decision={null}
        defaultOwner="Test Lead"
        availableStages={["Planning", "Dev"]}
        products={products}
        defaultProductId="p1"
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Decision \*/i), {
      target: { value: "Approve Q3 hiring plan" },
    });
    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: "Unblocks team expansion" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Decision/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      text: "Approve Q3 hiring plan",
      impact: "Unblocks team expansion",
      owner: "Test Lead",
    });
  });

  it("saves selected stageIds with the decision payload (UFB-014)", () => {
    const onSave = vi.fn();
    render(
      <DecisionEditDialog
        open={true}
        decision={null}
        defaultOwner="Test Lead"
        availableStages={["Planning", "Dev"]}
        products={products}
        defaultProductId="p1"
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Decision \*/i), {
      target: { value: "Approve Q3 hiring plan" },
    });
    fireEvent.change(screen.getByLabelText(/^Impact \*/i), {
      target: { value: "Unblocks team expansion" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Planning" }));
    fireEvent.click(screen.getByRole("button", { name: /Save Decision/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      text: "Approve Q3 hiring plan",
      stageIds: ["Dev"],
    });
  });

  it("restores existing stageIds when editing a decision (UFB-014)", () => {
    render(
      <DecisionEditDialog
        open={true}
        decision={{
          id: "decision-1",
          productId: "p1",
          productName: "CRM",
          text: "Approve release gate",
          owner: "Test Lead",
          impact: "Unblocks production rollout",
          deadline: null,
          stageIds: ["Dev"],
        }}
        defaultOwner="Test Lead"
        availableStages={["Planning", "Dev"]}
        products={products}
        defaultProductId="p1"
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: "Planning" }),
    ).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Dev" })).toBeChecked();
  });
});
