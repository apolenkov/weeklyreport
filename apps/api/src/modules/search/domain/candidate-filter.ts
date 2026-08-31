import type { SearchPlan } from "@customreport/shared";

import { classifyDecision } from "./decision-classification.js";
import { normalizeEntityReference } from "./entity-alias-index.js";
import type {
  ResolvedSearchPlan,
  SearchCandidate,
} from "./report-retrieval.types.js";

export type CandidateClock = Readonly<{
  now: Date;
  timeZone: string;
}>;

export type CandidateLimitConfig = Readonly<{
  candidateLimit: number;
  exhaustiveLimit: number;
}>;

export type CandidateLimitOutcome =
  | Readonly<{
      kind: "ok";
      candidates: readonly SearchCandidate[];
      totalCount: number;
      truncated: boolean;
    }>
  | Readonly<{ kind: "result_set_too_large"; totalCount: number }>;

export const checkCandidateSetLimit = (
  candidates: readonly SearchCandidate[],
  plan: ResolvedSearchPlan,
  limits: CandidateLimitConfig,
): CandidateLimitOutcome => {
  const totalCount = candidates.length;
  const hardLimitApplies =
    plan.plan.output.exhaustive ||
    plan.plan.retrieval.mode === "semantic_ranked";
  return hardLimitApplies && totalCount > limits.exhaustiveLimit
    ? { kind: "result_set_too_large", totalCount }
    : { kind: "ok", candidates, totalCount, truncated: false };
};

const sortText = (left: string, right: string): number =>
  left.localeCompare(right, "en", { sensitivity: "base" });

const includesNormalized = (
  values: readonly string[],
  candidate: string,
): boolean =>
  values.some(
    (value) =>
      normalizeEntityReference(value) === normalizeEntityReference(candidate),
  );

const matchesAuthor = (
  candidate: SearchCandidate,
  plan: ResolvedSearchPlan,
): boolean => {
  if (plan.plan.authors.mode === "all_visible" && plan.authorIds.length === 0) {
    return false;
  }
  return plan.authorIds.includes(candidate.context.authorId);
};

const matchesSubject = (
  candidate: SearchCandidate,
  plan: ResolvedSearchPlan,
): boolean => {
  const { subjects } = plan.plan;
  if (
    subjects.parentKinds.length > 0 &&
    !subjects.parentKinds.includes(candidate.context.subject.kind)
  ) {
    return false;
  }

  const hasProductFilter = plan.productIds.length > 0;
  const hasActivityFilter = plan.activityIds.length > 0;
  const hasReferenceFilter = hasProductFilter || hasActivityFilter;
  if (!hasReferenceFilter) return true;

  const { subject } = candidate.context;
  const directMatch =
    (subject.kind === "product" && plan.productIds.includes(subject.id)) ||
    (subject.kind === "activity" && plan.activityIds.includes(subject.id));
  const linkedProductMatch =
    subject.kind === "activity" &&
    candidate.context.linkedProductIds.some((id) =>
      plan.productIds.includes(id),
    );

  if (subjects.linkedActivityMode === "only") {
    return subject.kind === "activity" && linkedProductMatch;
  }
  if (subjects.linkedActivityMode === "include") {
    return directMatch || linkedProductMatch;
  }
  return directMatch;
};

const matchesStages = (
  candidate: SearchCandidate,
  plan: ResolvedSearchPlan,
): boolean =>
  plan.stageIds.length === 0 ||
  plan.stageIds.some((stage) =>
    includesNormalized(candidate.context.stageIds, stage),
  );

const matchesPeriods = (
  candidate: SearchCandidate,
  plan: ResolvedSearchPlan,
): boolean =>
  plan.periodIds.length === 0 ||
  plan.periodIds.includes(candidate.context.periodId);

const matchesRecordKind = (
  candidate: SearchCandidate,
  plan: ResolvedSearchPlan,
): boolean =>
  plan.plan.recordKinds.length === 0 ||
  plan.plan.recordKinds.includes(candidate.kind);

const matchesItemFilters = (
  candidate: Extract<SearchCandidate, { kind: "item" }>,
  plan: SearchPlan["filters"],
): boolean =>
  (plan.itemTypes.length === 0 ||
    plan.itemTypes.includes(candidate.itemType)) &&
  (plan.itemWorkflowStatuses.length === 0 ||
    plan.itemWorkflowStatuses.includes(candidate.workflowStatus)) &&
  (plan.carriedOver === null || plan.carriedOver === candidate.carriedOver) &&
  (plan.hasPriority === null ||
    plan.hasPriority === (candidate.priorityRank !== null)) &&
  (plan.priorityRanks.length === 0 ||
    (candidate.priorityRank !== null &&
      plan.priorityRanks.includes(candidate.priorityRank)));

