/**
 * A13 regression: typed text must survive parent re-renders that pass a new
 * availableStages array reference (autosave → React Query invalidate cycle).
 *
 * Before fix: useEffect has availableStages in deps → fires on new ref →
 *             setText('') wipes user input.
 * After fix:  availableStages removed from deps → state preserved.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { PriorityEditDialog } from "./priority-edit-dialog";
import type { Product } from "./mock-data";

const products: Product[] = [
  { id: "p1", name: "CRM", overallStatus: "on-track", stages: [] },
];

describe("PriorityEditDialog — A13 form-race regression", () => {
  it("preserves typed text when parent re-renders with a new availableStages ref", () => {
    const stagesV1 = ["Planning", "Dev"] as const;

    const { rerender } = render(
      <PriorityEditDialog
        open={true}
        priority={null}
        nextRank={1}
        availableStages={stagesV1}
        products={products}
        defaultProductId="p1"
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );

    const textField = screen.getByLabelText(/^Description \*/i);
    fireEvent.change(textField, {
      target: { value: "user typed this — must survive" },
    });
    expect(textField).toHaveValue("user typed this — must survive");

    // Simulate autosave parent re-render: new array reference, same values.
    const stagesV2 = ["Planning", "Dev"] as const;
    rerender(
      <PriorityEditDialog
        open={true}
        priority={null}
        nextRank={1}
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

  it("saves with required text field filled", () => {
    const onSave = vi.fn();
    render(
      <PriorityEditDialog
        open={true}
        priority={null}
        nextRank={1}
        availableStages={["Planning", "Dev"]}
        products={products}
        defaultProductId="p1"
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Description \*/i), {
      target: { value: "Ship auth feature this sprint" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save Priority/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      rank: 1,
      text: "Ship auth feature this sprint",
    });
  });
});
