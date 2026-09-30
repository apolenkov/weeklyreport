"use client";

import {
  CANONICAL_STATUS_PRECEDENCE,
  type CanonicalStatus,
  canonicalStatusSchema,
  type TrafficLightHistoryOutput,
  trafficLightToCanonical,
} from "@customreport/shared";

import { worstTrafficStatus } from "../../../shared/lib/status/status-presentation";
import { SlideStatusBadge } from "../../../shared/ui/feedback/slide-status-badge";
import {
  AnalyticsTable,
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

function LatestWeekSummary({
  period,
  rows,
  index,
}: {
  readonly period: string | undefined;
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
    <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
      Week ending {period}:
      {counts.map(({ status, count }) => (
        <span
          key={status}
          className="inline-flex items-center gap-1 whitespace-nowrap"
        >
          {count} <SlideStatusBadge status={status} labelVariant="screen" />
        </span>
      ))}
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
    <td
      className={`whitespace-nowrap px-3 py-2 ${latest ? "bg-[var(--color-surface-muted)]" : ""}`}
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
    </td>
  );
}

export function TrafficLightHistoryTable({
  periods,
  rows,
  headingId,
}: TrafficLightHistoryOutput & { readonly headingId: string }) {
  if (periods.length === 0 || rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No published periods in range.
      </p>
    );
  }

  const rankedRows = rows
    .map((row) => {
      const worst = trafficLightToCanonical(worstTrafficStatus(row.statuses));
      return {
        row,
        rank: Math.max(
          CANONICAL_STATUS_PRECEDENCE["on-track"],
          CANONICAL_STATUS_PRECEDENCE[worst],
        ),
      };
    })
    .toSorted((a, b) => b.rank - a.rank);
  const latestIndex = periods.length - 1;

  return (
    <>
      <LatestWeekSummary
        period={periods[latestIndex]}
        rows={rows}
        index={latestIndex}
      />
      <AnalyticsTable
        headingId={headingId}
        caption="Traffic-light history data"
      >
        <thead>
          <tr className="border-b text-left">
            <StickyColumnHeader>Project</StickyColumnHeader>
            {periods.map((period, index) => (
              <th
                key={period}
                scope="col"
                className={`whitespace-nowrap px-3 py-2 ${index === latestIndex ? "bg-[var(--color-surface-muted)]" : ""}`}
              >
                {period}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rankedRows.map(({ row }) => (
            <tr key={row.projectId} className="border-b last:border-0">
              <StickyRowHeader>{row.projectName}</StickyRowHeader>
              {periods.map((period, index) => (
                <HistoryCell
                  key={period}
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
