/**
 * Pick the two most recent period-end labels to compare on the Trends page.
 *
 * `analytics.trafficLightHistory` returns its `periods` array ascending by
 * periodEnd (the repository sorts `orderBy: { periodEnd: "asc" }`), so the last
 * two entries are the latest pair: `periodA` is the older of the two, `periodB`
 * the most recent. Returns null when fewer than two periods exist — there is
 * nothing to compare.
 * @param periods - The periods argument.
 */
export function latestPeriodPair(
  periods: readonly string[],
): { periodA: string; periodB: string } | null {
  const SECOND_LATEST = -2;
  const periodA = periods.at(SECOND_LATEST);
  const periodB = periods.at(-1);
  if (periodA === undefined || periodB === undefined) return null;
  return { periodA, periodB };
}
