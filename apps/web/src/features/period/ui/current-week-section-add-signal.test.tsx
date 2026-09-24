// Snapshot transitions must not reopen Add Item: the addSignal effect skips
// signals already consumed via lastHandledSignal, so false→true→false must
// not re-fire.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MOCK_PRODUCTS } from "../../../test-utils/mock-products";
import { CurrentWeekSection } from "./current-week-section";

const products = MOCK_PRODUCTS.slice(0, 1);
const activities = [{ id: "activity-1", name: "Jira triage" }];

describe("CurrentWeekSection — addSignal snapshot regression", () => {
  it("does not reopen the dialog when readOnly toggles false→true→false with stale addSignal", () => {
    // Step 1: counter starts idle at 0 (parent's initial state); the "+ Add"
    // click advances it 0→1 → effect fires, dialog opens. (Mounting straight at
    // a non-zero signal models a remount, which must not auto-open.)
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

  it("opens activity-only create with the first activity as parent", () => {
    const { rerender } = render(
      <CurrentWeekSection
        items={[]}
        products={[]}
        activities={activities}
        addSignal={0}
      />,
    );

    rerender(
      <CurrentWeekSection
        items={[]}
        products={[]}
        activities={activities}
        addSignal={1}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText<HTMLSelectElement>("Parent").value).toBe(
      "activity:activity-1",
    );
  });

  it("keeps the product as the default parent when activities also exist", () => {
    const product = products[0];
    if (!product) throw new Error("Expected a product fixture");
    const { rerender } = render(
      <CurrentWeekSection
        items={[]}
        products={products}
        activities={activities}
        addSignal={0}
      />,
    );

    rerender(
      <CurrentWeekSection
        items={[]}
        products={products}
        activities={activities}
        addSignal={1}
      />,
    );

    expect(screen.getByLabelText<HTMLSelectElement>("Parent").value).toBe(
      `product:${product.id}`,
    );
  });

  it("does not open from the signal without a product or activity parent", () => {
    const { rerender } = render(
      <CurrentWeekSection items={[]} products={[]} addSignal={0} />,
    );

    rerender(<CurrentWeekSection items={[]} products={[]} addSignal={1} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not open an activity-only create dialog while read-only", () => {
    const { rerender } = render(
      <CurrentWeekSection
        items={[]}
        products={[]}
        activities={activities}
        addSignal={0}
        readOnly
      />,
    );

    rerender(
      <CurrentWeekSection
        items={[]}
        products={[]}
        activities={activities}
        addSignal={1}
        readOnly
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("CurrentWeekSection — compact touch floor", () => {
  it("removes the nested mobile scroll while retaining the desktop cap", () => {
    render(
      <CurrentWeekSection items={[]} products={MOCK_PRODUCTS.slice(0, 1)} />,
    );

    const board = screen.getByRole("group", { name: "Current week items" });
    expect(board.className).toContain("max-md:max-h-none");
    expect(board.className).toContain("max-md:overflow-visible");
    expect(board.className).toContain("md:max-h-[420px]");
    expect(board.className).toContain("md:overflow-y-auto");
  });

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
