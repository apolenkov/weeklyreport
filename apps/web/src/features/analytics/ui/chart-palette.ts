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

// null = genuine gap (no published status); recharts breaks the line instead
// of collapsing to zero.
export type ChartData = Record<string, number | string | null>;
