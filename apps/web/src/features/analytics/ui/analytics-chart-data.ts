import type {
  LeadVelocityOutput,
  TrafficLightCell,
  TrafficLightHistoryOutput,
} from "@customreport/shared";

import type { ChartData, ChartSeries } from "./chart-palette";

const STATUS_TO_VALUE: Record<Exclude<TrafficLightCell, null>, number> = {
  green: 3,
  yellow: 2,
  red: 1,
};

export function buildLeadVelocityChartData(rows: LeadVelocityOutput): {
  readonly data: readonly ChartData[];
  readonly series: readonly ChartSeries[];
} {
  const leadIds = Array.from(
    new Set(rows.flatMap((row) => row.leads.map((lead) => lead.leadId))),
  );
  const leadNameById = new Map(
    rows.flatMap((row) =>
      row.leads.map((lead) => [lead.leadId, lead.leadName] as const),
    ),
  );
  const series = leadIds.map((id) => ({
    dataKey: id,
    name: leadNameById.get(id) ?? id,
  }));
  const data = rows.map((row): ChartData => {
    const submissionsByLead = new Map(
      row.leads.map((lead) => [lead.leadId, lead.submittedSections] as const),
    );
    return {
      period: row.periodLabel,
      ...Object.fromEntries(
        leadIds.map((id) => [id, submissionsByLead.get(id) ?? 0]),
      ),
    };
  });

  return { data, series };
}

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
  const data = periods.map((period, index): ChartData => ({
    period,
    ...Object.fromEntries(
      rows.map((row) => {
        const status = row.statuses[index] ?? null;
        return [
          row.projectId,
          status === null ? null : STATUS_TO_VALUE[status],
        ];
      }),
    ),
  }));

  return { data, series };
}
