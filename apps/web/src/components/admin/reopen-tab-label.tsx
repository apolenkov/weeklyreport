"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../lib/trpc-context";

type Props = {
  readonly active: boolean;
};

/**
 * Tab label for the Reopen Requests admin tab. Adds a numeric pill showing
 * the count of pending requests so heads see at a glance there's queue.
 *
 * Polling is intentionally absent — the count refreshes on tab focus +
 * after a respondReopenRequest mutation invalidates the query. New requests
 * arriving while the page is open are surfaced on the next interaction.
 */
export function ReopenTabLabel({ active }: Props) {
  const trpc = useTRPC();
  const countQuery = useQuery(
    trpc.admin.pendingReopenCount.queryOptions(undefined, {
      refetchOnWindowFocus: true,
      staleTime: 15_000,
    }),
  );

  const count = countQuery.data?.count ?? 0;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span>reopen</span>
      {count > 0 && (
        <span
          className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
            active
              ? "bg-white/25 text-white"
              : "bg-[var(--color-destructive)] text-white"
          }`}
          aria-label={`${count} pending reopen requests`}
        >
          {count}
        </span>
      )}
    </span>
  );
}
