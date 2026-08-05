"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../../lib/trpc-context";
import { TabCountPill } from "../../../shared/ui/tabs/tab-count-pill";

// Absolute corner badge (no layout shift on hydrate). No polling — refreshes
// on focus and after respondReopenRequest invalidates the query.
export function ReopenTabLabel() {
  const trpc = useTRPC();
  const countQuery = useQuery(
    trpc.admin.pendingReopenCount.queryOptions(undefined, {
      refetchOnWindowFocus: true,
      staleTime: 15_000,
    }),
  );

  const count = countQuery.data?.count ?? 0;
  const countLabel =
    count === 1
      ? "1 pending reopen request"
      : `${count} pending reopen requests`;

  return (
    <span className="relative inline-flex items-center">
      <span>reopen</span>
      <TabCountPill
        ariaLabel={countLabel}
        count={count}
        testId="reopen-tab-count"
      />
    </span>
  );
}
