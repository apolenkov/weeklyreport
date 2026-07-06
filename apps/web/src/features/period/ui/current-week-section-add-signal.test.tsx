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

import { MOCK_PRODUCTS } from "../../report-sections/model/mock-data";
import { CurrentWeekSection } from "./current-week-section";

const products = MOCK_PRODUCTS.slice(0, 1);

describe("CurrentWeekSection — addSignal snapshot regression (D1)", () => {
  it("does not reopen the dialog when readOnly toggles false→true→false with stale addSignal", () => {
    // Step 1: counter starts idle at 0 (parent's initial state); the "+ Add"
    // click advances it 0→1 → effect fires, dialog opens. (Mounting straight at
    // a non-zero signal models a remount, which must NOT auto-open — D16.)
    const { rerender } = render(
      <CurrentWeekSection
        items={[]}
        products={products}
        addSignal={0}
        readOnly={false}
      />,
    );
    rerender(
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

describe("CurrentWeekSection — compact touch floor (responsive-compact-layout)", () => {
  it("the per-product '+ Add' button floors at the touch target below md", () => {
    // jsdom cannot evaluate media queries; the class assertions are the teeth.
    // Two products are required — the "+ Add" affordance only renders when a
    // lead owns multiple products.
    const twoProducts = MOCK_PRODUCTS.slice(0, 2);
    render(<CurrentWeekSection items={[]} products={twoProducts} />);

    const firstName = twoProducts[0]?.name ?? "";
    const addButton = screen.getByRole("button", {
      name: `Add item to ${firstName}`,
    });
    expect(addButton.className).toContain("min-h-[var(--touch-target-min)]");
    expect(addButton.className).toContain("md:min-h-[28px]");
  });

  it("the empty-state '+ Add Item' CTA floors at the touch target below md", () => {
    // No items AND no products → the stand-alone empty-state CTA renders
    // (disabled, since there is no seed product). It must carry the same
    // compact floor as every other interactive control on the lead form.
    render(<CurrentWeekSection items={[]} products={[]} />);

    const cta = screen.getByRole("button", { name: "+ Add Item" });
    expect(cta).toBeDisabled();
    expect(cta.className).toContain("min-h-[var(--touch-target-min)]");
    expect(cta.className).toContain("md:min-h-[40px]");
  });
});
