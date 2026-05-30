/**
 * Loading-state skeleton for the Weekly Report page. Mirrors the DOM
 * structure of `weekly-report-page.tsx` so the load-to-data transition
 * has zero layout shift (CLS).
 *
 * Section-by-section parity (top to bottom, mirrors the real page):
 *   1. Page header  — title + Live pill | ExportPdf + PublishLock (2 buttons)
 *   2. Period nav   — HeadPeriodNavigator | "{org} · Live portfolio review"
 *   3. Portfolio    — single gradient card + sm:grid-cols-2 product cards
 *   4. Accordions   — gradient cards × N matching ProductAccordion header
 *
 * The AI Insights slot was removed with the AI module (see
 * apps/api/src/modules/ai/HANDOFF.md).
 *
 * Stateless and hook-free — safe to render server-side.
 */

import { Skeleton } from "@customreport/ui/components/ui/skeleton";

/**
 * Mirrors {@link PortfolioOverviewTable}'s per-product card:
 *   `grid min-h-[76px] grid-cols-[1.75rem_minmax(0,1fr)_1.5rem]`
 * with a circular status avatar, a 2-line name/status block, and a
 * trailing arrow slot (hidden by default in the real card, kept as a
 * spacer here for column alignment).
 */
function PortfolioCardSkeleton() {
  return (
    <div className="grid min-h-[76px] w-full grid-cols-[1.75rem_minmax(0,1fr)_1.5rem] items-center gap-2 overflow-hidden rounded-lg bg-[rgba(0,0,0,0.04)] p-2.5">
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

/**
 * Mirrors {@link PortfolioOverviewTable}'s outer card: title row
 * (GridIcon + «Portfolio Overview» + count pill + caption) followed by
 * a `sm:grid-cols-2` grid of product cards.
 */
function PortfolioSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)] shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_8px_18px_-14px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.05)]">
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
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <PortfolioCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/**
 * Mirrors {@link ProductAccordion} collapsed header: status avatar +
 * product name + status pill on the left, chevron on the right, inside
 * the same gradient card frame.
 */
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
      aria-label="Loading status report"
      data-testid="weekly-report-skeleton"
    >
      {/* 1. Page header — title + Live pill | ExportPdf + PublishLock.
          Real page renders exactly 2 buttons on the right (not 3). */}
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

      {/* 2. Period nav shell — HeadPeriodNavigator | dept · Live portfolio review.
          Right slot is two short bars separated by a dot to mirror the real
          «{org} · Live portfolio review» line. */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(255,255,255,0.78)_100%)] px-4 py-3.5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.06),0_10px_24px_-20px_rgba(0,0,0,0.22),0_1px_2px_0_rgba(0,0,0,0.05)]">
        <Skeleton className="h-11 w-60 rounded-lg" />
        <div className="flex min-w-[180px] flex-1 items-center justify-center gap-2">
          <Skeleton className="h-4 w-24" />
          <span className="text-[var(--color-muted-foreground)]">&middot;</span>
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* 4. Portfolio Overview — single gradient card containing a 2-col
          card grid (6 placeholders to match the seeded product count). */}
      <PortfolioSkeleton />

      {/* 5. Per-product accordion placeholders — 6 to match portfolio. */}
      <div className="space-y-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <AccordionSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
