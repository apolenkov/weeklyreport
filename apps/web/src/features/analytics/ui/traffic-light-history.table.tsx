"use client";

import {
  type AnalyticsPeriod,
  CANONICAL_STATUS_PRECEDENCE,
  type CanonicalStatus,
  canonicalStatusSchema,
  type TrafficLightHistoryOutput,
  trafficLightToCanonical,
} from "@customreport/shared";

import { formatPeriodRangeWithYear } from "../../../shared/lib/format/format-date";
import { compareBySeverityThenName } from "../../../shared/lib/status/status-order";
import { statusLabel } from "../../../shared/lib/status/status-presentation";
import { SlideStatusBadge } from "../../../shared/ui/feedback/slide-status-badge";
import {
  AnalyticsTable,
  ColumnHeader,
  DataCell,
  StickyColumnHeader,
  StickyRowHeader,
} from "./analytics-table";

function StatusChange({
  previous,
  current,
}: {
  readonly previous: CanonicalStatus;
  readonly current: CanonicalStatus;
}) {
  if (previous === "empty" || current === "empty" || previous === current)
    return null;
  const recovered =
    CANONICAL_STATUS_PRECEDENCE[current] <
    CANONICAL_STATUS_PRECEDENCE[previous];
  return (
    <span className="ml-2 text-xs text-muted-foreground">
      <span aria-hidden="true">{recovered ? "↑" : "↓"}</span>{" "}
      {recovered ? "Recovered" : "Slipped"}
    </span>
  );
}

function LatestPeriodSummary({
  period,
  rows,
  index,
}: {
  readonly period: AnalyticsPeriod;
  readonly rows: TrafficLightHistoryOutput["rows"];
  readonly index: number;
}) {
  const counts = canonicalStatusSchema.options
    .map((status) => ({
      status,
      count: rows.filter(
        (row) => trafficLightToCanonical(row.statuses[index]) === status,
      ).length,
    }))
    .filter(({ count }) => count > 0);
  return (
    <p className="mb-3 text-sm text-muted-foreground">
      Period {formatPeriodRangeWithYear(period.periodStart, period.periodEnd)}:{" "}
      {counts
        .map(
          ({ status, count }, i) =>
            `${String(count)} ${i === 0 ? (count === 1 ? "project " : "projects ") : ""}${statusLabel(status, "screen").toLowerCase()}`,
        )
        .join(", ")}
    </p>
  );
}

function HistoryCell({
  statuses,
  index,
  latest,
}: {
  readonly statuses: TrafficLightHistoryOutput["rows"][number]["statuses"];
  readonly index: number;
  readonly latest: boolean;
}) {
  return (
    <DataCell
      className={`whitespace-nowrap ${latest ? "bg-[var(--color-surface-muted)]" : ""}`}
    >
      <SlideStatusBadge
        status={trafficLightToCanonical(statuses[index] ?? null)}
        labelVariant="screen"
      />{" "}
      {latest && index > 0 ? (
        <StatusChange
          previous={trafficLightToCanonical(statuses[index - 1])}
          current={trafficLightToCanonical(statuses[index])}
        />
      ) : null}
    </DataCell>
  );
}

export function TrafficLightHistoryTable({
  periods,
  rows,
  headingId,
}: TrafficLightHistoryOutput & { readonly headingId: string }) {
  const latestPeriod = periods.at(-1);
  if (latestPeriod === undefined || rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No published periods in range.
      </p>
    );
  }

  const latestIndex = periods.length - 1;
  // Same order as the report overview: latest status by severity, then name.
  const rankedRows = rows
    .map((row) => ({
      row,
      status: trafficLightToCanonical(row.statuses[latestIndex]),
      name: row.projectName,
    }))
    .toSorted(compareBySeverityThenName);
  const displayPeriods = periods
    .map((period, index) => ({ period, index }))
    .toReversed();

  return (
    <>
      <LatestPeriodSummary
        period={latestPeriod}
        rows={rows}
        index={latestIndex}
      />
      <AnalyticsTable
        headingId={headingId}
        caption="Traffic-light history data"
        dataColumns={periods.length}
        showScrollHint={periods.length > 1}
      >
        <thead>
          <tr>
            <StickyColumnHeader>Project</StickyColumnHeader>
            {displayPeriods.map(({ period, index }) => (
              <ColumnHeader
                key={period.periodEnd}
                className={
                  index === latestIndex ? "bg-[var(--color-surface-muted)]" : ""
                }
              >
                {formatPeriodRangeWithYear(
                  period.periodStart,
                  period.periodEnd,
                )}
              </ColumnHeader>
            ))}
          </tr>
        </thead>
        <tbody>
          {rankedRows.map(({ row }) => (
            <tr key={row.projectId}>
              <StickyRowHeader>{row.projectName}</StickyRowHeader>
              {displayPeriods.map(({ period, index }) => (
                <HistoryCell
                  key={period.periodEnd}
                  statuses={row.statuses}
                  index={index}
                  latest={index === latestIndex}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </AnalyticsTable>
    </>
  );
}
