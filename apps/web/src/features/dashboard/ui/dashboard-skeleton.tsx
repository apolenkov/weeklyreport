import { Skeleton } from "@customreport/ui/components/ui/skeleton";

const ACTIVITY_ROW_COUNT = 6;
const LEAD_TABLE_BODY_ROW_COUNT = 5;
const BLOCKED_AT_RISK_ROW_COUNT = 5;
const LEAD_TABLE_COL_LEAD_WIDTH = 120;
const LEAD_TABLE_COL_ROLE_WIDTH = 80;
const LEAD_TABLE_COL_STATUS_WIDTH = 80;
const LEAD_TABLE_COL_PROGRESS_WIDTH = 80;
const LEAD_TABLE_COL_ACTION_WIDTH = 100;
// Literal classes keep these closed-set widths visible to Tailwind's static scanner.
const LEAD_TABLE_COLUMN_WIDTH_CLASSES: Record<number, string> = {
  80: "w-[80px]",
  100: "w-[100px]",
  120: "w-[120px]",
};
const LEAD_TABLE_COLUMN_WIDTHS = [
  LEAD_TABLE_COL_LEAD_WIDTH,
  LEAD_TABLE_COL_ROLE_WIDTH,
  LEAD_TABLE_COL_STATUS_WIDTH,
  LEAD_TABLE_COL_PROGRESS_WIDTH,
  LEAD_TABLE_COL_ACTION_WIDTH,
];

const activityRowIndexes = Array.from(
  { length: ACTIVITY_ROW_COUNT },
  (_, i) => i,
);
const leadTableBodyRowIndexes = Array.from(
  { length: LEAD_TABLE_BODY_ROW_COUNT },
  (_, i) => i,
);
const blockedAtRiskRowIndexes = Array.from(
  { length: BLOCKED_AT_RISK_ROW_COUNT },
  (_, i) => i,
);

/**
 * Loading-state skeleton for the head dashboard. Mirrors the dimensions of
 * ActivityLivePanel / KpiCards / LeadSummaryTable / AlertBar /
 * BlockedAtRiskTable in the exact render order so the load-to-data transition
 * has minimal layout shift.
 *
 * Stateless and hook-free — safe to render server-side.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* ActivityLivePanel — card with header + 6 lead rows */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-[0_0_0.5px_0_rgba(0,0,0,0.14),0_1px_1px_0_rgba(0,0,0,0.24)]">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-36" />
        </div>
        <ul className="space-y-1">
          {activityRowIndexes.map((i) => (
            <li key={i} className="flex items-center gap-3 py-1">
              <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-20 rounded-[var(--radius-pill)]" />
            </li>
          ))}
        </ul>
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

      {/* LeadSummaryTable — header + table rows */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-24 rounded-[var(--radius-pill)]" />
        </div>
        <div className="overflow-x-auto">
          <div className="w-full">
            {/* thead placeholder */}
            <div className="flex gap-4 border-b border-[var(--color-border)] px-5 py-3">
              {LEAD_TABLE_COLUMN_WIDTHS.map((w, i) => {
                const cls = `h-3 ${LEAD_TABLE_COLUMN_WIDTH_CLASSES[w]}`;
                return (
                  // eslint-disable-next-line react/no-array-index-key -- static column-width array, order never changes
                  <Skeleton key={i} className={cls} />
                );
              })}
            </div>
            {/* tbody rows */}
            {leadTableBodyRowIndexes.map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-[var(--color-border)] px-5 py-3 last:border-0"
              >
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="ml-auto h-5 w-20 rounded-[var(--radius-pill)]" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AlertBar */}
      <Skeleton className="h-12 w-full rounded-[var(--radius)]" />

      {/* BlockedAtRiskTable */}
      <div className="rounded-[var(--radius)] border border-[var(--color-border)] bg-white">
        <div className="flex items-center justify-between p-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-4" />
        </div>
        <div className="space-y-2 px-4 pb-4">
          {blockedAtRiskRowIndexes.map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
