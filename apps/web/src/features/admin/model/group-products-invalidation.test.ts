import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { createMockTRPC } from "../../../test-utils/mock-trpc";
import { invalidateGroupProductOwnership } from "./group-products-invalidation";

const OWNERSHIP_FILTER = { queryKey: ["admin", "product-ownership"] };
const PRODUCT_GROUPS_FILTER = { queryKey: ["admin", "product-groups"] };

function makeTrpc() {
  const mock = createMockTRPC([
    { path: ["admin", "listProductGroupOwnership"] },
    { path: ["admin", "listProductGroups"] },
  ]);
  Object.assign(mock.proxy.admin.listProductGroupOwnership, {
    pathFilter: vi.fn(() => OWNERSHIP_FILTER),
  });
  Object.assign(mock.proxy.admin.listProductGroups, {
    pathFilter: vi.fn(() => PRODUCT_GROUPS_FILTER),
  });
  return mock.proxy;
}

describe("invalidateGroupProductOwnership — exact query ownership", () => {
  it("invalidates exactly the ownership read and the per-product group list", async () => {
    const qc = new QueryClient();
    const invalidateQueries = vi
      .spyOn(qc, "invalidateQueries")
      .mockResolvedValue();
    const trpc = makeTrpc();

    await invalidateGroupProductOwnership(qc, trpc);

    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, OWNERSHIP_FILTER);
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, PRODUCT_GROUPS_FILTER);
  });
});
