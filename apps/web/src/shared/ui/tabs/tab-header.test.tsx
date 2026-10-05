import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TabHeader } from "./tab-header";

describe("TabHeader responsive composition", () => {
  it("keeps content stacked and actions wrappable below xl", () => {
    render(
      <TabHeader
        title="Products"
        search={<input aria-label="Search products" />}
        actions={<button type="button">Add product</button>}
      />,
    );

    const header = screen.getByTestId("products-tab-header");
    const actionGroup = screen.getByRole("button", {
      name: "Add product",
    }).parentElement;

    expect(header).toHaveClass("flex-col", "xl:flex-row");
    expect(header).not.toHaveClass("sm:flex-row");
    expect(actionGroup).toHaveClass("flex-wrap", "xl:flex-nowrap");
    expect(actionGroup).not.toHaveClass("sm:flex-nowrap");
  });

  it("caps the description measure at 65ch (R18)", () => {
    render(
      <TabHeader
        title="Products"
        description="A long description line that must not stretch across the whole admin viewport on wide screens."
      />,
    );

    expect(screen.getByText(/A long description line/)).toHaveClass(
      "max-w-[65ch]",
    );
  });
});
