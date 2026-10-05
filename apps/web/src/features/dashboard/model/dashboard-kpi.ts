import type { WeeklyReportReadModel } from "@customreport/shared";
import { HOURS_PER_DAY, MS_PER_HOUR } from "@customreport/shared";

import { formatTimestampShort } from "../../../shared/lib/format/format-date";
import type { BlockedAtRiskItem } from "./dashboard-escalations";

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
  now: Date,
  blockedAtRisk: readonly BlockedAtRiskItem[],
): KpiData {
  const submitted = weeklyReport.submissionCount;
  const total = weeklyReport.totalLeads;
  // Same scope as submitted/total, so the card always adds up.
  const pendingCount = Math.max(0, total - submitted);

  // Counted from the rows the Blocked & At Risk list renders, so the card and
  // the list never disagree (R77).
  const blockedCount = blockedAtRisk.filter(
    (item) => item.severity === "blocked",
  ).length;
  const atRiskCount = blockedAtRisk.length - blockedCount;
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
      : formatTimestampShort(weeklyReport.deadline);

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
