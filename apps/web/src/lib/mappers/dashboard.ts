/**
 * Composes `review.dashboard` + `archive.list` + `weeklyReport.get` into the
 * KPI / leads / blocked-at-risk / archive / pending-leads shape that
 * `DashboardPage` expects.
 *
 * Reuses Phase 20 `deriveLeadStatus` and `trafficToStageStatus`.
 *
 * Synthesis notes (Phase 21 / Plan 21-03):
 * - `review.dashboard` returns `SubmissionDashboardRow[]` only — it does NOT
 *   carry submission counts, deadlines, escalations, or completion percentages.
 *   We source those from `weeklyReport.get` (`WeeklyReportReadModel`) instead.
 * - Neither endpoint exposes a deadline field at the read model level, so the
 *   deadline label is computed relative to `weeklyReport.periodEnd` (best
 *   available proxy). The `deadlineTime` literal "Friday 18:00" is dropped —
 *   we render the localized date instead.
 * - `lastWeekSubmitted` / `lastWeekTotal` have no equivalent in any v5.0 read
 *   model, so they default to 0/0 (the KPI card just renders "0/0"). Phase 22
 *   may add a comparison endpoint.
 * - `archive.list` returns `ArchiveReportSummary[]` (via `PaginatedResult`).
 *   The summary is leaner than the mock `ArchiveReport`: no week label,
 *   submission count, product count, risk count, or decision count. Synthesize
 *   weekLabel / dateRange from `periodStart`/`periodEnd`; default the rest to
 *   0/empty.
 * - The `PendingLead` type in mock-data is just `string[]` (lead names) — we
 *   produce that directly.
 */

import type {
  SubmissionDashboardRow,
  WeeklyReportReadModel,
  ArchiveReportSummary,
  PaginatedResult,
  Escalation,
  ReportSectionReadModel,
  PortfolioProductOverview,
} from '@customreport/shared';

import { deriveLeadStatus, type LeadStatus } from './lead-status';
import { trafficToStageStatus } from './traffic-light';

// ---- Self-contained re-declarations of presentation types ----

export type ProductStatus = 'on-track' | 'at-risk' | 'blocked';

export type TrafficLight = {
  status: ProductStatus;
  icon: string;
};

export type LeadInfo = {
  id: string;
  initials: string;
  name: string;
  role: string;
  status: LeadStatus;
  trafficLights: TrafficLight[];
  lastActivity: string;
  isCurrentUser: boolean;
  productCount?: number;
};

export type KpiData = {
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
};

export type BlockedAtRiskItem = {
  id: string;
  severity: 'blocked' | 'at-risk';
  product: string;
  stage: string;
  assignee: string;
  description: string;
};

export type ArchiveReport = {
  id: string;
  weekLabel: string;
  dateRange: string;
  status: 'active' | 'published' | 'draft';
  submissionLabel: string;
  productCount: number;
  riskCount: number;
  decisionCount: number;
};

// ---- Helpers ----

const TRAFFIC_ICON: Record<ProductStatus, string> = {
  'on-track': '\u2713', // ✓
  blocked: '\u2715', // ✕
  'at-risk': '!',
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '??';
  if (parts.length === 1) {
    const first = parts[0]!;
    return first.slice(0, 2).toUpperCase();
  }
  const a = parts[0]!.charAt(0);
  const b = parts[parts.length - 1]!.charAt(0);
  return (a + b).toUpperCase();
}

