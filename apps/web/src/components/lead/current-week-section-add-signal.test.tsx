/**
 * D1 regression: snapshot view transitions must not reopen the Add Item dialog.
 *
 * Covers the snapshot-trigger bug fix (fix-lead-surface-snapshot-and-fillfrom,
 * task 1.1): when readOnly flips false → true → false the addSignal effect must
 * NOT re-fire because readOnly is no longer in the dep array.
 *
 * Scenario (mirrors real usage):
 *   1. addSignal=1, readOnly=false  → dialog opens
 *   2. User cancels dialog           → dialog closes; addSignal stays at 1
 *   3. readOnly=true  (snapshot)     → no dialog re-open (guard fires in body)
 *   4. readOnly=false (back to live) → must NOT reopen; only a new increment should
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CurrentWeekSection } from "./current-week-section";
import { type KanbanItem, MOCK_PRODUCTS } from "./mock-data";

const products = MOCK_PRODUCTS.slice(0, 1);
const productId = products[0]?.id ?? "";
const productName = products[0]?.name ?? "";

function manyItems(n: number): KanbanItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `item-${String(i)}`,
    productId,
    productName,
    status: "in-progress" as const,
    text: `Item ${String(i)}`,
    author: "You",
  }));
}

describe("CurrentWeekSection — addSignal snapshot regression (D1)", () => {
  it("does not reopen the dialog when readOnly toggles false→true→false with stale addSignal", () => {
    // Step 1: addSignal=1, readOnly=false → effect fires, dialog opens.
    const { rerender } = render(
      <CurrentWeekSection
        items={[]}
        products={products}
        addSignal={1}
        readOnly={false}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Step 2: user cancels the dialog (same signal, counter not reset by parent).
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Step 3: enter snapshot view — readOnly=true, addSignal still 1.
    rerender(
      <CurrentWeekSection
        items={[]}
        products={products}
        addSignal={1}
        readOnly={true}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Step 4: return to live view — readOnly=false, addSignal still 1.
    // The key assertion: the effect must NOT re-fire on the readOnly transition.
    rerender(
      <CurrentWeekSection
        items={[]}
        products={products}
        addSignal={1}
        readOnly={false}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("CurrentWeekSection — slide-capacity advisory (add-slide-capacity-signals)", () => {
  it("shows a slide-fit advisory in a product column that exceeds the soft cap", () => {
    render(<CurrentWeekSection items={manyItems(6)} products={products} />);

    const notes = screen.getAllByTestId("slide-fit-advisory");
    expect(notes).toHaveLength(1);
    expect(notes[0]).toHaveTextContent(
      "6 records may not fit cleanly on the slide",
    );
  });

  it("shows no advisory when the column is at or under the soft cap", () => {
    render(<CurrentWeekSection items={manyItems(5)} products={products} />);

    expect(screen.queryByTestId("slide-fit-advisory")).not.toBeInTheDocument();
  });
});
