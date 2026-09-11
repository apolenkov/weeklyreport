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

// Stable placeholders preserve the form/table shape while the snapshot loads.
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
      <div
        className="overflow-x-auto rounded-[var(--radius)] border border-[var(--color-border)]"
        data-testid="skeleton-table-grid"
      >
        <div className="min-w-[36rem]">
          <div className="grid grid-cols-5 gap-4 border-b border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3">
            {tableColumnIndexes.map((col) => (
              <Skeleton key={col} className="h-4 w-24" />
            ))}
          </div>
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
    </div>
  );
}