function isoDateLabel(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shortDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isoWeekLabel(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `Week ${week}`;
}

/**
 * Format a deadline as a human-relative label like "2d 5h" or "5h" or "Past".
 * Mirrors the shape used in the mock dashboard.
 */
export function formatRelativeDeadline(deadline: Date, now: Date): string {
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs <= 0) return 'Past';
  const totalHours = Math.floor(diffMs / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours - days * 24;
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

function countItems(section: ReportSectionReadModel): number {
  return section.items.length;
}

function trafficLightsForLeadByName(
  leadName: string,
  portfolio: PortfolioProductOverview[],
): TrafficLight[] {
  return portfolio
    .filter((p) => p.leadNames.includes(leadName))
    .map((p) => p.worstStatus)
    .filter((status): status is NonNullable<typeof status> => status !== null)
    .map((status) => {
      const presentation = trafficToStageStatus(status);
      const productStatus: ProductStatus =
        presentation === 'on-track' || presentation === 'at-risk' || presentation === 'blocked'
          ? presentation
          : 'on-track';
      return { status: productStatus, icon: TRAFFIC_ICON[productStatus] };
    });
}

function escalationToBlockedItem(escalation: Escalation, index: number): BlockedAtRiskItem | null {
  if (escalation.type === 'blocked') {
    return {
      id: `esc-${index}`,
      severity: 'blocked',
      product: escalation.productName,
      stage: escalation.stageName ?? '\u2014',
      assignee: escalation.leadName,
      description: escalation.description,
    };
  }
  if (escalation.type === 'at_risk') {
    return {
      id: `esc-${index}`,
      severity: 'at-risk',
      product: escalation.productName,
      stage: escalation.stageName ?? '\u2014',
      assignee: escalation.leadName,
      description: escalation.description,
    };
  }
  // unresolved_risk: surface as at-risk in the dashboard.
  return {
    id: `esc-${index}`,
    severity: 'at-risk',
    product: escalation.productName,
    stage: escalation.stageName ?? '\u2014',
    assignee: escalation.leadName,
    description: escalation.description,
  };
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
    weekLabel: isoWeekLabel(summary.periodStart),
    dateRange: `${shortDate(summary.periodStart)}\u2013${shortDate(summary.periodEnd)}`,
    status: 'published',
    // Submission counts aren't on ArchiveReportSummary at v5.0.
    submissionLabel: '',
    productCount: 0,
    riskCount: 0,
    decisionCount: 0,
  };
}

// ---- Composer ----

export type MapDashboardArgs = {
  review: SubmissionDashboardRow[];
  archive: PaginatedResult<ArchiveReportSummary>;
  weeklyReport: WeeklyReportReadModel;
  /** Override `now` for deterministic deadline tests. */
  now?: Date;
  /** Optional: identifier of the currently authenticated lead, used to flag isCurrentUser. */
  currentUserId?: string;
};

export type MappedDashboard = {
  kpi: KpiData;
  leads: LeadInfo[];
  blockedAtRisk: BlockedAtRiskItem[];
  archive: ArchiveReport[];
  pendingLeads: string[];
};

export function mapDashboardData(args: MapDashboardArgs): MappedDashboard {
  const now = args.now ?? new Date();
  const { review, archive, weeklyReport, currentUserId } = args;

  // Build a section index by author for fast lookup.
  const sectionByAuthor = new Map<string, ReportSectionReadModel>();
  for (const section of weeklyReport.leadSections) {
    sectionByAuthor.set(section.authorId, section);
  }

  // -------- Leads --------
  const leads: LeadInfo[] = review.map((row) => {
    const section = sectionByAuthor.get(row.leadId);
    const itemCount = section ? countItems(section) : 0;
    const status: LeadStatus = section
      ? deriveLeadStatus({ sectionStatus: section.status, itemCount })
      : 'pending';

    // The portfolio overview only carries lead NAMES, so we name-match either way.
    const trafficLights = trafficLightsForLeadByName(
      row.leadName,
      weeklyReport.portfolioOverview,
    );

    const lastActivity =
      section?.submittedAt
        ? section.submittedAt.toISOString().slice(0, 10)
        : status === 'pending'
          ? 'Not started'
          : 'In progress';

    return {
      id: row.leadId,
      initials: initialsFromName(row.leadName),
      name: row.leadName,
      role: row.role,
      status,
      trafficLights,
      lastActivity,
      isCurrentUser: currentUserId !== undefined && row.leadId === currentUserId,
      productCount: row.projectNames.length,
    };
  });

  // -------- Pending leads (alert bar) --------
  const pendingLeads = leads.filter((l) => l.status === 'pending').map((l) => l.name);

  // -------- KPI --------
  const submitted = weeklyReport.submissionCount;
  const total = weeklyReport.totalLeads;
  const pendingCount = pendingLeads.length;

  const blockedCount = weeklyReport.escalations.filter((e) => e.type === 'blocked').length;
  const atRiskCount = weeklyReport.escalations.filter(
    (e) => e.type === 'at_risk' || e.type === 'unresolved_risk',
  ).length;
  const decisionCount = weeklyReport.leadSections.reduce(
    (sum, section) => sum + section.decisions.length,
    0,
  );

  const deadlineLabel = formatRelativeDeadline(weeklyReport.periodEnd, now);
  const deadlineTime = isoDateLabel(weeklyReport.periodEnd);

  const kpi: KpiData = {
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

  // -------- Blocked & At-Risk --------
  const blockedAtRisk: BlockedAtRiskItem[] = weeklyReport.escalations
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
  isoWeekLabel,
};
