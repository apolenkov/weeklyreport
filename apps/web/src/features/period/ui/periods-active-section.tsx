import type { PeriodListItem } from "@customreport/shared";

import { PeriodTable, type PeriodTableProps } from "./periods-tab-table";

/**
 * Active section: rows with periodState ∈ {scheduled, open, published}.
 * Always rendered (unlike the collapsed-by-default archive section) since
 * it's the primary panel a head lands on.
 */
export function PeriodsActiveSection({
  isLoading,
  rows,
  ...rowActions
}: {
  readonly isLoading: boolean;
  readonly rows: readonly PeriodListItem[];
} & Omit<PeriodTableProps, "rows" | "testIdPrefix">) {
  return (
    <section aria-labelledby="periods-active-heading" className="space-y-3">
      <header className="flex items-baseline justify-between">
        <h3
          id="periods-active-heading"
          className="font-[family-name:var(--font-sans)] text-base font-semibold text-[var(--color-foreground)]"
        >
          Active
        </h3>
        <span className="text-xs text-[var(--color-muted-foreground)]">
          scheduled · open · published
        </span>
      </header>

      {isLoading ? (
        <div
          className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted-foreground)]"
          data-testid="periods-active-loading"
        >
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div
          className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted-foreground)]"
          data-testid="periods-active-empty"
        >
          No active periods.
        </div>
      ) : (
        <PeriodTable testIdPrefix="active" rows={rows} {...rowActions} />
      )}
    </section>
  );
}
