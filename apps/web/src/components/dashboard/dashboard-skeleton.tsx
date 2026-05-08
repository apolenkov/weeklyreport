import { Skeleton } from '@customreport/ui/components/ui/skeleton';

/**
 * Loading-state skeleton for the head dashboard. Mirrors the dimensions of
 * Submission Activity / KpiCards / AlertBar / BlockedAtRiskTable /
 * ReportArchiveSection so the load-to-data transition has no layout shift.
 *
 * Stateless and hook-free — safe to render server-side.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Submission Activity */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="space-y-1">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-[var(--radius)]" />
          ))}
        </div>
      </div>

      {/* KPI Cards (3-up grid) */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-5"
          >
            <Skeleton className="mb-3 h-3 w-20" />
            <Skeleton className="h-12 w-32" />
            <Skeleton className="mt-3 h-3 w-28" />
          </div>
        ))}
      </div>

      {/* Alert bar */}
      <Skeleton className="h-12 w-full rounded-[var(--radius)]" />

      {/* Blocked & At Risk header */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-white">
        <div className="flex items-center justify-between p-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-4" />
        </div>
        <div className="space-y-2 px-4 pb-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* Archive grid (4-up) */}
      <div>
        <div className="mt-6 flex items-center justify-between">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-[var(--radius)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
