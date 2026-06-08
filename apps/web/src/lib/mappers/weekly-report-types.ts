/**
 * Presentation types for the Weekly Report / `/reports/[reportId]` pages,
 * produced by {@link mapWeeklyReport} in `./weekly-report`. Extracted from that
 * module (R3a-4 max-lines split); re-exported from `./weekly-report` so existing
 * importers (and the `./index` barrel) are unaffected.
 */
import type { WeeklyReportReadModel } from "@customreport/shared";

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
  text: string;
  status: ItemStatus;
}

export interface WeeklyReportRisk {
  id: string;
  badge: string;
  severity: "blocked" | "at-risk";
  text: string;
}

export interface WeeklyReportDecision {
  id: string;
  badge: string;
  text: string;
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

export interface WeeklyReportPeriod {
  id: string;
  /**
   * Concrete report identifier (UUID). Equal to `id` (which historically was
   * set to `api.reportId`); surfaced explicitly so consumers wiring publish /
   * reopen mutations can read `period.reportId` without relying on the
   * implicit `id === reportId` invariant. Added in Phase 22 (plan 22-05).
   */
  reportId: string;
  /**
   * Period lifecycle state mirrored from the API. Used by the head's
   * Publish & Lock / Reopen toggle to decide which action to render.
   * Phase 22 (plan 22-05).
   */
  periodStatus: "open" | "published" | "reopened";
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
