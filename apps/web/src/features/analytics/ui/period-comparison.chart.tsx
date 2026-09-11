"use client";

import type {
  PeriodComparisonInput,
  PeriodComparisonOutput,
  TrafficLightCell,
} from "@customreport/shared";

// A null cell renders as an en-dash, never '0': "no data" and "zero risks" are
// deliberately distinguishable at a glance.
function statusLabel(cell: TrafficLightCell): string {
  if (cell === null) return "–";
  return cell;
}

function statusColor(cell: TrafficLightCell): string {
  if (cell === "green") return "text-[var(--color-starbucks-accent)]";
  if (cell === "yellow") return "text-[var(--color-status-dot-at-risk)]";
  if (cell === "red") return "text-[var(--color-destructive)]";
  return "text-muted-foreground";
}

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
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <caption className="pb-3 text-left text-muted-foreground">
          Periods ending {periodA} (previous) and {periodB} (latest). Risk
          change is latest minus previous.
        </caption>
        <thead>
          <tr className="border-b text-left">
            <th className="px-3 py-2">Project</th>
            <th className="px-3 py-2">Previous status</th>
            <th className="px-3 py-2">Latest status</th>
            <th className="px-3 py-2">Previous risks</th>
            <th className="px-3 py-2">Latest risks</th>
            <th className="px-3 py-2">Risk change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.projectId} className="border-b last:border-0">
              <td className="px-3 py-2 font-medium">{r.projectName}</td>
              <td className={`px-3 py-2 font-mono ${statusColor(r.statusA)}`}>
                {statusLabel(r.statusA)}
              </td>
              <td className={`px-3 py-2 font-mono ${statusColor(r.statusB)}`}>
                {statusLabel(r.statusB)}
              </td>
              <td className="px-3 py-2 font-mono">{r.riskCountA}</td>
              <td className="px-3 py-2 font-mono">{r.riskCountB}</td>
              <td className={`px-3 py-2 font-mono ${deltaClass(r.riskDelta)}`}>
                {r.riskDelta > 0 ? `+${r.riskDelta}` : r.riskDelta}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
