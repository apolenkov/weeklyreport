import type { WeeklyReportReadModel } from "@customreport/shared";

import type { KpiData } from "./dashboard";

function isoDateLabel(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Format a deadline as a human-relative label like "2d 5h" or "5h" or "Past".
 * Mirrors the shape used in the mock dashboard.
 */
export function formatRelativeDeadline(deadline: Date, now: Date): string {
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) return "Past";
  const totalHours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours - days * 24;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

/**
 * Build the dashboard KPI tile data. Extracted from mapDashboardData's "KPI"
 * step: submission counts, escalation roll-ups, and the deadline label (only
 * shown while the period is editable).
 */
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
  // activity-first-class (Q1): the portfolio KPI stays product-only — count
  // product-parented decisions so activity decisions never inflate the KPI.
  const decisionCount = weeklyReport.leadSections.reduce(
    (sum, section) =>
      sum + section.decisions.filter((d) => d.productId != null).length,
    0,
  );

  const isEditablePeriod =
    weeklyReport.periodStatus === "open" ||
    weeklyReport.periodStatus === "reopened";
  const deadlineLabel = isEditablePeriod
    ? formatRelativeDeadline(weeklyReport.deadline, now)
    : "Closed";
  const deadlineTime = isoDateLabel(weeklyReport.deadline);

  return {
    submitted,
    total,
    // No "last week" comparison endpoint exists in v5.0 read models.
    lastWeekSubmitted: 0,
    lastWeekTotal: 0,
    pendingCount,
    deadlineLabel,
    deadlineTime,
    blockedCount,
    atRiskCount,
    decisionCount,
  };
}
