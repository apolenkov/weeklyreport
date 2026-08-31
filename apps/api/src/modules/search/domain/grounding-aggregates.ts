import type { CanonicalStatus, SearchPlan } from "@customreport/shared";

import { classifyDecision } from "./decision-classification.js";
import type {
  ResolvedSearchPlan,
  SearchCandidate,
} from "./report-retrieval.types.js";

export type CountGroup = Readonly<{ key: string; count: number }>;

export type SupportingStatusFact = Readonly<{
  subjectKind: "product" | "activity";
  subjectName: string;
  status: CanonicalStatus;
  stages: readonly string[];
}>;

export type GroundingAggregates = Readonly<{
  totalCount: number;
  byKind: readonly CountGroup[];
  byPeriod: readonly CountGroup[];
  byAuthor: readonly CountGroup[];
  groups: readonly CountGroup[];
  supportingStatusFacts: readonly SupportingStatusFact[];
}>;

type GroupDimension = SearchPlan["output"]["groupBy"][number];
type StatusCandidate = SearchCandidate & Readonly<{ status: CanonicalStatus }>;
export type GroundingClassificationContext = Readonly<{
  now: Date;
  timeZone: string;
}>;

const isStatusCandidate = (
  candidate: SearchCandidate,
): candidate is StatusCandidate => candidate.kind.endsWith("_status");

const countBy = (
  candidates: readonly SearchCandidate[],
  keyOf: (candidate: SearchCandidate) => string,
): readonly CountGroup[] => {
  const counts = candidates.reduce<ReadonlyMap<string, number>>(
    (current, candidate) => {
      const key = keyOf(candidate);
      return new Map(current).set(key, (current.get(key) ?? 0) + 1);
    },
    new Map<string, number>(),
  );
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => left.key.localeCompare(right.key, "en"));
};

const dimensionValueByGroup: Record<
  GroupDimension,
  (
    candidate: SearchCandidate,
    context: GroundingClassificationContext,
  ) => string
> = {
  period: (candidate) => candidate.context.periodLabel,
  author: (candidate) => candidate.context.authorName,
  subject: (candidate) => candidate.context.subject.name,
  stage: (candidate) => candidate.context.stageIds.join(", ") || "none",
  record_kind: (candidate) => candidate.kind,
  canonical_health: (candidate) =>
    isStatusCandidate(candidate) ? candidate.status : "empty",
  item_type: (candidate) =>
    candidate.kind === "item" ? candidate.itemType : "none",
  item_workflow_status: (candidate) =>
    candidate.kind === "item" ? candidate.workflowStatus : "none",
  risk_severity: (candidate) =>
    candidate.kind === "risk" ? candidate.severity : "none",
  decision_state: (candidate, context) =>
    candidate.kind === "decision"
      ? classifyDecision(candidate, context.now, context.timeZone).state
      : "none",
  decision_timing: (candidate, context) =>
    candidate.kind === "decision"
      ? classifyDecision(candidate, context.now, context.timeZone).timing
      : "none",
};

export const buildGroundingAggregates = (
  candidates: readonly SearchCandidate[],
  plan: ResolvedSearchPlan,
  classificationContext: GroundingClassificationContext,
): GroundingAggregates => ({
  totalCount: candidates.length,
  byKind: countBy(candidates, (candidate) => candidate.kind),
  byPeriod: countBy(candidates, (candidate) => candidate.context.periodLabel),
  byAuthor: countBy(candidates, (candidate) => candidate.context.authorName),
  groups: plan.plan.output.groupBy.flatMap((dimension) =>
    countBy(
      candidates,
      (candidate) =>
        `${dimension}:${dimensionValueByGroup[dimension](
          candidate,
          classificationContext,
        )}`,
    ),
  ),
  supportingStatusFacts: [],
});
