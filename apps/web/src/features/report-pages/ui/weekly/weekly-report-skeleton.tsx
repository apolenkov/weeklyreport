// Loading skeleton for Weekly Report — mirrors page DOM to avoid layout shift.

import { Skeleton } from "@customreport/ui/components/ui/skeleton";

// Fixed placeholder row count for the skeleton's grid/accordion shapes; a
// loading placeholder cannot know the real row count, so it is deliberately
// independent of any seed or report data.
const PLACEHOLDER_CARD_COUNT = 6;

function PortfolioCardSkeleton() {
  return (
    <div className="grid min-h-[76px] w-full grid-cols-[1.75rem_minmax(0,1fr)_1.5rem] items-center gap-2 overflow-hidden rounded-lg bg-[var(--color-surface-skeleton)] p-2.5">
      <Skeleton className="h-7 w-7 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-40" />
      </div>
      <span className="h-6 w-6" aria-hidden="true" />
    </div>
  );
}

function PortfolioSkeleton() {
  return (
    <div className="card-surface">
      <div className="flex w-full items-center justify-between p-4">
        <div className="w-full">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded-sm" />
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="mt-1 h-3 w-72" />
        </div>
      </div>
      <div className="grid gap-2 px-4 pb-4 sm:grid-cols-2">
        {Array.from({ length: PLACEHOLDER_CARD_COUNT }, (_, i) => (
          <PortfolioCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function AccordionSkeleton() {
  return (
    <div className="card-surface p-5">
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
      role="status"
      className="space-y-4"
      aria-busy="true"
      aria-label="Loading status report"
      data-testid="weekly-report-skeleton"
    >
      {/* Header: title + Live pill | Export + Publish (exactly 2 buttons). */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-6 w-32 rounded-[var(--radius-pill)]" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-28 rounded-[var(--radius-pill)]" />
          <Skeleton className="h-11 w-36 rounded-[var(--radius-pill)]" />
        </div>
      </div>

      {/* Period nav shell with dept · Live portfolio review right slot. */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--toolbar-band-gradient)] px-4 py-3.5 shadow-[0_0_0.5px_0_var(--color-border-subtle),0_10px_24px_-20px_var(--card-surface-shadow)]">
        <Skeleton className="h-11 w-60 rounded-lg" />
        <div className="flex min-w-[180px] flex-1 items-center justify-center gap-2">
          <Skeleton className="h-4 w-24" />
          <span className="text-[var(--color-muted-foreground)]">&middot;</span>
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      <PortfolioSkeleton />

      <div className="space-y-3">
        {Array.from({ length: PLACEHOLDER_CARD_COUNT }, (_, i) => (
          <AccordionSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
