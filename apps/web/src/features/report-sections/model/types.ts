import type { StageStatus } from "./traffic-light";

export type { StageStatus } from "./traffic-light";

// Progress values plus the risk-derived display-only "blocked".
import type { ItemStatus } from "./item-status";

export type { ItemStatus } from "./item-status";

// A stage is the lead's own ("mine") or another lead's ("locked", read-only).
// Stages with no assignment are excluded from the grid (see buildStageGrid).
type StageOwnership = "mine" | "locked";

export interface StageAssignment {
  readonly stageName: string;
  readonly status: StageStatus;
  readonly ownership: StageOwnership;
  readonly assignee: string | null;
  readonly tooltip?: string | undefined;
  // True when the lead's own non-empty risk explicitly names this stage
  // (empty/legacy "covers all" stageNames does NOT set it). Additive to raw
  // status for completeness; foreign risks never set it.
  readonly coveredByOwnRisk?: boolean | undefined;
}

export interface Product {
  readonly id: string;
  readonly name: string;
  readonly overallStatus: StageStatus;
  readonly stages: readonly StageAssignment[];
  readonly riskSummary?: string | undefined;
  readonly riskCount?: number | undefined;
}

export type KanbanItemParent =
  | { readonly kind: "product"; readonly id: string }
  | { readonly kind: "activity"; readonly id: string }
  | { readonly kind: "unresolved" };

interface KanbanItemFields {
  readonly id: string;
  readonly stageName?: string | undefined;
  readonly stageNames?: readonly string[] | undefined;
  readonly status: ItemStatus;
  readonly text: string;
  readonly author: string;
  readonly foreign?: boolean | undefined;
  readonly authorId?: string | undefined;
  readonly priorityRank?: number | null | undefined;
  // Required in UI when pausing; schema stays permissive for legacy paused rows.
  readonly pausedReason?: string | null | undefined;
}

export type ProductKanbanItem = KanbanItemFields & {
  readonly parent: { readonly kind: "product"; readonly id: string };
  readonly productId: string;
  readonly productName: string;
  readonly activityId: null;
  readonly activityName?: undefined;
};

export type ActivityKanbanItem = KanbanItemFields & {
  readonly parent: { readonly kind: "activity"; readonly id: string };
  readonly productId: null;
  readonly productName: string;
  readonly activityId: string;
  readonly activityName: string;
};

type UnresolvedKanbanItem = KanbanItemFields & {
  readonly parent: { readonly kind: "unresolved" };
  readonly productId: null;
  readonly productName: string;
  readonly activityId: null;
  readonly activityName?: undefined;
};

export type KanbanItem =
  ProductKanbanItem | ActivityKanbanItem | UnresolvedKanbanItem;

export interface RiskEntry {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly activityId?: string | null | undefined;
  readonly activityName?: string | undefined;
  readonly stageName?: string | undefined;
  readonly stageNames?: readonly string[] | undefined;
  readonly severity: "at-risk" | "blocked";
  readonly text: string;
  readonly impact: string;
  readonly mitigation: string;
  readonly foreign?: boolean | undefined;
  readonly authorId?: string | undefined;
  readonly authorName?: string | undefined;
}

export interface DecisionEntry {
  readonly id: string;
  readonly productId: string;
  readonly productName: string;
  readonly activityId?: string | null | undefined;
  readonly activityName?: string | undefined;
  readonly text: string;
  readonly owner: string;
  readonly impact: string;
  readonly deadline: string | null;
  readonly stageName?: string | undefined;
  readonly stageNames?: readonly string[] | undefined;
  readonly foreign?: boolean | undefined;
  readonly authorId?: string | undefined;
}

export interface PriorityEntry {
  readonly rank: number;
  readonly text: string;
  readonly stageName?: string | undefined;
  readonly stageNames?: readonly string[] | undefined;
  readonly productId?: string | undefined;
  readonly productName?: string | undefined;
  readonly foreign?: boolean | undefined;
  readonly authorId?: string | undefined;
  readonly authorName?: string | undefined;
}

export interface ReportPeriod {
  readonly id: string;
  // Machine-readable period start for chronology — presentation labels must
  // never be reverse-parsed for ordering.
  readonly periodStart: Date;
  // Section id for fillFrom; matches LeadReportPeriod.sourceSectionId
  // structurally. Absent on navigation-only periods (no section to fill).
  readonly sourceSectionId?: string | undefined;
  readonly weekLabel: string;
  readonly dateRange: string;
  readonly isCurrent: boolean;
  // Per-lead submission marker; absent on head/viewer navigation periods,
  // where the navigator's leadSubmittedAt is the only submission source.
  readonly isSubmitted?: boolean | undefined;
  readonly archived?: boolean | undefined;
  readonly itemCount?: number | undefined;
  readonly riskCount?: number | undefined;
  readonly productCount?: number | undefined;
}
