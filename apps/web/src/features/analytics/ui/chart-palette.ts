export const SERIES_PALETTE = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
] as const;

export interface ChartSeries {
  readonly dataKey: string;
  readonly name: string;
}

// null = genuine gap (no published status); recharts breaks the line instead
// of collapsing to zero.
export type ChartData = Readonly<Record<string, number | string | null>>;
