// Deadline comes only from weeklyReport.deadline — never infer from
// periodEnd (period can stay open after the reporting deadline).

import type {
  ActivityLiveResponse,
  SubmissionDashboardRow,
  WeeklyReportReadModel,
} from "@customreport/shared";

import {
  type BlockedAtRiskItem,
  escalationToBlockedItem,
} from "./dashboard-escalations";
import { buildKpiData, type KpiData } from "./dashboard-kpi";
import type { LeadInfo } from "./dashboard-lead-presentation";
import { buildLeadInfos } from "./dashboard-leads";

export type { BlockedAtRiskItem } from "./dashboard-escalations";
export type { KpiData } from "./dashboard-kpi";
export { formatRelativeDeadline } from "./dashboard-kpi";
export type { LeadInfo } from "./dashboard-lead-presentation";

// ---- Composer ----

export interface MapDashboardArgs {
  readonly review: readonly SubmissionDashboardRow[];
  readonly weeklyReport: WeeklyReportReadModel;
  readonly activity?: ActivityLiveResponse;
  // Override `now` for deterministic deadline tests.
  readonly now?: Date;
  // Optional authenticated lead id used to flag isCurrentUser.
  readonly currentUserId?: string;
}

export interface MapWeeklyDashboardArgs {
  readonly weeklyReport: WeeklyReportReadModel;
  // Override `now` for deterministic deadline tests.
  readonly now?: Date;
  // Review-backed count fills the weekly view when available.
  readonly pendingCount?: number;
}

export interface MapReviewDashboardArgs {
  readonly review?: readonly SubmissionDashboardRow[];
  readonly weeklyReport: WeeklyReportReadModel;
  readonly activity?: ActivityLiveResponse;
  // Override `now` for deterministic queue freshness and ordering tests.
  readonly now?: Date;
  readonly currentUserId?: string;
}

export interface MappedDashboard {
  readonly kpi: KpiData;
  readonly leads: readonly LeadInfo[];
  readonly blockedAtRisk: readonly BlockedAtRiskItem[];
  readonly pendingLeads: readonly string[];
}

export type MappedWeeklyDashboard = Pick<
  MappedDashboard,
  "kpi" | "blockedAtRisk"
>;

export type MappedReviewDashboard = Pick<
  MappedDashboard,
  "leads" | "pendingLeads"
>;

function mapBlockedAtRisk(
  weeklyReport: WeeklyReportReadModel,
): readonly BlockedAtRiskItem[] {
  const stageKeyedProducts = new Set(
    weeklyReport.escalations
      .filter((e) => e.type === "blocked" || e.type === "unresolved_risk")
      .map((e) => e.productName),
  );
  return weeklyReport.escalations
    .filter(
      (e) => e.type !== "at_risk" || !stageKeyedProducts.has(e.productName),
    )
    .map((e) => escalationToBlockedItem(e));
}

export function mapWeeklyDashboardData({
  weeklyReport,
  now = new Date(),
  pendingCount: reviewPendingCount,
}: MapWeeklyDashboardArgs): MappedWeeklyDashboard {
  const pendingCount =
    reviewPendingCount ??
    Math.max(0, weeklyReport.totalLeads - weeklyReport.leadSections.length);
  return {
    kpi: buildKpiData(weeklyReport, pendingCount, now),
    blockedAtRisk: mapBlockedAtRisk(weeklyReport),
  };
}

export function mapReviewDashboardData({
  review,
  weeklyReport,
  activity,
  now = new Date(),
  currentUserId,
}: MapReviewDashboardArgs): MappedReviewDashboard {
  const leads = buildLeadInfos({
    review,
    weeklyReport,
    now,
    ...(activity ? { activity } : {}),
    ...(currentUserId ? { currentUserId } : {}),
  });
  return {
    leads,
    pendingLeads: leads
      .filter((lead) => lead.status === "pending")
      .map((lead) => lead.name),
  };
}

export function mapDashboardData(args: MapDashboardArgs): MappedDashboard {
  const review = mapReviewDashboardData(args);
  const weekly = mapWeeklyDashboardData({
    weeklyReport: args.weeklyReport,
    pendingCount: review.pendingLeads.length,
    ...(args.now ? { now: args.now } : {}),
  });

  return {
    ...weekly,
    ...review,
  };
}
