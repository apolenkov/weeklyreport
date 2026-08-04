import type { ReportPeriod } from "../../report-sections";

// Chronology comes from the machine-readable periodStart the domain already
// owns — never from reverse-parsing the display dateRange label.
export function sortMostRecentFirst(
  periods: readonly ReportPeriod[],
): ReportPeriod[] {
  return [...periods].sort(
    (left, right) => right.periodStart.getTime() - left.periodStart.getTime(),
  );
}
