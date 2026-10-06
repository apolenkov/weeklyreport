"use client";

import type { PeriodComparisonOutput } from "@customreport/shared";
import { trafficLightToCanonical } from "@customreport/shared";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { formatPeriodRangeWithYear } from "../../../shared/lib/format/format-date";
import { compareBySeverityThenName } from "../../../shared/lib/status/status-order";
import { SlideStatusBadge } from "../../../shared/ui/feedback/slide-status-badge";
import {
  AnalyticsTable,
  ColumnHeader,
  DataCell,
  StickyColumnHeader,
  StickyRowHeader,
} from "./analytics-table";

function deltaClass(delta: number): string {
  if (delta > 0) return "text-[var(--color-destructive)]";
  if (delta < 0) return "text-[var(--color-starbucks-accent)]";
  return "";
}

function riskDeltaText(delta: number): string {
  return delta > 0 ? `+${String(delta)}` : String(delta);
}

type ComparisonRow = PeriodComparisonOutput["rows"][number];

function ComparisonRows({ rows }: { readonly rows: readonly ComparisonRow[] }) {
  return rows.map((r) => (
    <tr key={r.projectId}>
      <StickyRowHeader>{r.projectName}</StickyRowHeader>
      <DataCell className="whitespace-nowrap">
        <SlideStatusBadge
          status={trafficLightToCanonical(r.statusB)}
          labelVariant="screen"
        />
      </DataCell>
      <DataCell className="whitespace-nowrap">
        <SlideStatusBadge
          status={trafficLightToCanonical(r.statusA)}
          labelVariant="screen"
        />
      </DataCell>
      <DataCell numeric>{r.riskCountB}</DataCell>
      <DataCell numeric>{r.riskCountA}</DataCell>
      <DataCell numeric className={deltaClass(r.riskDelta)}>
        {riskDeltaText(r.riskDelta)}
      </DataCell>
    </tr>
  ));
}

// Identical periods repeat the traffic-light history above, so the table stays
// folded until someone asks for it.
function UnchangedFold({ children }: { readonly children: ReactNode }) {
  return (
    <details className="group">
      <summary className="flex min-h-[var(--touch-target-min)] cursor-pointer items-center gap-1 text-sm font-medium text-[var(--color-primary)]">
        <ChevronRight
          aria-hidden="true"
          className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
        />
        No status or risk changes between these periods. Show the table
      </summary>
      {children}
    </details>
  );
}

export function PeriodComparisonTable({
  rows,
  periodA,
  periodB,
  headingId,
}: PeriodComparisonOutput & {
  readonly headingId: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No comparison data.</p>;
  }

  const sortedRows = rows
    .map((row) => ({
      row,
      status: trafficLightToCanonical(row.statusB),
      name: row.projectName,
    }))
    .toSorted(compareBySeverityThenName)
    .map(({ row }) => row);
  const unchanged = rows.every(
    (row) => row.statusA === row.statusB && row.riskDelta === 0,
  );

  const table = (
    <AnalyticsTable
      headingId={headingId}
      caption="Period comparison data"
      dataColumns={5}
      showScrollHint
    >
      <thead>
        <tr>
          <StickyColumnHeader>Project</StickyColumnHeader>
          <ColumnHeader>Latest status</ColumnHeader>
          <ColumnHeader>Previous status</ColumnHeader>
          <ColumnHeader numeric>Latest risks</ColumnHeader>
          <ColumnHeader numeric>Previous risks</ColumnHeader>
          <ColumnHeader numeric>Risk change</ColumnHeader>
        </tr>
      </thead>
      <tbody>
        <ComparisonRows rows={sortedRows} />
      </tbody>
    </AnalyticsTable>
  );

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        Latest period{" "}
        {formatPeriodRangeWithYear(periodB?.periodStart, periodB?.periodEnd)}{" "}
        compared with previous period{" "}
        {formatPeriodRangeWithYear(periodA?.periodStart, periodA?.periodEnd)}.
        Risk change is latest minus previous.
      </p>
      {unchanged ? <UnchangedFold>{table}</UnchangedFold> : table}
    </>
  );
}
