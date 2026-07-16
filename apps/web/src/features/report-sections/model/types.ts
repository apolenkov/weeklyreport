/**
 * Read-model type definitions shared across report-sections consumers.
 * Real data will come from tRPC endpoints in a later phase.
 */

// The vocabulary is declared once (`CanonicalStatus` in @customreport/shared);
// this re-export keeps the historical import path for stage-grid consumers.
import type { StageStatus } from "./traffic-light";

export type { StageStatus } from "./traffic-light";

// Single source: the mapper's union (rework-item-status-model) — progress
// values plus the risk-derived display-only "blocked".
import type { ItemStatus } from "./item-status";

export type { ItemStatus } from "./item-status";

// unassigned-stage-reporting-exclusion: "unassigned" is gone — a stage is the
// lead's own ("mine") or another lead's ("locked", read-only). A stage with no
// assignment is excluded from the grid entirely (see buildStageGrid).
export type StageOwnership = "mine" | "locked";

export interface StageAssignment {
  stageName: string;
  status: StageStatus;
  ownership: StageOwnership;
  assignee: string | null;
  tooltip?: string;
  /**
   * W11 (fix-report-surface-integrity): true when this stage is covered by the
   * lead's OWN non-empty risk that EXPLICITLY names the stage (strict — an
   * empty/legacy "covers all" stageIds does NOT set this). Additive to the raw
   * `status`: an empty-but-covered own stage counts toward completeness while
   * staying distinguishable from an explicitly-set status. Foreign risks never
   * set it.
   */
  coveredByOwnRisk?: boolean;
}

export interface Product {
  id: string;
  name: string;
  overallStatus: StageStatus;
  stages: StageAssignment[];
  riskSummary?: string;
  riskCount?: number;
}

export interface KanbanItem {
  id: string;
  productId: string;
  productName: string;
  /**
   * activity-first-class: set when the record is parented to an Activity
   * instead of a product (XOR — exactly one). Activity-parented rows carry no
   * stage and never appear in a product column; they render under the activity
   * card. `productId` is empty for these rows.
   */
  activityId?: string | null;
  /** Display name of the parent activity when `activityId` is set. */
  activityName?: string;
  /** @deprecated Use stageIds. Kept for reading legacy data. */
  stageName?: string;
  stageIds?: string[];
  status: ItemStatus;
  text: string;
  author: string;
  /** When true, this item belongs to another author (viewer-side, read-only). */
  foreign?: boolean;
  authorId?: string;
  /** Derived from Item.priorityRank. Null = not a priority item. */
  priorityRank?: number | null;
  /**
   * require-paused-item-reason: the lead's reason for pausing this item. Set
   * only on a paused row; null/undefined otherwise. The UI requires it when
   * pausing (the schema stays permissive for legacy paused rows).
   */
  pausedReason?: string | null;
}

export interface RiskEntry {
  id: string;
  productId: string;
  productName: string;
  /** activity-first-class: parent activity id (XOR with productId). See KanbanItem. */
  activityId?: string | null;
  /** Display name of the parent activity when `activityId` is set. */
  activityName?: string;
  /** @deprecated Use stageIds. Kept for reading legacy data. */
  stageName?: string;
  stageIds?: string[];
  severity: "at-risk" | "blocked";
  /** The user-controlled "what is the risk" text (= raw `risk` field). */
  text: string;
  /** Schema-required impact narrative; surfaced in the edit dialog. */
  impact: string;
  /** Schema-required mitigation narrative; surfaced in the edit dialog. */
  mitigation: string;
  foreign?: boolean;
  authorId?: string;
  authorName?: string;
}

export interface DecisionEntry {
  id: string;
  productId: string;
  productName: string;
  /** activity-first-class: parent activity id (XOR with productId). See KanbanItem. */
  activityId?: string | null;
  /** Display name of the parent activity when `activityId` is set. */
  activityName?: string;
  text: string;
  /** Schema-required owner (responsible person). Surfaced in the edit dialog. */
  owner: string;
  /** Schema-required impact narrative. Surfaced in the edit dialog. */
  impact: string;
  /** Optional deadline (ISO date string) — null when not set. */
  deadline: string | null;
  /** @deprecated Use stageIds. Kept for reading legacy data. */
  stageName?: string;
  stageIds?: string[];
  foreign?: boolean;
  authorId?: string;
}

export interface PriorityEntry {
  /** 1-indexed rank. Schema allows any positive int up to 50 per draft. */
  rank: number;
  text: string;
  /** @deprecated Use stageIds. Kept for reading legacy data. */
  stageName?: string;
  stageIds?: string[];
  productId?: string;
  productName?: string;
  foreign?: boolean;
  authorId?: string;
  authorName?: string;
}

export interface ReportPeriod {
  id: string;
  /**
   * Section id (per-lead) used for fillFrom mutation. Matches
   * `LeadReportPeriod.sourceSectionId` so cast-through stays structural.
   */
  sourceSectionId: string;
  weekLabel: string;
  dateRange: string;
  isCurrent: boolean;
  isSubmitted: boolean;
  archived?: boolean;
  itemCount?: number;
  riskCount?: number;
  productCount?: number;
}

export interface HistoryEntry {
  id: string;
  periodId: string;
  weekLabel: string;
  dateRange: string;
  status: "submitted" | "draft";
  submittedAt?: string;
  trafficLights: { green: number; yellow: number; red: number };
  itemCount: number;
  riskCount: number;
  decisionCount: number;
}
