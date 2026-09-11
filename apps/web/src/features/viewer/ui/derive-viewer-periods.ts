import type {
  CompiledHistoryEntry,
  WeeklyReportGetResponse,
} from "@customreport/shared";

import type { ReportPeriod } from "../../report-sections";
import { toNavigationPeriod } from "../../report-sections";

// Prepend the displayed period when the archive toggle hides it from
// compiledHistory, then keep the combined list newest-first: the period
// navigator treats index order as chronology for Prev/Next.
export function deriveViewerPeriods(
  historyEntries: readonly CompiledHistoryEntry[] | undefined,
  displayed: WeeklyReportGetResponse | undefined,
  reportId: string,
): readonly ReportPeriod[] {
  const entries = historyEntries ?? [];
  const historyPeriods: readonly ReportPeriod[] = entries.map((entry) =>
    toNavigationPeriod({
      id: entry.reportId,
      periodStart: entry.periodStart,
      periodEnd: entry.periodEnd,
      archived: entry.archived,
      isCurrent: false,
    }),
  );

  const seen = new Set(historyPeriods.map((p) => p.id));
  const displayedPeriod =
    displayed && displayed.status !== "no-period" && !seen.has(reportId)
      ? toNavigationPeriod({
          id: reportId,
          periodStart: displayed.periodStart,
          periodEnd: displayed.periodEnd,
          archived: displayed.archived,
          isCurrent: false,
          periodState: displayed.periodState,
        })
      : undefined;

  const combined =
    displayedPeriod === undefined
      ? historyPeriods
      : [displayedPeriod, ...historyPeriods];
  return [...combined].sort(
    (left, right) => right.periodStart.getTime() - left.periodStart.getTime(),
  );
}
