import type { AnalyticsPeriod } from "@weeklyreport/shared";

import { formatPeriodRangeWithYear } from "../../../shared/lib/format/format-date";
import { periodOmissionNote } from "../../../shared/lib/format/record-omission-text";

/**
 * Names the periods whose statuses and risk counts leave out unfinished risks
 * and decisions. It stays beside an empty table too: no fact rows is not the
 * same as nothing left out.
 */
export function AnalyticsOmissionNotes({
  periods,
}: {
  readonly periods: readonly (AnalyticsPeriod | null)[];
}) {
  const lines = new Map<string, string>();
  for (const period of periods) {
    const note = period === null ? null : periodOmissionNote(period.omissions);
    if (period !== null && note !== null) {
      lines.set(
        period.periodEnd,
        `${formatPeriodRangeWithYear(period.periodStart, period.periodEnd)}: ${note}`,
      );
    }
  }
  if (lines.size === 0) return null;
  return (
    <div
      role="note"
      aria-label="Records these figures leave out"
      className="mt-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm text-[var(--color-foreground)]"
    >
      <p>
        Statuses and risk counts leave out risks and decisions still being
        written:
      </p>
      <ul className="mt-1 list-disc pl-5">
        {[...lines].map(([key, line]) => (
          <li key={key}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
