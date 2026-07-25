// Mirrors pipeline + accordion dimensions so load-to-data has no layout shift.

import { Skeleton } from "@customreport/ui/components/ui/skeleton";

// Row count and reserved height measured from each loaded accordion, in the
// order the form renders them — the numbers only mean anything paired with the
// section they stand in for.
const SECTION_PLACEHOLDERS = [
  { section: "Product Status", rows: 3, minHeight: 244 },
  { section: "Current Week", rows: 3, minHeight: 404 },
  { section: "Next Week", rows: 3, minHeight: 292 },
  { section: "Risks & Blockers", rows: 2, minHeight: 342 },
  { section: "Decisions", rows: 7, minHeight: 510 },
  { section: "Priorities", rows: 6, minHeight: 412 },
] as const;

function PlaceholderAccordion({
  rows,
  minHeight,
}: {
  readonly rows: number;
  readonly minHeight?: number;
}) {
  return (
    <div
      className="card-surface p-5"
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

/**
 * Lead Form Skeleton.
 */
export function LeadFormSkeleton() {
  return (
    <div
      role="status"
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading report form"
    >
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

      <div className="toolbar-band-fill flex flex-wrap items-center justify-between gap-3.5 rounded-2xl border border-[var(--color-border-subtle)] px-4 py-3.5">
        <Skeleton className="h-11 w-60 rounded-lg" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-11 w-40 rounded-[var(--radius-pill)]" />
      </div>

      {SECTION_PLACEHOLDERS.map((placeholder) => (
        <PlaceholderAccordion
          key={placeholder.section}
          rows={placeholder.rows}
          minHeight={placeholder.minHeight}
        />
      ))}
    </div>
  );
}
