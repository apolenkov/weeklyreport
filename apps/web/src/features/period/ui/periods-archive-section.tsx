import type { PeriodListItem } from "@customreport/shared";

import { Chevron } from "./periods-tab-icons";
import { PeriodTable, type PeriodTableProps } from "./periods-tab-table";

// Caller gates the archive query on `expanded` — first fetch is on open.
export function PeriodsArchiveSection({
  expanded,
  onToggle,
  isLoading,
  rows,
  ...rowActions
}: {
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly isLoading: boolean;
  readonly rows: readonly PeriodListItem[];
} & Omit<PeriodTableProps, "rows" | "testIdPrefix">) {
  return (
    <section aria-labelledby="periods-archive-heading" className="space-y-3">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 text-base font-semibold text-[var(--color-foreground)] hover:text-[var(--color-starbucks-accent)]"
          aria-expanded={expanded}
          aria-controls="periods-archive-body"
          data-testid="periods-archive-toggle"
        >
          <Chevron expanded={expanded} />
          <span id="periods-archive-heading">Archive</span>
        </button>
        <span className="text-xs text-[var(--color-muted-foreground)]">
          archived
        </span>
      </header>

      {expanded && (
        <div id="periods-archive-body" data-testid="periods-archive-body">
          <ArchiveBody isLoading={isLoading} rows={rows} {...rowActions} />
        </div>
      )}
    </section>
  );
}

const PLACEHOLDER_CLASS =
  "rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted-foreground)]";

function ArchiveBody({
  isLoading,
  rows,
  ...rowActions
}: {
  readonly isLoading: boolean;
  readonly rows: readonly PeriodListItem[];
} & Omit<PeriodTableProps, "rows" | "testIdPrefix">) {
  if (isLoading) {
    return (
      <div className={PLACEHOLDER_CLASS} data-testid="periods-archive-loading">
        Loading archive…
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className={PLACEHOLDER_CLASS} data-testid="periods-archive-empty">
        No archived periods.
      </div>
    );
  }
  return <PeriodTable testIdPrefix="archive" rows={rows} {...rowActions} />;
}
