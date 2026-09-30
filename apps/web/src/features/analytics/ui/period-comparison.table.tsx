"use client";

import type { PeriodComparisonOutput } from "@customreport/shared";
import { trafficLightToCanonical } from "@customreport/shared";

import { formatPeriodRangeWithYear } from "../../../shared/lib/format/format-date";
import { SlideStatusBadge } from "../../../shared/ui/feedback/slide-status-badge";
import {
  AnalyticsTable,
  StickyColumnHeader,
  StickyRowHeader,
} from "./analytics-table";

function deltaClass(delta: number): string {
  if (delta > 0) return "text-[var(--color-destructive)]";
  if (delta < 0) return "text-[var(--color-starbucks-accent)]";
  return "";
}

function riskDeltaText(delta: number): string {
  return delta === 0 ? "\u2014" : String(delta);
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

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        Periods{" "}
        {formatPeriodRangeWithYear(periodA?.periodStart, periodA?.periodEnd)}{" "}
        (previous) and{" "}
        {formatPeriodRangeWithYear(periodB?.periodStart, periodB?.periodEnd)}{" "}
        (latest). Risk change is latest minus previous.
      </p>
      <AnalyticsTable
        headingId={headingId}
        caption="Period comparison data"
        showScrollHint
      >
        <thead>
          <tr className="border-b text-left">
            <StickyColumnHeader>Project</StickyColumnHeader>
            <th scope="col" className="px-3 py-2">
              Latest status
            </th>
            <th scope="col" className="px-3 py-2">
              Previous status
            </th>
            <th scope="col" className="px-3 py-2">
              Latest risks
            </th>
            <th scope="col" className="px-3 py-2">
              Previous risks
            </th>
            <th scope="col" className="px-3 py-2">
              Risk change
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.projectId} className="border-b last:border-0">
              <StickyRowHeader>{r.projectName}</StickyRowHeader>
              <td className="whitespace-nowrap px-3 py-2">
                <SlideStatusBadge
                  status={trafficLightToCanonical(r.statusB)}
                  labelVariant="screen"
                />
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <SlideStatusBadge
                  status={trafficLightToCanonical(r.statusA)}
                  labelVariant="screen"
                />
              </td>
              <td className="px-3 py-2">{r.riskCountB}</td>
              <td className="px-3 py-2">{r.riskCountA}</td>
              <td className={`px-3 py-2 ${deltaClass(r.riskDelta)}`}>
                {r.riskDelta > 0
                  ? `+${String(r.riskDelta)}`
                  : riskDeltaText(r.riskDelta)}
              </td>
            </tr>
          ))}
        </tbody>
      </AnalyticsTable>
    </>
  );
}
