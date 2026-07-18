import type {
  CompiledHistoryEntry,
  WeeklyReportGetResponse,
} from "@customreport/shared";

import {
  formatPeriodRangeWithYear,
  isoWeekNumber,
} from "../../../lib/format-date";
import type { ReportPeriod } from "../../report-sections";

/**
 * Builds the navigator's period list from compiled history, prepending the
 * currently displayed period when the archive toggle hides it from
 * `compiledHistory` — so the navigator trigger still resolves on this URL.
 */
export function deriveViewerPeriods(
  historyEntries: readonly CompiledHistoryEntry[] | undefined,
  displayed: WeeklyReportGetResponse | undefined,
  reportId: string,
): ReportPeriod[] {
  const entries = historyEntries ?? [];
  const historyPeriods: ReportPeriod[] = entries.map((entry) =>
    toReportPeriod(entry.reportId, entry.periodStart, entry.periodEnd, {
      archived: entry.archived,
    }),
  );

  const seen = new Set(historyPeriods.map((p) => p.id));
  if (displayed && displayed.status !== "no-period" && !seen.has(reportId)) {
    return [
      toReportPeriod(reportId, displayed.periodStart, displayed.periodEnd, {
        archived: false,
      }),
      ...historyPeriods,
    ];
  }
  return historyPeriods;
}

function toReportPeriod(
  id: string,
  periodStart: Date,
  periodEnd: Date,
  options: { readonly archived: boolean },
): ReportPeriod {
  return {
    id,
    weekLabel: `Week ${isoWeekNumber(new Date(periodStart))}`,
    dateRange: formatPeriodRangeWithYear(
      new Date(periodStart),
      new Date(periodEnd),
    ),
    archived: options.archived,
    sourceSectionId: "",
    isCurrent: false,
    isSubmitted: true,
  };
}
