"use client";

import { useQuery } from "@tanstack/react-query";

import { useQueryErrorHandler } from "../../../shared/hooks/query/use-query-error-handler";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { TabCountPill } from "../../../shared/ui/tabs/tab-count-pill";

function formatReopenCountLabel(count: number, unavailable: boolean): string {
  if (unavailable) return "Pending reopen count unavailable";
  if (count === 1) return "1 pending reopen request";
  return `${count} pending reopen requests`;
}

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
  useQueryErrorHandler(countQuery, {
    component: "ReopenTabLabel",
    event: "admin.pending_reopen_count.load_failed",
    procedure: "admin.pendingReopenCount",
  });

  const count = countQuery.data?.count ?? 0;
  const countLabel = formatReopenCountLabel(count, countQuery.isError);

  return (
    <span className="relative inline-flex items-center">
      <span>reopen</span>
      <TabCountPill
        ariaLabel={countLabel}
        count={count}
        testId="reopen-tab-count"
        unavailable={countQuery.isError}
      />
    </span>
  );
}
