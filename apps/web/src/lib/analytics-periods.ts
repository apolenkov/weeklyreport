/**
 * Pick the two most recent period-end labels to compare on the Trends page.
 *
 * `analytics.trafficLightHistory` returns its `periods` array ascending by
 * periodEnd (the repository sorts `orderBy: { periodEnd: "asc" }`), so the last
 * two entries are the latest pair: `periodA` is the older of the two, `periodB`
 * the most recent. Returns null when fewer than two periods exist — there is
 * nothing to compare.
 *
 * Replaces the previously hardcoded PERIOD_A/PERIOD_B constants on the Trends
 * page, which pinned the comparison to fixed April 2026 dates and silently
 * rendered "No comparison data." once the seed moved to runtime-relative period
 * dates (driver sweep 2026-06-09).
 */
export function latestPeriodPair(
  periods: readonly string[],
): { periodA: string; periodB: string } | null {
  if (periods.length < 2) return null;
  return {
    periodA: periods[periods.length - 2],
    periodB: periods[periods.length - 1],
  };
}
