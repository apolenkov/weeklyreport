import type {
  CompiledHistoryEntry,
  WeeklyReportGetResponse,
} from "@customreport/shared";

import {
  formatPeriodRangeWithYear,
  isoWeekNumber,
} from "../../../lib/format-date";
import type { ReportPeriod } from "../../report-sections";

// Prepend the displayed period when the archive toggle hides it from compiledHistory.
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
    // Navigation-only shape: the viewer offers no fill-from and no submission
    // marker, so these two carry no section identity (see period-navigator's
    // `leadSubmittedAt`, the only source the marker trusts).
    sourceSectionId: "",
    isCurrent: false,
    isSubmitted: true,
  };
}
