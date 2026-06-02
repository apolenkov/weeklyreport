import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MockProduct } from "./mock-data";

// Mock @tanstack/react-query — useQuery for the listing, useMutation
// pair for attach/detach, and useQueryClient for the invalidation call.
const useQueryMock = vi.fn();
const useQueriesMock = vi.fn();
const attachMutate = vi.fn();
const detachMutate = vi.fn();
const invalidate = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: unknown): unknown => useQueryMock(opts),
  useQueries: (opts: unknown): unknown => useQueriesMock(opts),
  useMutation: (opts: { mutationKey?: readonly string[] }) => {
    // Discriminate attach vs detach by the mutation key that the tRPC
    // mock provides below. The trpc-context mock returns a stable key
    // so we can route the mutate calls to the matching spy.
    const key = JSON.stringify(opts);
    if (key.includes("attachProductToGroup")) {
      return { mutate: attachMutate, isPending: false };
    }
    return { mutate: detachMutate, isPending: false };
  },
  useQueryClient: () => ({
    invalidateQueries: invalidate,
  }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("../../lib/trpc-context", () => ({
  useTRPC: () => ({
    admin: {
      listGroupProducts: {
        queryOptions: (input: { groupId: string }) => ({
          queryKey: ["admin", "listGroupProducts", input.groupId],
        }),
        queryKey: (input: { groupId: string }) => [
          "admin",
          "listGroupProducts",
          input.groupId,
        ],
      },
      listProductGroups: {
        queryOptions: (input: { productId: string }) => ({
          queryKey: ["admin", "listProductGroups", input.productId],
        }),
        queryKey: (input: { productId: string }) => [
          "admin",
          "listProductGroups",
          input.productId,
        ],
      },
      attachProductToGroup: {
        mutationOptions: () => ({ mutationKey: ["attachProductToGroup"] }),
      },
      detachProductFromGroup: {
        mutationOptions: () => ({ mutationKey: ["detachProductFromGroup"] }),
      },
    },
  }),
}));

import { GroupProductsEditor } from "./group-products-editor";

const GROUP_ID = "11111111-1111-4111-8111-111111111aaa";

const PRODUCT_A: MockProduct = {
  id: "p-a",
  name: "Платформа интеграций",
  leadOwnerId: "u-1",
  stages: [],
  status: "active",
};

const PRODUCT_B: MockProduct = {
  id: "p-b",
  name: "Partner portal",
  leadOwnerId: "u-1",
  stages: [],
  status: "active",
};

const PRODUCT_ARCHIVED: MockProduct = {
  id: "p-z",
  name: "Old retired product",
  leadOwnerId: "u-1",
  stages: [],
  status: "archived",
};

describe("GroupProductsEditor — UFB-054 (Phase 56-C)", () => {
  beforeEach(() => {
    attachMutate.mockReset();
    detachMutate.mockReset();
    invalidate.mockReset();
    useQueriesMock.mockReset();
    useQueriesMock.mockImplementation((opts: { queries: readonly unknown[] }) =>
      opts.queries.map(() => ({ isLoading: false, data: [] })),
    );
  });

  it("renders a loading indicator while the attached-list query is in flight", () => {
    useQueryMock.mockReturnValue({ isLoading: true, data: undefined });
    render(
      <GroupProductsEditor
        groupId={GROUP_ID}
        products={[PRODUCT_A, PRODUCT_B]}
      />,
    );
    expect(screen.getByTestId("group-products-loading")).toBeInTheDocument();
  });

  it("renders one checkbox per active product, hiding archived ones", () => {
    useQueryMock.mockReturnValue({ isLoading: false, data: [] });
    render(
      <GroupProductsEditor
        groupId={GROUP_ID}
        products={[PRODUCT_A, PRODUCT_B, PRODUCT_ARCHIVED]}
      />,
    );
    const list = screen.getByTestId("group-products-list");
    const items = list.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(screen.queryByLabelText(/Old retired product/)).toBeNull();
  });

  it("checks already-attached products and unchecks the rest", () => {
    useQueryMock.mockReturnValue({
      isLoading: false,
      data: [
        {
          id: PRODUCT_A.id,
          name: PRODUCT_A.name,
          archived: false,
          leadId: "u-1",
          leadName: "Lead",
        },
      ],
    });
    render(
      <GroupProductsEditor
        groupId={GROUP_ID}
        products={[PRODUCT_A, PRODUCT_B]}
      />,
    );
    const a = screen.getByLabelText(/Toggle Платформа интеграций/);
    const b = screen.getByLabelText(/Toggle Partner portal/);
    expect(a).toBeChecked();
    expect(b).not.toBeChecked();
  });

  it("toggling an unchecked product calls attachProductToGroup with the (groupId, productId) tuple", () => {
    useQueryMock.mockReturnValue({ isLoading: false, data: [] });
    render(<GroupProductsEditor groupId={GROUP_ID} products={[PRODUCT_A]} />);
    const a = screen.getByLabelText(/Toggle Платформа интеграций/);
    fireEvent.click(a);
    expect(attachMutate).toHaveBeenCalledWith({
      groupId: GROUP_ID,
      productId: PRODUCT_A.id,
    });
    expect(detachMutate).not.toHaveBeenCalled();
  });

  it("locks products already attached to another group and shows the owning group", () => {
    useQueryMock.mockReturnValue({ isLoading: false, data: [] });
    useQueriesMock.mockImplementation(
      (opts: { queries: readonly { queryKey?: readonly string[] }[] }) =>
        opts.queries.map((query) => {
          if (query.queryKey?.includes(PRODUCT_B.id)) {
            return {
              isLoading: false,
              data: [{ id: "group-other", name: "Platform Group" }],
            };
          }

          return { isLoading: false, data: [] };
        }),
    );

    render(
      <GroupProductsEditor
        groupId={GROUP_ID}
        products={[PRODUCT_A, PRODUCT_B]}
      />,
    );

    const locked = screen.getByLabelText(/Toggle Partner portal/);
    expect(locked).toBeDisabled();
    expect(
      screen.getByText(/Already attached to Platform Group/),
    ).toBeInTheDocument();

    fireEvent.click(locked);

    expect(attachMutate).not.toHaveBeenCalled();
    expect(detachMutate).not.toHaveBeenCalled();
  });

  it("toggling an already-checked product calls detachProductFromGroup", () => {
    useQueryMock.mockReturnValue({
      isLoading: false,
      data: [
        {
          id: PRODUCT_A.id,
          name: PRODUCT_A.name,
          archived: false,
          leadId: "u-1",
          leadName: "Lead",
        },
      ],
    });
    render(<GroupProductsEditor groupId={GROUP_ID} products={[PRODUCT_A]} />);
    const a = screen.getByLabelText(/Toggle Платформа интеграций/);
    fireEvent.click(a);
    expect(detachMutate).toHaveBeenCalledWith({
      groupId: GROUP_ID,
      productId: PRODUCT_A.id,
    });
    expect(attachMutate).not.toHaveBeenCalled();
  });

  it("renders an empty-state message when there are no active products", () => {
    useQueryMock.mockReturnValue({ isLoading: false, data: [] });
    render(<GroupProductsEditor groupId={GROUP_ID} products={[]} />);
    expect(screen.getByText(/No active products yet/i)).toBeInTheDocument();
  });
});
