// Deadline comes only from weeklyReport.deadline — never infer from
// periodEnd (period can stay open after the reporting deadline).

import type {
  ActivityLiveResponse,
  SubmissionDashboardRow,
  WeeklyReportReadModel,
} from "@weeklyreport/shared";

import {
  type BlockedAtRiskItem,
  escalationToBlockedItem,
} from "./dashboard-escalations";
import { buildKpiData, type KpiData } from "./dashboard-kpi";
import type { LeadInfo } from "./dashboard-lead-presentation";
import { buildLeadInfos } from "./dashboard-leads";

export type { BlockedAtRiskItem } from "./dashboard-escalations";
export type { KpiData } from "./dashboard-kpi";
export type { LeadInfo } from "./dashboard-lead-presentation";

// ---- Composer ----

export interface MapWeeklyDashboardArgs {
  readonly weeklyReport: WeeklyReportReadModel;
  // Override `now` for deterministic deadline tests.
  readonly now?: Date;
}

export interface MapReviewDashboardArgs {
  readonly review?: readonly SubmissionDashboardRow[];
  readonly weeklyReport: WeeklyReportReadModel;
  readonly activity?: ActivityLiveResponse;
  // Override `now` for deterministic queue freshness and ordering tests.
  readonly now?: Date;
  readonly currentUserId?: string;
}

interface MappedDashboard {
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
  const flaggedRedProducts = new Set(
    weeklyReport.escalations
      .filter((e) => e.type === "at_risk")
      .map((e) => e.productId),
  );
  const stageKeyedProducts = new Set(
    weeklyReport.escalations
      .filter((e) => e.type === "blocked" || e.type === "unresolved_risk")
      .map((e) => e.productId),
  );
  return weeklyReport.escalations
    .filter((e) => e.type !== "at_risk" || !stageKeyedProducts.has(e.productId))
    .map((e) => ({
      ...escalationToBlockedItem(e),
      ...(flaggedRedProducts.has(e.productId)
        ? { productFlaggedRed: true }
        : {}),
    }));
}

export function mapWeeklyDashboardData({
  weeklyReport,
  now = new Date(),
}: MapWeeklyDashboardArgs): MappedWeeklyDashboard {
  const blockedAtRisk = mapBlockedAtRisk(weeklyReport);
  return {
    kpi: buildKpiData(weeklyReport, now, blockedAtRisk),
    blockedAtRisk,
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
