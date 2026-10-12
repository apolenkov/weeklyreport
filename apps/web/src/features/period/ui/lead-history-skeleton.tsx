// Mirrors LeadHistoryList card grid dimensions to avoid layout shift on data arrival.

import { Skeleton } from "@weeklyreport/ui/components/ui/skeleton";

interface LeadHistorySkeletonProps {
  readonly count?: number;
}

const DEFAULT_SKELETON_CARD_COUNT = 6;

export function LeadHistorySkeleton({
  count = DEFAULT_SKELETON_CARD_COUNT,
}: LeadHistorySkeletonProps) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2"
      role="status"
      aria-busy="true"
      aria-label="Loading history"
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-6 w-24 rounded-[var(--radius-pill)]" />
          </div>

          <Skeleton className="h-4 w-32" />

          <div className="mt-3 flex items-center gap-2">
            <Skeleton className="h-[14px] w-[14px] rounded-full" />
            <Skeleton className="h-[14px] w-[14px] rounded-full" />
            <Skeleton className="h-[14px] w-[14px] rounded-full" />
          </div>

          <Skeleton className="mt-3 h-5 w-full rounded-full" />

          <div className="mt-4 space-y-2 border-t border-[var(--color-border-subtle)] pt-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}
