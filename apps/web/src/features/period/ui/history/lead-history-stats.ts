import type { HistoryEntry } from "../../../report-sections";

const COMPLETED_WEEK_STATUSES: ReadonlySet<HistoryEntry["status"]> = new Set([
  "submitted",
  "published",
  "archived",
]);
const PERCENT_MAX = 100;

export interface HistoryStats {
  readonly total: number;
  readonly submitted: number;
  readonly completionRate: number;
  readonly draftCount: number;
  readonly totalGreen: number;
  readonly totalYellow: number;
  readonly totalRed: number;
  readonly totalRisks: number;
  readonly avgItems: number;
  readonly streak: number;
}

function isCompletedWeek(entry: HistoryEntry): boolean {
  return COMPLETED_WEEK_STATUSES.has(entry.status);
}

// Aggregates cover completed weeks only, so drafts never dilute averages.
export function deriveHistoryStats(
  entries: readonly HistoryEntry[],
): HistoryStats {
  const total = entries.length;
  const submittedEntries = entries.filter(isCompletedWeek);
  const submitted = submittedEntries.length;
  const sum = (pick: (entry: HistoryEntry) => number): number =>
    submittedEntries.reduce((acc, entry) => acc + pick(entry), 0);
  const firstIncompleteIndex = entries.findIndex(
    (entry) => !isCompletedWeek(entry),
  );

  return {
    total,
    submitted,
    completionRate:
      total === 0 ? 0 : Math.round((submitted / total) * PERCENT_MAX),
    draftCount: total - submitted,
    totalGreen: sum((entry) => entry.trafficLights.green),
    totalYellow: sum((entry) => entry.trafficLights.yellow),
    totalRed: sum((entry) => entry.trafficLights.red),
    totalRisks: sum((entry) => entry.riskCount),
    avgItems:
      submitted === 0
        ? 0
        : Math.round(sum((entry) => entry.itemCount) / submitted),
    streak: firstIncompleteIndex === -1 ? total : firstIncompleteIndex,
  };
}
