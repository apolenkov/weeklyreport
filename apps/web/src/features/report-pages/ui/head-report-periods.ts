import type {
  CompiledHistoryEntry,
  WeeklyReportGetResponse,
} from "@customreport/shared";

import type { ReportPeriod } from "../../report-sections";
import { toNavigationPeriod } from "../../report-sections";

type ActivePeriodData = Extract<WeeklyReportGetResponse, { status: "active" }>;

interface PrependCandidate {
  readonly id: string;
  readonly data: ActivePeriodData;
}

function historyEntryToPeriod(entry: CompiledHistoryEntry): ReportPeriod {
  return toNavigationPeriod({
    id: entry.reportId,
    periodStart: entry.periodStart,
    periodEnd: entry.periodEnd,
    archived: entry.archived,
    isCurrent: false,
  });
}

function candidateToPeriod(candidate: PrependCandidate): ReportPeriod {
  const { data } = candidate;
  return toNavigationPeriod({
    id: candidate.id,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    archived: false,
    // Mirror mapWeeklyReport: a non-published period is the current week.
    isCurrent: data.periodStatus !== "published",
  });
}

// Prepend current + displayed weeks when history omits them. Prepended entry
// ids must be reportIds so the navigator's `p.id === pathReportId` match works.
/**
 * Derive Head Periods.
 * @param historyEntries - The historyEntries argument.
 * @param active - The active argument.
 * @param displayed - The displayed argument.
 * @param reportId - The reportId argument.
 */
export function deriveHeadPeriods(
  historyEntries: readonly CompiledHistoryEntry[],
  active: WeeklyReportGetResponse | undefined,
  displayed: WeeklyReportGetResponse | undefined,
  reportId: string,
): ReportPeriod[] {
  const historyPeriods = historyEntries.map(historyEntryToPeriod);

  const activeCandidate: PrependCandidate | null =
    active && active.status !== "no-period"
      ? { id: active.reportId, data: active }
      : null;
  const displayedCandidate: PrependCandidate | null =
    displayed && displayed.status !== "no-period"
      ? { id: reportId, data: displayed }
      : null;
  const candidates = [activeCandidate, displayedCandidate].filter(
    (candidate): candidate is PrependCandidate => candidate !== null,
  );

  const { list: prepended } = candidates.reduce<{
    readonly list: readonly ReportPeriod[];
    readonly seen: ReadonlySet<string>;
  }>(
    (acc, candidate) =>
      acc.seen.has(candidate.id)
        ? acc
        : {
            list: [...acc.list, candidateToPeriod(candidate)],
            seen: new Set([...acc.seen, candidate.id]),
          },
    { list: [], seen: new Set(historyPeriods.map((period) => period.id)) },
  );

  return [...prepended, ...historyPeriods];
}
