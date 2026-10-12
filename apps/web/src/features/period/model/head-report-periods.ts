import type {
  CompiledHistoryEntry,
  WeeklyReportGetResponse,
} from "@weeklyreport/shared";

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
  // A live lifecycle candidate owns the current envelope for ITS report: a
  // reopened period may be re-dated while the compiled entry keeps the frozen
  // snapshot. The displayed candidate is keyed by the URL id, but its payload
  // may describe a different report (e.g. the active week resolved for a
  // superseded id) — never project that envelope onto this entry.
  const live =
    lifecycleCandidate?.data.reportId === entry.reportId
      ? lifecycleCandidate.data
      : undefined;
  return toNavigationPeriod({
    id: entry.reportId,
    periodStart: live?.periodStart ?? entry.periodStart,
    periodEnd: live?.periodEnd ?? entry.periodEnd,
    archived: live?.archived ?? entry.archived,
    isCurrent: entry.reportId === activeReportId,
    periodState:
      live?.periodState ??
      (entry.archived ? "archived" : entry.reopened ? "open" : "published"),
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

  // Newest-first; a stable sort keeps the active-then-displayed prepend order
  // for same-week ties.
  return [...prepended, ...historyPeriods].sort(
    (left, right) => right.periodStart.getTime() - left.periodStart.getTime(),
  );
}
