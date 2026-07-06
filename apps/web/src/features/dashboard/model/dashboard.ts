/**
 * Composes `review.dashboard` + `archive.list` + `weeklyReport.get` into the
 * KPI / leads / blocked-at-risk / archive / pending-leads shape that
 * `DashboardPage` expects.
 *
 * - `review.dashboard` returns `SubmissionDashboardRow[]` only — it does NOT
 *   carry submission counts, deadlines, escalations, or completion percentages.
 *   We source those from `weeklyReport.get` (`WeeklyReportReadModel`) instead.
 * - `weeklyReport.deadline` is the only source for the dashboard deadline.
 *   Never infer it from `periodEnd`: a period can stay open/reopened while the
 *   reporting deadline has already passed.
 * - `lastWeekSubmitted` / `lastWeekTotal` have no equivalent in any v5.0 read
 *   model, so they default to 0/0 (the KPI card just renders "0/0").
 * - `archive.list` returns `ArchiveReportSummary[]` (via `PaginatedResult`).
 *   The summary is leaner than the mock `ArchiveReport`: no week label,
 *   submission count, product count, risk count, or decision count. Synthesize
 *   weekLabel / dateRange from `periodStart`/`periodEnd`; default the rest to
 *   0/empty.
 * - The `PendingLead` type in mock-data is just `string[]` (lead names) — we
 *   produce that directly.
 */

import type {
  ArchiveReportSummary,
  PaginatedResult,
  SubmissionDashboardRow,
  WeeklyReportReadModel,
} from "@customreport/shared";

import {
  formatPeriodRangeWithYear,
  formatWeekLabel,
} from "../../../lib/format-date";
import type { LeadStatus } from "../../report-sections/model/lead-status";
import { escalationToBlockedItem } from "./dashboard-escalations";
import { buildKpiData, formatRelativeDeadline } from "./dashboard-kpi";
import { buildLeadInfos, initialsFromName } from "./dashboard-leads";

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
  role: string;
  status: LeadStatus;
  trafficLights: TrafficLight[];
  lastActivity: string;
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
}

export interface KpiData {
  submitted: number;
  total: number;
  lastWeekSubmitted: number;
  lastWeekTotal: number;
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

export interface ArchiveReport {
  id: string;
  weekLabel: string;
  dateRange: string;
  status: "active" | "published" | "draft";
  submissionLabel: string;
  productCount: number;
  riskCount: number;
  decisionCount: number;
}

/**
 * Map a single ArchiveReportSummary to the presentation-layer ArchiveReport
 * shape. Exported so the cursor-paginated archive list can map page items
 * incrementally without re-running the full dashboard composer.
 */
export function mapArchiveSummary(
  summary: ArchiveReportSummary,
): ArchiveReport {
  return {
    id: summary.reportId,
    weekLabel: formatWeekLabel(summary.periodStart),
    dateRange: formatPeriodRangeWithYear(
      summary.periodStart,
      summary.periodEnd,
    ),
    status: "published",
    // Submission counts aren't on ArchiveReportSummary at v5.0.
    submissionLabel: "",
    productCount: 0,
    riskCount: 0,
    decisionCount: 0,
  };
}

// ---- Composer ----

export interface MapDashboardArgs {
  review: SubmissionDashboardRow[];
  archive: PaginatedResult<ArchiveReportSummary>;
  weeklyReport: WeeklyReportReadModel;
  /** Override `now` for deterministic deadline tests. */
  now?: Date;
  /** Optional: identifier of the currently authenticated lead, used to flag isCurrentUser. */
  currentUserId?: string;
}

export interface MappedDashboard {
  kpi: KpiData;
  leads: LeadInfo[];
  blockedAtRisk: BlockedAtRiskItem[];
  archive: ArchiveReport[];
  pendingLeads: string[];
}

export function mapDashboardData(args: MapDashboardArgs): MappedDashboard {
  const now = args.now ?? new Date();
  const { review, archive, weeklyReport, currentUserId } = args;

  // -------- Leads --------
  const leads = buildLeadInfos(review, weeklyReport, currentUserId);

  // -------- Pending leads (alert bar) --------
  const pendingLeads = leads
    .filter((l) => l.status === "pending")
    .map((l) => l.name);

  // -------- KPI --------
  const kpi = buildKpiData(weeklyReport, pendingLeads.length, now);

  // -------- Blocked & At-Risk --------
  // Concrete blockers/risks are keyed by stage+product (`blocked` /
  // `unresolved_risk` carry a stageName). The product-level "flagged red"
  // escalation (the only `at_risk` source) is a stage-less roll-up the
  // ProductCard header already shows, so drop it when the product has a concrete
  // row; keep it only as the sole signal for a red product with nothing
  // concrete to point at.
  const stageKeyedProducts = new Set(
    weeklyReport.escalations
      .filter((e) => e.type === "blocked" || e.type === "unresolved_risk")
      .map((e) => e.productName),
  );
  const blockedAtRisk: BlockedAtRiskItem[] = weeklyReport.escalations
    .filter(
      (e) => e.type !== "at_risk" || !stageKeyedProducts.has(e.productName),
    )
    .map((e, idx) => escalationToBlockedItem(e, idx))
    .filter((item): item is BlockedAtRiskItem => item !== null);

  // -------- Archive --------
  const archiveItems = archive.items.map<ArchiveReport>(mapArchiveSummary);

  return {
    kpi,
    leads,
    blockedAtRisk,
    archive: archiveItems,
    pendingLeads,
  };
}

// Internal exports for tests.
export const __testing = {
  initialsFromName,
  formatRelativeDeadline,
};
