import type { LeadVelocityOutput } from "@customreport/shared";
import { DAYS_PER_WEEK, MS_PER_DAY } from "@customreport/shared";

import { formatPeriodRange } from "../../../shared/lib/format/format-date";

/** Period ids are week-end dates; renders the Mon-Sun span, e.g. "Sep 21–27". */
export function weekEndingRange(end: string): string {
  const start = new Date(Date.parse(end) - (DAYS_PER_WEEK - 1) * MS_PER_DAY);
  return formatPeriodRange(start, end);
}

interface TableSeries {
  readonly dataKey: string;
  readonly name: string;
}

type TableData = Readonly<Record<string, number | string>>;

export function buildLeadSubmissionsTableData(rows: LeadVelocityOutput): {
  readonly data: readonly TableData[];
  readonly series: readonly TableSeries[];
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
  const data = rows.map((row): TableData => {
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
