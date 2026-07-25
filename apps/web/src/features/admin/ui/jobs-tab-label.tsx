"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../../lib/trpc-context";
import { TabCountPill } from "../../../shared/ui/tab-count-pill";

// Count badge sits on the Jobs tab corner (not a page-header badge).
export function JobsTabLabel() {
  const trpc = useTRPC();
  const countQuery = useQuery({
    ...trpc.admin.dlqCount.queryOptions(),
    refetchInterval: 30_000,
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
