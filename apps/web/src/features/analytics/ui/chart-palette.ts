// Categorical series colors only: status hues (red/amber) stay out of the
// palette so a neutral lead never reads as a Red/Yellow status. Seven entries
// cover the widest current series set without wrapping onto series 1.
export const SERIES_PALETTE = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
] as const;

export interface ChartSeries {
  readonly dataKey: string;
  readonly name: string;
}

// null = genuine gap (no published status); recharts breaks the line instead
// of collapsing to zero.
export type ChartData = Readonly<Record<string, number | string | null>>;
