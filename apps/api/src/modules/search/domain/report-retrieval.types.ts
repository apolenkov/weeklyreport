import type {
  CanonicalStatus,
  ReportSectionReadModel,
  SearchPlan,
} from "@customreport/shared";

type ReportSourceKind = "live" | "snapshot";
type CandidateKind =
  | "item"
  | "risk"
  | "decision"
  | "product_status"
  | "stage_status"
  | "activity_status";

export type ReportOccurrence = Readonly<{
  reportId: string;
  periodId: string;
  periodLabel: string;
  periodStart: Date;
  source: ReportSourceKind;
  sections: readonly ReportSectionReadModel[];
}>;

export type SectionScope = Readonly<{
  reportId: string;
  sectionId: string;
  authorId: string;
  visibility: "own" | "shared_products";
  section: ReportSectionReadModel;
}>;

export type ResolvedSearchPlan = Readonly<{
  plan: SearchPlan;
  occurrences: readonly ReportOccurrence[];
  sectionScopes: readonly SectionScope[];
  authorIds: readonly string[];
  productIds: readonly string[];
  activityIds: readonly string[];
  stageIds: readonly string[];
  periodIds: readonly string[];
}>;

export type CandidateIdentity = Readonly<{
  occurrenceId: string;
  recordId: string;
  lineageId: string | null;
}>;

export type CandidateContext = Readonly<{
  reportId: string;
  periodId: string;
  periodLabel: string;
  periodStart: Date;
  source: ReportSourceKind;
  sectionId: string;
  authorId: string;
  authorName: string;
  subject: Readonly<{
    kind: "product" | "activity";
    id: string;
    name: string;
  }>;
  stageIds: readonly string[];
  linkedProductIds: readonly string[];
}>;

type CandidateBase<TKind extends CandidateKind> = Readonly<{
  kind: TKind;
  identity: CandidateIdentity;
  context: CandidateContext;
}>;

export type ItemCandidate = CandidateBase<"item"> &
  Readonly<{
    text: string;
    itemType: "current" | "next";
    workflowStatus: "planned" | "in_progress" | "paused" | "postponed" | "done";
    carriedOver: boolean;
    priorityRank: number | null;
  }>;

export type RiskCandidate = CandidateBase<"risk"> &
  Readonly<{
    risk: string;
    impact: string;
    mitigation: string;
    severity: "at-risk" | "blocked";
  }>;

export type DecisionCandidate = CandidateBase<"decision"> &
  Readonly<{
    text: string;
    impact: string;
    owner: string;
    deadline: Date | null;
    resolvedAt: Date | null;
  }>;

type StatusCandidate<TKind extends CandidateKind> = CandidateBase<TKind> &
  Readonly<{ status: CanonicalStatus }>;

export type ProductStatusCandidate = StatusCandidate<"product_status">;
export type StageStatusCandidate = StatusCandidate<"stage_status">;
export type ActivityStatusCandidate = StatusCandidate<"activity_status"> &
  Readonly<{ note: string | null }>;

export type SearchCandidate =
  | ItemCandidate
  | RiskCandidate
  | DecisionCandidate
  | ProductStatusCandidate
  | StageStatusCandidate
  | ActivityStatusCandidate;
