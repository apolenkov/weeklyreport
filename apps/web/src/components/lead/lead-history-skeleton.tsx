/**
 * Loading-state skeleton for the Lead History page.
 *
 * Mirrors the card grid dimensions of `LeadHistoryList` so the layout does
 * not shift when the real data arrives. Pure presentational, server-renderable
 * (no hooks, no `'use client'`).
 */

import { Skeleton } from "@customreport/ui/components/ui/skeleton";

interface LeadHistorySkeletonProps {
  readonly count?: number;
}

export function LeadHistorySkeleton({ count = 6 }: LeadHistorySkeletonProps) {
  return (
    <div
      className="grid gap-4 sm:grid-cols-2"
      role="status"
      aria-busy="true"
      aria-label="Loading history"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)] p-5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_8px_18px_-14px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.05)]"
        >
          {/* Header: week label + status badge */}
          <div className="mb-3 flex items-center justify-between">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-6 w-24 rounded-[var(--radius-pill)]" />
          </div>

          {/* Date range */}
          <Skeleton className="h-4 w-32" />

          {/* Traffic lights (three round dots) */}
          <div className="mt-3 flex items-center gap-2">
            <Skeleton className="h-[14px] w-[14px] rounded-full" />
            <Skeleton className="h-[14px] w-[14px] rounded-full" />
            <Skeleton className="h-[14px] w-[14px] rounded-full" />
          </div>

          {/* Summary */}
          <Skeleton className="mt-3 h-5 w-full rounded-full" />

          {/* Timeline */}
          <div className="mt-4 space-y-2 border-t border-[rgba(0,0,0,0.07)] pt-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}
