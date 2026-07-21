import type { QueryClient } from "@tanstack/react-query";

import type { useTRPC } from "../../../lib/trpc-context";

type TRPCContext = ReturnType<typeof useTRPC>;

/**
 * Invalidation shared by both attach and detach: a product has exactly one
 * owning group, so either mutation stales the batched ownership read plus
 * the per-product ownership chips on the Products tab. Callers additionally
 * invalidate `listGroupProducts` themselves, scoped differently per
 * direction (attach may reassign and so must refresh every group's list;
 * detach only ever affects the current group's list).
 */
export function invalidateGroupProductOwnership(
  qc: QueryClient,
  trpc: TRPCContext,
): Promise<unknown> {
  return Promise.all([
    qc.invalidateQueries(trpc.admin.listProductGroupOwnership.pathFilter()),
    qc.invalidateQueries(trpc.admin.listProductGroups.pathFilter()),
  ]);
}
