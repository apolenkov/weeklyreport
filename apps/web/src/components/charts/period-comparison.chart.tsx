'use client';

import type { PeriodComparisonOutput, TrafficLightCell } from '@customreport/shared';

/**
 * ANAL-04 (Phase 30-03): period-vs-period delta table.
 *
 * Null cells render as '–' (em-dash); zero risk-counts render as '0'. The
 * visual distinction is part of the ANAL-04 contract per CONTEXT D-3.
 */

function statusLabel(cell: TrafficLightCell): string {
  if (cell === null) return '–';
  return cell;
}

function statusColor(cell: TrafficLightCell): string {
  if (cell === 'green') return 'text-green-600';
  if (cell === 'yellow') return 'text-amber-500';
  if (cell === 'red') return 'text-red-600';
  return 'text-muted-foreground';
}

function deltaClass(delta: number): string {
  if (delta > 0) return 'text-red-600';
  if (delta < 0) return 'text-green-600';
  return 'text-muted-foreground';
}

export function PeriodComparisonChart({ rows }: PeriodComparisonOutput) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No comparison data.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="px-3 py-2">Project</th>
            <th className="px-3 py-2">Status A</th>
            <th className="px-3 py-2">Status B</th>
            <th className="px-3 py-2">Risks A</th>
            <th className="px-3 py-2">Risks B</th>
            <th className="px-3 py-2">Δ Risks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.projectId} className="border-b last:border-0">
              <td className="px-3 py-2 font-medium">{r.projectName}</td>
              <td className={`px-3 py-2 font-mono ${statusColor(r.statusA)}`}>{statusLabel(r.statusA)}</td>
              <td className={`px-3 py-2 font-mono ${statusColor(r.statusB)}`}>{statusLabel(r.statusB)}</td>
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
