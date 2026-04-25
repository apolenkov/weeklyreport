/**
 * Loading-state skeleton for the Weekly Report page. Mirrors the dimensions of
 * the portfolio overview table + accordion sections so the load-to-data
 * transition has no layout shift.
 *
 * Stateless and hook-free — safe to render server-side.
 */

import { Skeleton } from '@customreport/ui/components/ui/skeleton';

function PortfolioRowSkeleton() {
  return (
    <div className="grid grid-cols-6 gap-4 border-b border-[var(--color-border)] px-4 py-3 last:border-0">
      <Skeleton className="col-span-2 h-4 w-full" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-4 w-12" />
    </div>
  );
}

function AccordionSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)] p-5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_8px_18px_-14px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-6 w-20 rounded-[var(--radius-pill)]" />
        </div>
        <Skeleton className="h-4 w-4" />
      </div>
    </div>
  );
}

export function WeeklyReportSkeleton() {
  return (
    <div
      className="space-y-4"
      aria-busy="true"
      aria-label="Loading weekly report"
    >
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-6 w-32 rounded-[var(--radius-pill)]" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-28 rounded-[var(--radius-pill)]" />
          <Skeleton className="h-11 w-32 rounded-[var(--radius-pill)]" />
          <Skeleton className="h-11 w-32 rounded-[var(--radius-pill)]" />
        </div>
      </div>

      {/* Period nav shell */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(255,255,255,0.78)_100%)] px-4 py-3.5">
        <Skeleton className="h-11 w-60 rounded-lg" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* Portfolio overview table */}
      <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--color-border)]">
        <div className="grid grid-cols-6 gap-4 border-b border-[var(--color-border)] bg-[var(--color-house-green,#1E3932)] px-4 py-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-4 w-full bg-white/40" />
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <PortfolioRowSkeleton key={i} />
        ))}
      </div>

      {/* Per-product accordion placeholders */}
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <AccordionSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
