// Deadline comes only from weeklyReport.deadline — never infer from
// periodEnd (period can stay open after the reporting deadline).

import type {
  ActivityLiveResponse,
  DbRole,
  SectionReviewView,
  SubmissionDashboardRow,
  WeeklyReportReadModel,
} from "@customreport/shared";

import type { LeadStatus } from "../../report-sections";
import { escalationToBlockedItem } from "./dashboard-escalations";
import { buildKpiData } from "./dashboard-kpi";
import { buildLeadInfos } from "./dashboard-leads";

export { formatRelativeDeadline } from "./dashboard-kpi";

// ---- Self-contained re-declarations of presentation types ----

export type ProductStatus = "on-track" | "at-risk" | "blocked";

export interface TrafficLight {
  status: ProductStatus;
  icon: string;
}

export interface LeadInfo {
  id: string;
  initials: string;
  name: string;
  role: DbRole;
  status: LeadStatus;
  trafficLights: TrafficLight[];
  lastEditAt: Date | null;
  submittedAt: Date | null;
  isStale: boolean;
  isCurrentUser: boolean;
  productCount?: number;
  reportContentCount?: number;
  currentItemCount?: number;
  nextItemCount?: number;
  riskCount?: number;
  decisionCount?: number;
  priorityCount?: number;
  /** count of activity-parented records (work units). */
  activityCount?: number;
  submittedAtLabel?: string | null;
  /** The section UUID needed for the per-lead Revoke button. */
  reportSectionId?: string;
  version?: number;
  reviews: readonly SectionReviewView[];
  reviewState: "changes-requested" | "approved" | "awaiting" | "none";
  reviewLabel: string;
  attentionLabel: "Blocked" | "At risk" | "On track" | "No signal";
  actions: {
    readonly canOpen: boolean;
    readonly canRemind: boolean;
    readonly canReview: boolean;
    readonly canRequestChanges: boolean;
    readonly canRevoke: boolean;
  };
  priority: "action-needed" | "stale" | "active" | "complete";
}

export interface KpiData {
  submitted: number;
  total: number;
  pendingCount: number;
  deadlineLabel: string;
  deadlineTime: string;
  blockedCount: number;
  atRiskCount: number;
  decisionCount: number;
}

export interface BlockedAtRiskItem {
  id: string;
  severity: "blocked" | "at-risk";
  product: string;
  stage: string;
  assignee: string;
  description: string;
}

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
    .map((e, idx) => escalationToBlockedItem(e, idx))
    .filter((item): item is BlockedAtRiskItem => item !== null);
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
