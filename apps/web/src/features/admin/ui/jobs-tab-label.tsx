"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { TabCountPill } from "../../../shared/ui/tabs/tab-count-pill";

// DLQ depth is a background health signal, not a live counter; a slow poll
// keeps the badge fresh without a per-render query on every admin tab.
const DLQ_COUNT_POLL_MS = 30_000;

// Count badge sits on the Jobs tab corner (not a page-header badge).
export function JobsTabLabel() {
  const trpc = useTRPC();
  const countQuery = useQuery({
    ...trpc.admin.dlqCount.queryOptions(),
    refetchInterval: DLQ_COUNT_POLL_MS,
  });

  const count = countQuery.data?.count ?? 0;
  const countLabel =
    count === 1 ? "1 failed job in DLQ" : `${count} failed jobs in DLQ`;

  return (
    <span className="relative inline-flex items-center">
      <span>jobs</span>
      <TabCountPill
        ariaLabel={countLabel}
        count={count}
        testId="jobs-tab-count"
      />
    </span>
  );
}
