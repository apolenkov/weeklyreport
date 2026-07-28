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
  tooltip?: string | undefined;
  // True when the lead's own non-empty risk explicitly names this stage
  // (empty/legacy "covers all" stageNames does NOT set it). Additive to raw
  // status for completeness; foreign risks never set it.
  coveredByOwnRisk?: boolean | undefined;
}

export interface Product {
  id: string;
  name: string;
  overallStatus: StageStatus;
  stages: StageAssignment[];
  riskSummary?: string | undefined;
  riskCount?: number | undefined;
}

export interface KanbanItem {
  id: string;
  productId: string;
  productName: string;
  // Activity-parented (XOR with product): no stage, not in product columns.
  // productId is empty for these rows.
  activityId?: string | null | undefined;
  activityName?: string | undefined;
  /** @deprecated Use stageNames. Kept for reading legacy data. */
  stageName?: string | undefined;
  stageNames?: string[] | undefined;
  status: ItemStatus;
  text: string;
  author: string;
  foreign?: boolean | undefined;
  authorId?: string | undefined;
  priorityRank?: number | null | undefined;
  // Required in UI when pausing; schema stays permissive for legacy paused rows.
  pausedReason?: string | null | undefined;
}

export interface RiskEntry {
  id: string;
  productId: string;
  productName: string;
  activityId?: string | null | undefined;
  activityName?: string | undefined;
  /** @deprecated Use stageNames. Kept for reading legacy data. */
  stageName?: string | undefined;
  stageNames?: string[] | undefined;
  severity: "at-risk" | "blocked";
  text: string;
  impact: string;
  mitigation: string;
  foreign?: boolean | undefined;
  authorId?: string | undefined;
  authorName?: string | undefined;
}

export interface DecisionEntry {
  id: string;
  productId: string;
  productName: string;
  activityId?: string | null | undefined;
  activityName?: string | undefined;
  text: string;
  owner: string;
  impact: string;
  deadline: string | null;
  /** @deprecated Use stageNames. Kept for reading legacy data. */
  stageName?: string | undefined;
  stageNames?: string[] | undefined;
  foreign?: boolean | undefined;
  authorId?: string | undefined;
}

export interface PriorityEntry {
  rank: number;
  text: string;
  /** @deprecated Use stageNames. Kept for reading legacy data. */
  stageName?: string | undefined;
  stageNames?: string[] | undefined;
  productId?: string | undefined;
  productName?: string | undefined;
  foreign?: boolean | undefined;
  authorId?: string | undefined;
  authorName?: string | undefined;
}

export interface ReportPeriod {
  id: string;
  // Section id for fillFrom; matches LeadReportPeriod.sourceSectionId structurally.
  sourceSectionId: string;
  weekLabel: string;
  dateRange: string;
  isCurrent: boolean;
  isSubmitted: boolean;
  archived?: boolean | undefined;
  itemCount?: number | undefined;
  riskCount?: number | undefined;
  productCount?: number | undefined;
}
