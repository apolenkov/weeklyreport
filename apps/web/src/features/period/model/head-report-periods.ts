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

function historyEntryToPeriod(
  entry: CompiledHistoryEntry,
  activeReportId: string | null,
  lifecycleCandidate: PrependCandidate | undefined,
): ReportPeriod {
  return toNavigationPeriod({
    id: entry.reportId,
    periodStart: entry.periodStart,
    periodEnd: entry.periodEnd,
    archived: lifecycleCandidate?.data.archived ?? entry.archived,
    isCurrent: entry.reportId === activeReportId,
    periodState:
      lifecycleCandidate?.data.periodState ??
      (entry.archived ? "archived" : "published"),
  });
}

function candidateToPeriod(
  candidate: PrependCandidate,
  activeReportId: string | null,
): ReportPeriod {
  const { data } = candidate;
  return toNavigationPeriod({
    id: candidate.id,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    archived: data.archived,
    isCurrent: candidate.id === activeReportId,
    periodState: data.periodState,
  });
}

// Prepend current + displayed weeks when history omits them. Prepended entry
// ids must be reportIds so the navigator's `p.id === pathReportId` match works.
export function deriveHeadPeriods(
  historyEntries: readonly CompiledHistoryEntry[],
  active: WeeklyReportGetResponse | undefined,
  displayed: WeeklyReportGetResponse | undefined,
  reportId: string,
): readonly ReportPeriod[] {
  const activeReportId =
    active && active.status !== "no-period" ? active.reportId : null;

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
  const historyPeriods = historyEntries.map((entry) =>
    historyEntryToPeriod(
      entry,
      activeReportId,
      candidates.find((candidate) => candidate.id === entry.reportId),
    ),
  );

  const { list: prepended } = candidates.reduce<{
    readonly list: readonly ReportPeriod[];
    readonly seen: ReadonlySet<string>;
  }>(
    (acc, candidate) =>
      acc.seen.has(candidate.id)
        ? acc
        : {
            list: [...acc.list, candidateToPeriod(candidate, activeReportId)],
            seen: new Set([...acc.seen, candidate.id]),
          },
    { list: [], seen: new Set(historyPeriods.map((period) => period.id)) },
  );

  return [...prepended, ...historyPeriods];
}
