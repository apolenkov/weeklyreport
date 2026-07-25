import type {
  CompiledHistoryEntry,
  WeeklyReportGetResponse,
} from "@customreport/shared";

import {
  formatPeriodRangeWithYear,
  isoWeekNumber,
} from "../../../lib/format-date";
import type { ReportPeriod } from "../../report-sections";

type ActivePeriodData = Extract<WeeklyReportGetResponse, { status: "active" }>;

interface PrependCandidate {
  readonly id: string;
  readonly data: ActivePeriodData;
}

function historyEntryToPeriod(entry: CompiledHistoryEntry): ReportPeriod {
  return {
    id: entry.reportId,
    weekLabel: `Week ${isoWeekNumber(new Date(entry.periodStart))}`,
    dateRange: formatPeriodRangeWithYear(
      new Date(entry.periodStart),
      new Date(entry.periodEnd),
    ),
    archived: entry.archived,
    sourceSectionId: "",
    isCurrent: false,
    isSubmitted: true,
  };
}

function candidateToPeriod(candidate: PrependCandidate): ReportPeriod {
  const { data } = candidate;
  return {
    id: candidate.id,
    weekLabel: `Week ${isoWeekNumber(new Date(data.periodStart))}`,
    dateRange: formatPeriodRangeWithYear(
      new Date(data.periodStart),
      new Date(data.periodEnd),
    ),
    archived: false,
    sourceSectionId: "",
    // Mirror mapWeeklyReport: a non-published period is the current week.
    isCurrent: data.periodStatus !== "published",
    isSubmitted: true,
  };
}

// Prepend current + displayed weeks when history omits them. Prepended entry
// ids must be reportIds so the navigator's `p.id === pathReportId` match works.
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
