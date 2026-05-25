"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../../lib/trpc-context";

const POLL_INTERVAL_MS = 15_000;
const MS_24H = 24 * 60 * 60 * 1000;

/**
 * T-F4-4 §23.4: KPI card showing the count of lead sections edited in the
 * last 24 hours. Uses the already-polled `activity.live` feed so there is no
 * extra network request when `ActivityLivePanel` is mounted alongside it.
 */
export function Activity24hCard() {
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.activity.live.queryOptions(),
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  const count = (() => {
    if (!query.data?.rows) return null;
    const cutoff = Date.now() - MS_24H;
    return query.data.rows.filter(
      (row) => row.lastEditAt !== null && new Date(row.lastEditAt).getTime() > cutoff,
    ).length;
  })();

  const isLoading = query.isLoading && count === null;

  return (
    <div
      className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.14),0_1px_1px_0_rgba(0,0,0,0.24)]"
      style={{ borderLeft: "3px solid var(--color-starbucks-accent)" }}
      aria-label={`24h Activity: ${count ?? "loading"} updates in last 24 hours`}
      data-testid="activity-24h-card"
    >
      <p className="mb-2 text-sm font-medium text-[var(--color-muted-foreground)]">
        24h Activity
      </p>
      {isLoading ? (
        <div className="h-8 w-12 animate-pulse rounded bg-[var(--color-muted)]" />
      ) : (
        <>
          <div className="font-[family-name:var(--font-sans)] text-[32px] font-bold leading-none text-[var(--color-primary)]">
            {count ?? "—"}
          </div>
          <p className="mt-2 text-[13px] text-[var(--color-muted-foreground)]">
            Updates in last 24h
          </p>
        </>
      )}
    </div>
  );
}
