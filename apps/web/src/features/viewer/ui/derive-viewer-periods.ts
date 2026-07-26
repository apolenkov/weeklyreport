import type {
  CompiledHistoryEntry,
  WeeklyReportGetResponse,
} from "@customreport/shared";

import type { ReportPeriod } from "../../report-sections";
import { toNavigationPeriod } from "../../report-sections";

// Prepend the displayed period when the archive toggle hides it from compiledHistory.
export function deriveViewerPeriods(
  historyEntries: readonly CompiledHistoryEntry[] | undefined,
  displayed: WeeklyReportGetResponse | undefined,
  reportId: string,
): ReportPeriod[] {
  const entries = historyEntries ?? [];
  const historyPeriods: ReportPeriod[] = entries.map((entry) =>
    toNavigationPeriod({
      id: entry.reportId,
      periodStart: entry.periodStart,
      periodEnd: entry.periodEnd,
      archived: entry.archived,
      isCurrent: false,
    }),
  );

  const seen = new Set(historyPeriods.map((p) => p.id));
  if (displayed && displayed.status !== "no-period" && !seen.has(reportId)) {
    return [
      toNavigationPeriod({
        id: reportId,
        periodStart: displayed.periodStart,
        periodEnd: displayed.periodEnd,
        archived: false,
        isCurrent: false,
      }),
      ...historyPeriods,
    ];
  }
  return historyPeriods;
}
