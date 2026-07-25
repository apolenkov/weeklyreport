// Presentation types for the Weekly Report pages, produced by mapWeeklyReport.
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
  stage: string;
  owner: string;
  text: string;
  status: ItemStatus;
  priorityRank?: number | null;
  comments?: RecordCommentView[];
  canReview?: boolean;
}

export interface WeeklyReportRisk {
  id: string;
  badge: string;
  stage: string;
  owner: string;
  severity: "blocked" | "at-risk";
  // Merged "problem — Impact: … — Mitigation: …" (kept for the print template).
  text: string;
  problem: string;
  impact: string;
  mitigation: string;
  comments?: RecordCommentView[];
  canReview?: boolean;
}

export interface WeeklyReportDecision {
  id: string;
  badge: string;
  owner: string;
  text: string;
  comments?: RecordCommentView[];
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

// By-lead overview row: worst traffic across sliced products; counts summed.
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
  // Explicit so publish/reopen consumers need not rely on id === reportId.
  reportId: string;
  // Lifecycle state for Publish & Lock / Reopen toggle.
  periodStatus: WeeklyReportReadModel["periodStatus"];
  weekLabel: string;
  dateRange: string;
  isCurrent: boolean;
}

export interface MapWeeklyReportResult {
  period: WeeklyReportPeriod;
  portfolio: WeeklyPortfolioProduct[];
  products: WeeklyProductReport[];
  submissionLabel: string;
  periodStatus: WeeklyReportReadModel["periodStatus"];
  submissionCount: number;
  totalLeads: number;
}
