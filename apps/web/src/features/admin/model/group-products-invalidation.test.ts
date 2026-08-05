import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { invalidateGroupProductOwnership } from "./group-products-invalidation";

const OWNERSHIP_FILTER = { queryKey: ["admin", "product-ownership"] };
const PRODUCT_GROUPS_FILTER = { queryKey: ["admin", "product-groups"] };

function makeTrpc() {
  return {
    admin: {
      listProductGroupOwnership: {
        pathFilter: vi.fn(() => OWNERSHIP_FILTER),
      },
      listProductGroups: {
        pathFilter: vi.fn(() => PRODUCT_GROUPS_FILTER),
      },
    },
  } as unknown as ReturnType<
    typeof import("../../../shared/lib/trpc/trpc-context").useTRPC
  >;
}

function makeQueryClient() {
  const invalidateQueries = vi.fn().mockResolvedValue(undefined);
  return { invalidateQueries } as unknown as QueryClient;
}

describe("invalidateGroupProductOwnership — exact query ownership", () => {
  it("invalidates exactly the ownership read and the per-product group list", async () => {
    const qc = makeQueryClient();
    const trpc = makeTrpc();

    await invalidateGroupProductOwnership(qc, trpc);

    expect(qc.invalidateQueries).toHaveBeenCalledTimes(2);
    expect(qc.invalidateQueries).toHaveBeenNthCalledWith(1, OWNERSHIP_FILTER);
    expect(qc.invalidateQueries).toHaveBeenNthCalledWith(
      2,
      PRODUCT_GROUPS_FILTER,
    );
    expect(trpc.admin.listProductGroupOwnership.pathFilter).toHaveBeenCalled();
    expect(trpc.admin.listProductGroups.pathFilter).toHaveBeenCalled();
  });
});
