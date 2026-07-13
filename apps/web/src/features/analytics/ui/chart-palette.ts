/**
 * Shared categorical palette and recharts row/series shapes for the analytics
 * charts. Both `lead-velocity.chart.tsx` and `traffic-light-history.chart.tsx`
 * pivot backend rows into recharts data points keyed by a stable UUID, so they
 * share one 6-color series palette and the same data/series descriptors.
 *
 * `ChartData` allows `null` so a series can carry a genuine gap (a period with
 * no published status) that recharts renders as a break in the line, rather
 * than collapsing it to zero.
 */
export const COLORS = [
  "#15803d",
  "#2563eb",
  "#9333ea",
  "#0891b2",
  "#c2410c",
  "#a21caf",
];

export interface ChartSeries {
  readonly dataKey: string;
  readonly name: string;
}

export type ChartData = Record<string, number | string | null>;
