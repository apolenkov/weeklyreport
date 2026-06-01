/**
 * Loading-state skeleton for the Lead Form. Mirrors the dimensions of the
 * pipeline + accordion sections so the load-to-data transition has no layout
 * shift.
 *
 * Stateless and hook-free — safe to render server-side.
 */

import { Skeleton } from "@customreport/ui/components/ui/skeleton";

function PlaceholderAccordion({
  rows,
  minHeight,
}: {
  readonly rows: number;
  readonly minHeight?: number;
}) {
  return (
    <div
      className="overflow-hidden rounded-[var(--radius)] border border-[rgba(0,0,0,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.97)_0%,rgba(255,255,255,0.94)_100%)] p-5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.08),0_8px_18px_-14px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.05)]"
      style={minHeight === undefined ? undefined : { minHeight }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-16 rounded-[var(--radius-pill)]" />
        </div>
        <Skeleton className="h-4 w-4" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function LeadFormSkeleton() {
  return (
    <div
      role="status"
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading report form"
    >
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-6 w-24 rounded-[var(--radius-pill)]" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-28 rounded-[var(--radius-pill)]" />
          <Skeleton className="h-11 w-28 rounded-[var(--radius-pill)]" />
          <Skeleton className="h-11 w-32 rounded-[var(--radius-pill)]" />
        </div>
      </div>

      {/* Period nav + version history shell */}
      <div className="flex flex-wrap items-center justify-between gap-3.5 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(255,255,255,0.78)_100%)] px-4 py-3.5">
        <Skeleton className="h-11 w-60 rounded-lg" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-11 w-40 rounded-[var(--radius-pill)]" />
      </div>

      {/* Pipeline (Product Status) */}
      <PlaceholderAccordion rows={3} minHeight={244} />

      {/* Current Week */}
      <PlaceholderAccordion rows={3} minHeight={404} />

      {/* Next Week */}
      <PlaceholderAccordion rows={3} minHeight={292} />

      {/* Risks & Blockers */}
      <PlaceholderAccordion rows={2} minHeight={342} />

      {/* Decisions */}
      <PlaceholderAccordion rows={7} minHeight={510} />

      {/* Top 3 Priorities */}
      <PlaceholderAccordion rows={6} minHeight={412} />
    </div>
  );
}
