import type { QueryClient } from "@tanstack/react-query";

import type { useTRPC } from "../../../lib/trpc-context";

type TRPCContext = ReturnType<typeof useTRPC>;

// A product has one owning group, so both mutation directions invalidate the
// batched ownership read and per-product chips. Callers separately invalidate
// listGroupProducts because attach and detach have different list scope.
export function invalidateGroupProductOwnership(
  qc: QueryClient,
  trpc: TRPCContext,
): Promise<unknown> {
  return Promise.all([
    qc.invalidateQueries(trpc.admin.listProductGroupOwnership.pathFilter()),
    qc.invalidateQueries(trpc.admin.listProductGroups.pathFilter()),
  ]);
}
