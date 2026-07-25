import type { StageStatus } from "./traffic-light";

export type { StageStatus } from "./traffic-light";

// Progress values plus the risk-derived display-only "blocked".
import type { ItemStatus } from "./item-status";

export type { ItemStatus } from "./item-status";

// A stage is the lead's own ("mine") or another lead's ("locked", read-only).
// Stages with no assignment are excluded from the grid (see buildStageGrid).
type StageOwnership = "mine" | "locked";

export interface StageAssignment {
  stageName: string;
  status: StageStatus;
  ownership: StageOwnership;
  assignee: string | null;
  tooltip?: string;
  // True when the lead's own non-empty risk explicitly names this stage
  // (empty/legacy "covers all" stageIds does NOT set it). Additive to raw
  // status for completeness; foreign risks never set it.
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
  // Activity-parented (XOR with product): no stage, not in product columns.
  // productId is empty for these rows.
  activityId?: string | null;
  activityName?: string;
  /** @deprecated Use stageIds. Kept for reading legacy data. */
  stageName?: string;
  stageIds?: string[];
  status: ItemStatus;
  text: string;
  author: string;
  foreign?: boolean;
  authorId?: string;
  priorityRank?: number | null;
  // Required in UI when pausing; schema stays permissive for legacy paused rows.
  pausedReason?: string | null;
}

export interface RiskEntry {
  id: string;
  productId: string;
  productName: string;
  activityId?: string | null;
  activityName?: string;
  /** @deprecated Use stageIds. Kept for reading legacy data. */
  stageName?: string;
  stageIds?: string[];
  severity: "at-risk" | "blocked";
  text: string;
  impact: string;
  mitigation: string;
  foreign?: boolean;
  authorId?: string;
  authorName?: string;
}

export interface DecisionEntry {
  id: string;
  productId: string;
  productName: string;
  activityId?: string | null;
  activityName?: string;
  text: string;
  owner: string;
  impact: string;
  deadline: string | null;
  /** @deprecated Use stageIds. Kept for reading legacy data. */
  stageName?: string;
  stageIds?: string[];
  foreign?: boolean;
  authorId?: string;
}

export interface PriorityEntry {
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
  // Section id for fillFrom; matches LeadReportPeriod.sourceSectionId structurally.
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
