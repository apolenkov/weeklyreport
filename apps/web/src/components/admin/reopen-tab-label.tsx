"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../lib/trpc-context";
import { TabCountPill } from "./tab-count-pill";

type Props = {
  readonly active?: boolean;
};

/**
 * Tab label for the Reopen Requests admin tab. The count is an absolute
 * corner badge so async query hydration cannot move the tab row.
 *
 * Polling is intentionally absent — the count refreshes on tab focus +
 * after a respondReopenRequest mutation invalidates the query. New requests
 * arriving while the page is open are surfaced on the next interaction.
 */
export function ReopenTabLabel(_props: Props) {
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
