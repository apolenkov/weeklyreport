import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductGroupChips } from "./product-group-chips";

describe("ProductGroupChips", () => {
  it("renders a loading hint while the ownership query is in flight", () => {
    render(<ProductGroupChips group={undefined} isLoading isError={false} />);
    expect(
      screen.getByRole("status", { name: "Loading product groups" }),
    ).toHaveAttribute("aria-busy", "true");
  });

  it('renders "No groups" when the product has no owning group', () => {
    render(
      <ProductGroupChips group={undefined} isLoading={false} isError={false} />,
    );
    expect(screen.getByTestId("product-group-chips-empty")).toBeInTheDocument();
    expect(screen.getByText("No groups")).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("distinguishes a failed query from an empty group list", () => {
    render(<ProductGroupChips group={undefined} isLoading={false} isError />);
    expect(screen.getByTestId("product-group-chips-error")).toHaveTextContent(
      "Groups unavailable",
    );
    expect(
      screen.queryByTestId("product-group-chips-empty"),
    ).not.toBeInTheDocument();
  });

  it("renders the product's owning group", () => {
    render(
      <ProductGroupChips
        group={{ id: "g-a", name: "Platform" }}
        isLoading={false}
        isError={false}
      />,
    );
    const items = screen
      .getByTestId("product-group-chips")
      .querySelectorAll("li");
    expect(items).toHaveLength(1);
    expect(items.item(0).textContent).toBe("Platform");
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });
});
