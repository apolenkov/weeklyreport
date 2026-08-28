"use client";

import { useQuery } from "@tanstack/react-query";

import { useQueryErrorHandler } from "../../../shared/hooks/query/use-query-error-handler";
import { useTRPC } from "../../../shared/lib/trpc/trpc-context";
import { TabCountPill } from "../../../shared/ui/tabs/tab-count-pill";

// DLQ depth is a background health signal, not a live counter; a slow poll
// keeps the badge fresh without a per-render query on every admin tab.
const DLQ_COUNT_POLL_MS = 30_000;

function formatDlqCountLabel(count: number, unavailable: boolean): string {
  if (unavailable) return "Failed job count unavailable";
  if (count === 1) return "1 failed job in DLQ";
  return `${count} failed jobs in DLQ`;
}

// Count badge sits on the Jobs tab corner (not a page-header badge).
export function JobsTabLabel() {
  const trpc = useTRPC();
  const countQuery = useQuery({
    ...trpc.admin.dlqCount.queryOptions(),
    refetchInterval: DLQ_COUNT_POLL_MS,
  });
  useQueryErrorHandler(countQuery, {
    component: "JobsTabLabel",
    event: "admin.dlq_count.load_failed",
    procedure: "admin.dlqCount",
  });

  const count = countQuery.data?.count ?? 0;
  const countLabel = formatDlqCountLabel(count, countQuery.isError);

  return (
    <span className="relative inline-flex items-center">
      <span>jobs</span>
      <TabCountPill
        ariaLabel={countLabel}
        count={count}
        testId="jobs-tab-count"
        unavailable={countQuery.isError}
      />
    </span>
  );
}
