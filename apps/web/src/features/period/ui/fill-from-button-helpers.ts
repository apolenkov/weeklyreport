import { MONTHS_SHORT } from "../../../lib/format-date";
import type { ReportPeriod } from "../../report-sections";

// Inverse of the table these labels were rendered from, so the two cannot drift.
const MONTH_INDEX = new Map(
  MONTHS_SHORT.map((month, index) => [month, index] as const),
);
const PERIOD_START_PATTERN =
  /^([A-Z][a-z]{2}) (\d{1,2})(?:, (\d{4}))?.*?(\d{4})$/;

function periodStartTimestamp(period: ReportPeriod): number | null {
  const match = PERIOD_START_PATTERN.exec(period.dateRange);
  if (!match) return null;
  const [, monthName, dayText, explicitStartYear, endYear] = match;
  const month =
    monthName === undefined ? undefined : MONTH_INDEX.get(monthName);
  const day = dayText === undefined ? Number.NaN : Number.parseInt(dayText, 10);
  const yearText = explicitStartYear ?? endYear;
  if (month === undefined || yearText === undefined || Number.isNaN(day)) {
    return null;
  }
  return Date.UTC(Number.parseInt(yearText, 10), month, day);
}

/**
 * Sort Most Recent First.
 * @param periods - The periods argument.
 */
export function sortMostRecentFirst(
  periods: readonly ReportPeriod[],
): ReportPeriod[] {
  return [...periods].sort((left, right) => {
    const leftStart = periodStartTimestamp(left);
    const rightStart = periodStartTimestamp(right);
    // Unparseable ranges sort LAST deterministically — returning 0 for a
    // null-vs-date pair would make the comparator non-transitive and let an
    // older period surface above a newer one.
    if (leftStart === null && rightStart === null) return 0;
    if (leftStart === null) return 1;
    if (rightStart === null) return -1;
    return rightStart - leftStart;
  });
}
