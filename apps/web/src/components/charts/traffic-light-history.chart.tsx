"use client";

import type {
  TrafficLightCell,
  TrafficLightHistoryOutput,
} from "@customreport/shared";
import {
  ChartContainer,
  ChartTooltip,
} from "@customreport/ui/components/ui/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

/**
 * Traffic-light history sparkline.
 *
 * `connectNulls={false}` so periods where a project did NOT report render
 * as visible gaps, distinct from a reported zero. status mapping: green=3,
 * yellow=2, red=1, null=null.
 */

const STATUS_TO_VALUE: Record<Exclude<TrafficLightCell, null>, number> = {
  green: 3,
  yellow: 2,
  red: 1,
};

const COLORS = [
  "#15803d",
  "#2563eb",
  "#9333ea",
  "#0891b2",
  "#c2410c",
  "#a21caf",
];

interface ChartSeries {
  readonly dataKey: string;
  readonly name: string;
}
type ChartData = Record<string, number | string | null>;

/**
 * Pivot history rows into recharts data points keyed by the stable `projectId`
 * (a UUID) rather than the project name, so two projects that share a name keep
 * separate lines instead of silently overwriting each other. The series
 * descriptor carries the human-readable name for recharts' tooltip.
 */
export function buildTrafficLightHistoryChartData(
  periods: TrafficLightHistoryOutput["periods"],
  rows: TrafficLightHistoryOutput["rows"],
): {
  readonly data: readonly ChartData[];
  readonly series: readonly ChartSeries[];
} {
  const series = rows.map((row) => ({
    dataKey: row.projectId,
    name: row.projectName,
  }));

  const data = periods.map(
    (label, idx): ChartData =>
      rows.reduce<ChartData>(
        (point, row) => {
          const cell = row.statuses[idx] ?? null;
          return {
            ...point,
            [row.projectId]: cell === null ? null : STATUS_TO_VALUE[cell],
          };
        },
        { period: label },
      ),
  );

  return { data, series };
}

export function TrafficLightHistoryChart({
  periods,
  rows,
}: TrafficLightHistoryOutput) {
  if (periods.length === 0 || rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No published periods in range.
      </p>
    );
  }

  const { data, series } = buildTrafficLightHistoryChartData(periods, rows);

  return (
    <ChartContainer>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" />
        <YAxis ticks={[1, 2, 3]} domain={[0, 4]} />
        <ChartTooltip />
        {series.map((s, idx) => (
          <Line
            key={s.dataKey}
            dataKey={s.dataKey}
            name={s.name}
            stroke={COLORS[idx % COLORS.length]}
            strokeWidth={2}
            connectNulls={false}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
