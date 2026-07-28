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
  review: readonly SubmissionDashboardRow[];
  weeklyReport: WeeklyReportReadModel;
  activity?: ActivityLiveResponse;
  /** Override `now` for deterministic deadline tests. */
  now?: Date;
  /** Optional: identifier of the currently authenticated lead, used to flag isCurrentUser. */
  currentUserId?: string;
}

export interface MapWeeklyDashboardArgs {
  weeklyReport: WeeklyReportReadModel;
  /** Override `now` for deterministic deadline tests. */
  now?: Date;
  /** Review-backed pending count when available; weekly totals seed partial UI. */
  pendingCount?: number;
}

export interface MapReviewDashboardArgs {
  review?: readonly SubmissionDashboardRow[];
  weeklyReport: WeeklyReportReadModel;
  activity?: ActivityLiveResponse;
  /** Override `now` for deterministic queue freshness and ordering tests. */
  now?: Date;
  currentUserId?: string;
}

export interface MappedDashboard {
  kpi: KpiData;
  leads: LeadInfo[];
  blockedAtRisk: BlockedAtRiskItem[];
  pendingLeads: string[];
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
): BlockedAtRiskItem[] {
  const stageKeyedProducts = new Set(
    weeklyReport.escalations
      .filter((e) => e.type === "blocked" || e.type === "unresolved_risk")
      .map((e) => e.productName),
  );
  return weeklyReport.escalations
    .filter(
      (e) => e.type !== "at_risk" || !stageKeyedProducts.has(e.productName),
    )
    .map((e, idx) => escalationToBlockedItem(e, idx));
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
