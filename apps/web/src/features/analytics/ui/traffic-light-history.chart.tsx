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

import { type ChartData, type ChartSeries, COLORS } from "./chart-palette";

// Domain max leaves headroom above green so the top line isn't clipped.
const STATUS_LEVEL_GREEN = 3;
const STATUS_LEVEL_TICKS = [1, 2, STATUS_LEVEL_GREEN];
const Y_AXIS_DOMAIN_MAX = 4;

const STATUS_TO_VALUE: Record<Exclude<TrafficLightCell, null>, number> = {
  green: STATUS_LEVEL_GREEN,
  yellow: 2,
  red: 1,
};

// Data points are keyed by the stable `projectId`, not the project name, so two
// projects sharing a name keep separate lines instead of overwriting each other;
// the series descriptor carries the readable name for recharts' tooltip.
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

  const data = periods.map((label, idx): ChartData =>
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
        <YAxis ticks={STATUS_LEVEL_TICKS} domain={[0, Y_AXIS_DOMAIN_MAX]} />
        <ChartTooltip />
        {/* connectNulls={false}: periods a project did NOT report stay visible
            gaps instead of being bridged by a line through them. */}
        {series.map((s, idx) => (
          <Line
            key={s.dataKey}
            dataKey={s.dataKey}
            name={s.name}
            stroke={COLORS[idx % COLORS.length] ?? "currentColor"}
            strokeWidth={2}
            connectNulls={false}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
