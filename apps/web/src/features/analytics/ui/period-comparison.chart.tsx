"use client";

import type {
  PeriodComparisonInput,
  PeriodComparisonOutput,
} from "@customreport/shared";
import { trafficLightToCanonical } from "@customreport/shared";

import { SlideStatusBadge } from "../../../shared/ui/feedback/slide-status-badge";

function deltaClass(delta: number): string {
  if (delta > 0) return "text-[var(--color-destructive)]";
  if (delta < 0) return "text-[var(--color-starbucks-accent)]";
  return "text-muted-foreground";
}

export function PeriodComparisonChart({
  rows,
  periodA,
  periodB,
}: PeriodComparisonOutput & PeriodComparisonInput) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No comparison data.</p>;
  }

  return (
    <div className="max-w-full overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <caption className="pb-3 text-left text-muted-foreground">
          Periods ending {periodA} (previous) and {periodB} (latest). Risk
          change is latest minus previous.
        </caption>
        <thead>
          <tr className="border-b text-left">
            <th scope="col" className="px-3 py-2">
              Project
            </th>
            <th scope="col" className="px-3 py-2">
              Previous status
            </th>
            <th scope="col" className="px-3 py-2">
              Latest status
            </th>
            <th scope="col" className="px-3 py-2">
              Previous risks
            </th>
            <th scope="col" className="px-3 py-2">
              Latest risks
            </th>
            <th scope="col" className="px-3 py-2">
              Risk change
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.projectId} className="border-b last:border-0">
              <th scope="row" className="px-3 py-2 text-left font-medium">
                {r.projectName}
              </th>
              <td className="px-3 py-2">
                <SlideStatusBadge
                  status={trafficLightToCanonical(r.statusA)}
                  labelVariant="screen"
                />
              </td>
              <td className="px-3 py-2">
                <SlideStatusBadge
                  status={trafficLightToCanonical(r.statusB)}
                  labelVariant="screen"
                />
              </td>
              <td className="px-3 py-2">{r.riskCountA}</td>
              <td className="px-3 py-2">{r.riskCountB}</td>
              <td className={`px-3 py-2 ${deltaClass(r.riskDelta)}`}>
                {r.riskDelta > 0 ? `+${r.riskDelta}` : r.riskDelta}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
