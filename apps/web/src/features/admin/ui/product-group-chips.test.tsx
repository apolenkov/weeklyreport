import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the @tanstack/react-query useQuery hook and the tRPC context so
// the component reads from a stub instead of a real network round-trip.
// Same pattern as other client query component tests.
const useQueryMock = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: unknown) => useQueryMock(opts) as Record<string, unknown>,
}));
vi.mock("../../../shared/lib/trpc/trpc-context", () => ({
  useTRPC: () => ({
    admin: {
      listProductGroups: {
        queryOptions: (input: { productId: string }) => ({
          queryKey: ["admin", "listProductGroups", input.productId],
        }),
      },
    },
  }),
}));

import { ProductGroupChips } from "./product-group-chips";

const PRODUCT_ID = "22222222-2222-4222-8222-2222222222a1";

describe("ProductGroupChips", () => {
  it("renders a loading hint while the query is in flight", () => {
    useQueryMock.mockReturnValue({ isLoading: true, data: undefined });
    render(<ProductGroupChips productId={PRODUCT_ID} />);
    expect(
      screen.getByRole("status", { name: "Loading product groups" }),
    ).toHaveAttribute("aria-busy", "true");
  });

  it('renders "No groups" when the product has no attached groups', () => {
    useQueryMock.mockReturnValue({ isLoading: false, data: [] });
    render(<ProductGroupChips productId={PRODUCT_ID} />);
    expect(screen.getByTestId("product-group-chips-empty")).toBeInTheDocument();
    expect(screen.getByText("No groups")).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("distinguishes a failed query from an empty group list", () => {
    useQueryMock.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
    });
    render(<ProductGroupChips productId={PRODUCT_ID} />);
    expect(screen.getByTestId("product-group-chips-error")).toHaveTextContent(
      "Groups unavailable",
    );
    expect(
      screen.queryByTestId("product-group-chips-empty"),
    ).not.toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("renders one pill per attached group, preserving server order", () => {
    useQueryMock.mockReturnValue({
      isLoading: false,
      data: [
        {
          id: "g-a",
          name: "Platform",
          description: null,
          archived: false,
          headUserId: null,
        },
        {
          id: "g-b",
          name: "Integrations",
          description: null,
          archived: false,
          headUserId: null,
        },
      ],
    });
    render(<ProductGroupChips productId={PRODUCT_ID} />);
    const list = screen.getByTestId("product-group-chips");
    const items = list.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(Array.from(items).at(0)?.textContent).toBe("Platform");
    expect(Array.from(items).at(1)?.textContent).toBe("Integrations");
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });
});
