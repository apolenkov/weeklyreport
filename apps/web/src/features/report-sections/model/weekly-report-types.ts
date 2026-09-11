// Presentation types for the Weekly Report pages, produced by mapWeeklyReport.
import type {
  CanonicalStatus,
  ItemOutcomeEvent,
  ItemResolution,
  RecordCommentView,
  WeeklyReportReadModel,
} from "@customreport/shared";

import type { ItemStatus } from "./item-status";

export type WeeklyProductStatus = CanonicalStatus;

export interface WeeklyPortfolioProduct {
  id: string;
  initials: string;
  name: string;
  hasContent: boolean;
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
  comments?: readonly RecordCommentView[];
  canReview?: boolean;
  // Server-owned outcome context remains read-only on report and export views.
  nextStepText?: string | null;
  resolution?: ItemResolution | null;
  outcomeHistory?: readonly ItemOutcomeEvent[];
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
  comments?: readonly RecordCommentView[];
  canReview?: boolean;
}

export interface WeeklyReportDecision {
  id: string;
  badge: string;
  owner: string;
  text: string;
  comments?: readonly RecordCommentView[];
  canReview?: boolean;
}

export interface WeeklyReportPriority {
  id: string;
  rank: number;
  text: string;
}

// Attention text and its severity are a pair: a projection must never emit
// text without a severity (a "blocked" vs "at-risk" callout would be invented).
interface ProductAttentionPair {
  readonly needsAttention: string;
  readonly needsAttentionSeverity: "blocked" | "at-risk";
}
export type ProductAttention =
  | ProductAttentionPair
  | {
      readonly needsAttention?: undefined;
      readonly needsAttentionSeverity?: undefined;
    };

interface WeeklyProductReportFields {
  id: string;
  authorIds: string[];
  initials: string;
  name: string;
  status: WeeklyProductStatus;
  statusLabel: string;
  leads: string;
  currentWeek: WeeklyReportItem[];
  nextWeek: WeeklyReportItem[];
  risks: WeeklyReportRisk[];
  decisions: WeeklyReportDecision[];
  priorities: WeeklyReportPriority[];
}

export type WeeklyProductReport = WeeklyProductReportFields & ProductAttention;

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
  periodStart: Date;
  // Explicit so publish/reopen consumers need not rely on id === reportId.
  reportId: string;
  // Lifecycle state for Publish & Lock / Reopen toggle.
  periodState: WeeklyReportReadModel["periodState"];
  periodStatus: WeeklyReportReadModel["periodStatus"];
  // Orthogonal to periodStatus: an archived report stays "published".
  archived: boolean;
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