const matchesRiskFilters = (
  candidate: Extract<SearchCandidate, { kind: "risk" }>,
  plan: SearchPlan["filters"],
): boolean =>
  plan.riskSeverities.length === 0 ||
  plan.riskSeverities.includes(candidate.severity);

const matchesDecisionFilters = (
  candidate: Extract<SearchCandidate, { kind: "decision" }>,
  plan: SearchPlan["filters"],
  clock: CandidateClock,
): boolean => {
  const classification = classifyDecision(candidate, clock.now, clock.timeZone);
  return (
    (plan.decisionStates.length === 0 ||
      plan.decisionStates.includes(classification.state)) &&
    (plan.decisionTiming.length === 0 ||
      plan.decisionTiming.includes(classification.timing))
  );
};

const matchesStatusFilters = (
  candidate: SearchCandidate,
  plan: SearchPlan["filters"],
): boolean =>
  plan.canonicalHealth.length === 0 ||
  ((candidate.kind === "product_status" ||
    candidate.kind === "stage_status" ||
    candidate.kind === "activity_status") &&
    plan.canonicalHealth.includes(candidate.status));

const matchesRecordFilters = (
  candidate: SearchCandidate,
  plan: SearchPlan["filters"],
  clock: CandidateClock,
): boolean => {
  if (!matchesStatusFilters(candidate, plan)) return false;
  if (candidate.kind === "item") return matchesItemFilters(candidate, plan);
  if (candidate.kind === "risk") return matchesRiskFilters(candidate, plan);
  return (
    candidate.kind !== "decision" ||
    matchesDecisionFilters(candidate, plan, clock)
  );
};

export function filterCandidates(
  candidates: readonly SearchCandidate[],
  plan: ResolvedSearchPlan,
  clock: CandidateClock,
): readonly SearchCandidate[] {
  return candidates.filter(
    (candidate) =>
      matchesAuthor(candidate, plan) &&
      matchesSubject(candidate, plan) &&
      matchesStages(candidate, plan) &&
      matchesPeriods(candidate, plan) &&
      matchesRecordKind(candidate, plan) &&
      matchesRecordFilters(candidate, plan.plan.filters, clock),
  );
}

const sourceRank = (source: SearchCandidate["context"]["source"]): number =>
  source === "live" ? 0 : 1;

const priorityRank = (candidate: SearchCandidate): number =>
  candidate.kind === "item" && candidate.priorityRank !== null
    ? candidate.priorityRank
    : Number.POSITIVE_INFINITY;

const structuredCompare = (
  left: SearchCandidate,
  right: SearchCandidate,
): number =>
  right.context.periodStart.getTime() - left.context.periodStart.getTime() ||
  sourceRank(left.context.source) - sourceRank(right.context.source) ||
  sortText(left.context.authorName, right.context.authorName) ||
  sortText(left.context.subject.name, right.context.subject.name) ||
  sortText(left.kind, right.kind) ||
  priorityRank(left) - priorityRank(right) ||
  sortText(left.identity.occurrenceId, right.identity.occurrenceId);

const semanticCompare = (
  scores: ReadonlyMap<string, number>,
  left: SearchCandidate,
  right: SearchCandidate,
): number =>
  (scores.get(right.identity.occurrenceId) ?? Number.NEGATIVE_INFINITY) -
    (scores.get(left.identity.occurrenceId) ?? Number.NEGATIVE_INFINITY) ||
  right.context.periodStart.getTime() - left.context.periodStart.getTime() ||
  sortText(left.identity.occurrenceId, right.identity.occurrenceId);

export function sortCandidates(
  candidates: readonly SearchCandidate[],
  mode: "structured" | "semantic_ranked",
  scores: ReadonlyMap<string, number>,
): readonly SearchCandidate[] {
  return [...candidates].sort((left, right) =>
    mode === "semantic_ranked"
      ? semanticCompare(scores, left, right)
      : structuredCompare(left, right),
  );
}

export function limitCandidates(
  candidates: readonly SearchCandidate[],
  plan: ResolvedSearchPlan,
  limits: CandidateLimitConfig,
): CandidateLimitOutcome {
  const checked = checkCandidateSetLimit(candidates, plan, limits);
  if (checked.kind !== "ok") return checked;
  const { totalCount } = checked;

  const requested = plan.plan.output.requestedLimit ?? limits.candidateLimit;
  const displayLimit = Math.min(requested, limits.candidateLimit);
  return {
    kind: "ok",
    candidates: candidates.slice(0, displayLimit),
    totalCount,
    truncated: totalCount > displayLimit,
  };
}
