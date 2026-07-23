import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MockProduct } from "../model/admin-types";

// Mock @tanstack/react-query — two useQuery calls (attached-products list
// and the batched ownership lookup, routed by queryKey), the useMutation
// pair for attach/detach, and useQueryClient for the invalidation call.
const attachedQueryMock = vi.fn();
const ownershipQueryMock = vi.fn();
const attachMutate = vi.fn();
const detachMutate = vi.fn();
const invalidate = vi.fn();

interface MutationCallbacks {
  readonly onSuccess?: () => Promise<void> | void;
  readonly onError?: (error: Error) => void;
}

const attachMutationOptions = vi.fn((options: MutationCallbacks) => ({
  mutationKey: ["attachProductToGroup"],
  ...options,
}));
const detachMutationOptions = vi.fn((options: MutationCallbacks) => ({
  mutationKey: ["detachProductFromGroup"],
  ...options,
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (opts: { queryKey?: readonly string[] }): unknown =>
    (opts.queryKey ?? []).includes("listProductGroupOwnership")
      ? ownershipQueryMock(opts)
      : attachedQueryMock(opts),
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

vi.mock("../../../lib/trpc-context", () => ({
  useTRPC: () => ({
    admin: {
      listGroupProducts: {
        queryOptions: (input: { groupId: string }) => ({
          queryKey: ["admin", "listGroupProducts", input.groupId],
        }),
        pathFilter: () => ({
          queryKey: ["admin", "listGroupProducts"],
        }),
        queryKey: (input: { groupId: string }) => [
          "admin",
          "listGroupProducts",
          input.groupId,
        ],
      },
      listProductGroupOwnership: {
        queryOptions: (input: { productId: readonly string[] }) => ({
          queryKey: ["admin", "listProductGroupOwnership", input.productId],
        }),
        pathFilter: () => ({
          queryKey: ["admin", "listProductGroupOwnership"],
        }),
      },
      attachProductToGroup: {
        mutationOptions: attachMutationOptions,
      },
      detachProductFromGroup: {
        mutationOptions: detachMutationOptions,
      },
      listProductGroups: {
        pathFilter: () => ({
          queryKey: ["admin", "listProductGroups"],
        }),
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

describe("GroupProductsEditor", () => {
  beforeEach(() => {
    attachMutate.mockReset();
    detachMutate.mockReset();
    attachMutationOptions.mockClear();
    detachMutationOptions.mockClear();
    invalidate.mockReset();
    attachedQueryMock.mockReset();
    ownershipQueryMock.mockReset();
    // Default: no product is owned by any group; individual tests override.
    ownershipQueryMock.mockReturnValue({ isLoading: false, data: [] });
  });

  it("renders a loading indicator while the attached-list query is in flight", () => {
    attachedQueryMock.mockReturnValue({ isLoading: true, data: undefined });
    render(
      <GroupProductsEditor
        groupId={GROUP_ID}
        products={[PRODUCT_A, PRODUCT_B]}
      />,
    );
    expect(screen.getByTestId("group-products-loading")).toBeInTheDocument();
  });

  it("renders one checkbox per active product, hiding archived ones", () => {
    attachedQueryMock.mockReturnValue({ isLoading: false, data: [] });
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
    attachedQueryMock.mockReturnValue({
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

  it("attaching a product refreshes group lists and ownership caches", async () => {
    attachedQueryMock.mockReturnValue({ isLoading: false, data: [] });
    render(<GroupProductsEditor groupId={GROUP_ID} products={[PRODUCT_A]} />);
    const a = screen.getByLabelText(/Toggle Платформа интеграций/);
    fireEvent.click(a);
    expect(attachMutate).toHaveBeenCalledWith({
      groupId: GROUP_ID,
      productId: PRODUCT_A.id,
    });
    expect(detachMutate).not.toHaveBeenCalled();

    const callbacks = attachMutationOptions.mock.calls[0]?.[0];
    await callbacks?.onSuccess?.();

    expect(invalidate).toHaveBeenNthCalledWith(1, {
      queryKey: ["admin", "listGroupProducts"],
    });
    expect(invalidate).toHaveBeenNthCalledWith(2, {
      queryKey: ["admin", "listProductGroupOwnership"],
    });
    expect(invalidate).toHaveBeenNthCalledWith(3, {
      queryKey: ["admin", "listProductGroups"],
    });
  });

  it("locks products already attached to another group and shows the owning group", () => {
    attachedQueryMock.mockReturnValue({ isLoading: false, data: [] });
    ownershipQueryMock.mockReturnValue({
      isLoading: false,
      data: [
        { productId: PRODUCT_A.id, group: null },
        {
          productId: PRODUCT_B.id,
          group: { id: "group-other", name: "Platform Group" },
        },
      ],
    });

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

  it("detaching a product refreshes its group list and ownership caches", async () => {
    attachedQueryMock.mockReturnValue({
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

    const callbacks = detachMutationOptions.mock.calls[0]?.[0];
    await callbacks?.onSuccess?.();

    expect(invalidate).toHaveBeenNthCalledWith(1, {
      queryKey: ["admin", "listGroupProducts", GROUP_ID],
    });
    expect(invalidate).toHaveBeenNthCalledWith(2, {
      queryKey: ["admin", "listProductGroupOwnership"],
    });
    expect(invalidate).toHaveBeenNthCalledWith(3, {
      queryKey: ["admin", "listProductGroups"],
    });
  });

  it("renders an empty-state message when there are no active products", () => {
    attachedQueryMock.mockReturnValue({ isLoading: false, data: [] });
    render(<GroupProductsEditor groupId={GROUP_ID} products={[]} />);
    expect(screen.getByText(/No active products yet/i)).toBeInTheDocument();
  });
});
