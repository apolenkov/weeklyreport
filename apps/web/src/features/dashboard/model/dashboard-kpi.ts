import type { WeeklyReportReadModel } from "@customreport/shared";
import { HOURS_PER_DAY, MS_PER_HOUR } from "@customreport/shared";

import { toIsoDateString } from "../../../shared/lib/format/format-date";

export interface KpiData {
  readonly submitted: number;
  readonly total: number;
  readonly pendingCount: number;
  readonly deadlineLabel: string;
  readonly deadlineTime: string;
  readonly blockedCount: number;
  readonly atRiskCount: number;
  readonly decisionCount: number;
}

function formatRelativeDeadline(deadline: Date, now: Date): string {
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) return "Past";
  const totalHours = Math.floor(diffMs / MS_PER_HOUR);
  const days = Math.floor(totalHours / HOURS_PER_DAY);
  const hours = totalHours - days * HOURS_PER_DAY;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

export function buildKpiData(
  weeklyReport: WeeklyReportReadModel,
  pendingCount: number,
  now: Date,
): KpiData {
  const submitted = weeklyReport.submissionCount;
  const total = weeklyReport.totalLeads;

  const blockedCount = weeklyReport.escalations.filter(
    (e) => e.type === "blocked",
  ).length;
  const atRiskCount = weeklyReport.escalations.filter(
    (e) => e.type === "at_risk" || e.type === "unresolved_risk",
  ).length;
  // The portfolio KPI stays product-only — count
  // product-parented decisions so activity decisions never inflate the KPI.
  const decisionCount = weeklyReport.leadSections.reduce(
    (sum, section) =>
      sum + section.decisions.filter((d) => d.productId != null).length,
    0,
  );

  const isEditablePeriod =
    weeklyReport.periodStatus === "open" ||
    weeklyReport.periodStatus === "reopened";
  // A cleared deadline is an explicit state, not a countdown of zero.
  const deadlineLabel = !isEditablePeriod
    ? "Closed"
    : weeklyReport.deadline === null
      ? "No deadline"
      : formatRelativeDeadline(weeklyReport.deadline, now);
  const deadlineTime =
    weeklyReport.deadline === null
      ? "—"
      : toIsoDateString(weeklyReport.deadline);

  return {
    submitted,
    total,
    pendingCount,
    deadlineLabel,
    deadlineTime,
    blockedCount,
    atRiskCount,
    decisionCount,
  };
}
