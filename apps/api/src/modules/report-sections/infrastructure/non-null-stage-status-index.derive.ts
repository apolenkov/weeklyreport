import type { TrafficLightStatus } from "@customreport/shared";

interface NullableStageStatus {
  status: TrafficLightStatus | null;
}

export function indexNonNullStageStatuses<Row extends NullableStageStatus>(
  rows: readonly Row[],
  buildKey: (row: Row) => string,
): Map<string, TrafficLightStatus> {
  return new Map(
    rows.flatMap((row) =>
      row.status === null ? [] : [[buildKey(row), row.status] as const],
    ),
  );
}
