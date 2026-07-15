/**
 * Presentation types for the Weekly Report / `/reports/[reportId]` pages,
 * produced by {@link mapWeeklyReport} in `./weekly-report`. Re-exported from
 * `./weekly-report` so existing importers (and the `./index` barrel) are
 * unaffected.
 */
import type {
  RecordCommentView,
  WeeklyReportReadModel,
} from "@customreport/shared";

import type { ItemStatus } from "./item-status";

export type WeeklyProductStatus = "on-track" | "at-risk" | "blocked";

export interface WeeklyPortfolioProduct {
  id: string;
  initials: string;
  name: string;
  status: WeeklyProductStatus;
  statusLabel: string;
  leads: string;
  currentWeekCount: number;
  nextWeekCount: number;
  riskCount: number;
}

export interface WeeklyReportItem {
  id: string;
  stageLead: string;
  /** SDLC stage name for the redesigned gutter (e.g. "Development"); "" when none. */
  stage: string;
  /** Contributing lead's initials for the gutter (e.g. "ВИ"). */
  owner: string;
  text: string;
  status: ItemStatus;
  /** Priority rank (1 = top) when the item is a flagged priority; null otherwise. */
  priorityRank?: number | null;
  /** review-acknowledgement: reviewer comments anchored to this item's DB id. */
  comments?: RecordCommentView[];
  /** review-acknowledgement: true when the current caller may review this row's group. */
  canReview?: boolean;
}

export interface WeeklyReportRisk {
  id: string;
  badge: string;
  /** SDLC stage name for the gutter; "" when none. */
  stage: string;
  /** Contributing lead's initials for the gutter. */
  owner: string;
  severity: "blocked" | "at-risk";
  /** Merged "problem — Impact: … — Mitigation: …" (kept for the print template). */
  text: string;
  /** Structured fields for the redesigned risk row. */
  problem: string;
  impact: string;
  mitigation: string;
  /** review-acknowledgement: reviewer comments anchored to this risk's DB id. */
  comments?: RecordCommentView[];
  /** review-acknowledgement: true when the current caller may review this row's group. */
  canReview?: boolean;
}

export interface WeeklyReportDecision {
  id: string;
  badge: string;
  /** Contributing lead's initials for the gutter. */
  owner: string;
  text: string;
  /** review-acknowledgement: reviewer comments anchored to this decision's DB id. */
  comments?: RecordCommentView[];
  /** review-acknowledgement: true when the current caller may review this row's group. */
  canReview?: boolean;
}

export interface WeeklyReportPriority {
  rank: number;
  text: string;
}

export interface WeeklyProductReport {
  id: string;
  authorIds: string[];
  initials: string;
  name: string;
  status: WeeklyProductStatus;
  statusLabel: string;
  leads: string;
  needsAttention?: string;
  needsAttentionSeverity?: "blocked" | "at-risk";
  currentWeek: WeeklyReportItem[];
  nextWeek: WeeklyReportItem[];
  risks: WeeklyReportRisk[];
  decisions: WeeklyReportDecision[];
  priorities: WeeklyReportPriority[];
}

// report-overview-scope-parity: one row of the Report overview in `by lead`
// scope — derived from the already-computed per-lead groups. `worstStatus` is
// the worst traffic light across the lead's sliced products; the counts are
// summed over those products. Mirrors the product overview card's three counts.
export interface LeadOverviewRow {
  id: string;
  name: string;
  worstStatus: WeeklyProductStatus;
  currentCount: number;
  nextCount: number;
  riskCount: number;
}

export interface WeeklyReportPeriod {
  id: string;
  /**
   * Concrete report identifier (UUID). Equal to `id` (which historically was
   * set to `api.reportId`); surfaced explicitly so consumers wiring publish /
   * reopen mutations can read `period.reportId` without relying on the
   * implicit `id === reportId` invariant.
   */
  reportId: string;
  /**
   * Period lifecycle state mirrored from the API. Used by the head's
   * Publish & Lock / Reopen toggle to decide which action to render.
   */
  periodStatus: WeeklyReportReadModel["periodStatus"];
  weekLabel: string;
  dateRange: string;
  isCurrent: boolean;
}

export interface MapWeeklyReportResult {
  period: WeeklyReportPeriod;
  portfolio: WeeklyPortfolioProduct[];
  products: WeeklyProductReport[];
  /** Header summary string ("4/6 leads submitted"). */
  submissionLabel: string;
  /** raw period state for header/banner UX. */
  periodStatus: WeeklyReportReadModel["periodStatus"];
  /** Submission count (for top-of-page badge). */
  submissionCount: number;
  /** Total leads (for top-of-page badge). */
  totalLeads: number;
}
