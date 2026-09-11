// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MOCK_PRODUCTS } from "../../../../test-utils/mock-products";
import { NextWeekSection } from "./next-week-section";

const activities = [{ id: "activity-1", name: "Jira triage" }];

describe("NextWeekSection — activity add signal", () => {
  it("opens activity-only create with the first activity as parent", () => {
    const { rerender } = render(
      <NextWeekSection
        items={[]}
        products={[]}
        activities={activities}
        addSignal={0}
      />,
    );

    rerender(
      <NextWeekSection
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
    const products = MOCK_PRODUCTS.slice(0, 1);
    const product = products[0];
    if (!product) throw new Error("Expected a product fixture");
    const { rerender } = render(
      <NextWeekSection
        items={[]}
        products={products}
        activities={activities}
        addSignal={0}
      />,
    );

    rerender(
      <NextWeekSection
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
});

describe("NextWeekSection — compact touch floor (responsive-compact-layout)", () => {
  it("removes the nested mobile scroll while retaining the desktop cap", () => {
    render(<NextWeekSection items={[]} products={MOCK_PRODUCTS.slice(0, 1)} />);

    const board = screen.getByRole("group", { name: "Next week items" });
    expect(board.className).toContain("max-md:max-h-none");
    expect(board.className).toContain("max-md:overflow-visible");
    expect(board.className).toContain("md:max-h-[420px]");
    expect(board.className).toContain("md:overflow-y-auto");
  });

  // jsdom cannot evaluate media queries; the class assertions are the teeth.
  it("the empty-state '+ Add Item' CTA floors at the touch target below md", () => {
    // No items AND no products → the stand-alone empty-state CTA renders
    // (disabled, since there is no seed product). It must carry the same
    // compact floor as every other interactive control on the lead form.
    render(<NextWeekSection items={[]} products={[]} />);

    const cta = screen.getByRole("button", { name: "+ Add Item" });
    expect(cta).toBeDisabled();
    expect(cta.className).toContain("min-h-[var(--touch-target-min)]");
    expect(cta.className).toContain("md:min-h-[40px]");
  });

  it("the per-product '+ Add' button keeps its compact floor", () => {
    const twoProducts = MOCK_PRODUCTS.slice(0, 2);
    render(<NextWeekSection items={[]} products={twoProducts} />);

    const firstName = twoProducts[0]?.name ?? "";
    const addButton = screen.getByRole("button", {
      name: `Add item to ${firstName}`,
    });
    expect(addButton.className).toContain("min-h-[var(--touch-target-min)]");
    expect(addButton.className).toContain("md:min-h-[28px]");
  });
});
