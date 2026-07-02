/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MOCK_PRODUCTS } from "./mock-data";
import { NextWeekSection } from "./next-week-section";

describe("NextWeekSection — compact touch floor (responsive-compact-layout)", () => {
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
