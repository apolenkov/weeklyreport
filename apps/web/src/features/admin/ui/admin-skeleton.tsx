import { Skeleton } from "@customreport/ui/components/ui/skeleton";

interface AdminTabSkeletonProps {
  readonly variant: "table" | "form";
}

const FORM_FIELD_COUNT = 4;
const TABLE_COLUMN_COUNT = 5;
const TABLE_BODY_ROW_COUNT = 6;

const formFieldIndexes = Array.from({ length: FORM_FIELD_COUNT }, (_, i) => i);
const tableColumnIndexes = Array.from(
  { length: TABLE_COLUMN_COUNT },
  (_, i) => i,
);
const tableBodyRowIndexes = Array.from(
  { length: TABLE_BODY_ROW_COUNT },
  (_, i) => i,
);

/**
 * Loading-state skeleton for admin tabs. Matches final UI dimensions to
 * prevent layout shift when the snapshot query resolves.
 *
 * - 'table' renders a 5-column header row with 6 body rows of skeleton cells,
 *   matching Users / Products / Periods / Reminders tabs.
 * - 'form' renders 4 stacked label+input skeletons matching SettingsTab.
 */
export function AdminTabSkeleton({ variant }: AdminTabSkeletonProps) {
  if (variant === "form") {
    return (
      <div className="max-w-lg space-y-5">
        {formFieldIndexes.map((row) => (
          <div key={row} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-32" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-11 w-32 rounded-[var(--radius-pill)]" />
      </div>
      <div className="rounded-[var(--radius)] border border-[var(--color-border)]">
        {/* Header row */}
        <div className="grid grid-cols-5 gap-4 border-b border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3">
          {tableColumnIndexes.map((col) => (
            <Skeleton key={col} className="h-4 w-24" />
          ))}
        </div>
        {/* Body rows */}
        {tableBodyRowIndexes.map((row) => (
          <div
            key={row}
            className="grid grid-cols-5 gap-4 border-b border-[var(--color-border)] px-4 py-3 last:border-0"
          >
            {tableColumnIndexes.map((col) => (
              <Skeleton key={col} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
