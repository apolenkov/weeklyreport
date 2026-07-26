// `analytics.trafficLightHistory` returns periods ascending by periodEnd
// (repository `orderBy: { periodEnd: "asc" }`), so the last two are the latest
// pair: periodA older, periodB newest. Null below two — nothing to compare.
export function latestPeriodPair(
  periods: readonly string[],
): { periodA: string; periodB: string } | null {
  const SECOND_LATEST = -2;
  const periodA = periods.at(SECOND_LATEST);
  const periodB = periods.at(-1);
  if (periodA === undefined || periodB === undefined) return null;
  return { periodA, periodB };
}
