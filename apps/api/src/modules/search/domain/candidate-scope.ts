import { normalizeEntityReference } from "./entity-alias-index.js";
import type {
  CandidateContext,
  ResolvedSearchPlan,
  SearchCandidate,
} from "./report-retrieval.types.js";

/** Corpus coordinates shared by complete candidates and private omission counts. */
export type CandidateScope = Readonly<{
  kind: SearchCandidate["kind"];
  context: Pick<
    CandidateContext,
    "authorId" | "periodId" | "stageIds" | "linkedProductIds"
  > &
    Readonly<{
      subject: Pick<CandidateContext["subject"], "kind" | "id">;
    }>;
}>;

const includesNormalized = (
  values: readonly string[],
  candidate: string,
): boolean =>
  values.some(
    (value) =>
      normalizeEntityReference(value) === normalizeEntityReference(candidate),
  );

const matchesSubject = (
  candidate: CandidateScope,
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
  candidate: CandidateScope,
  plan: ResolvedSearchPlan,
): boolean =>
  plan.stageIds.length === 0 ||
  plan.stageIds.some((stage) =>
    includesNormalized(candidate.context.stageIds, stage),
  );

export const matchesOccurrenceScope = (
  authorId: string,
  periodId: string,
  plan: ResolvedSearchPlan,
): boolean =>
  plan.authorIds.includes(authorId) &&
  (plan.periodIds.length === 0 || plan.periodIds.includes(periodId));

const matchesRecordKind = (
  candidate: CandidateScope,
  plan: ResolvedSearchPlan,
): boolean =>
  plan.plan.recordKinds.length === 0 ||
  plan.plan.recordKinds.includes(candidate.kind);

export function matchesCandidateScope(
  candidate: CandidateScope,
  plan: ResolvedSearchPlan,
): boolean {
  return (
    matchesOccurrenceScope(
      candidate.context.authorId,
      candidate.context.periodId,
      plan,
    ) &&
    matchesSubject(candidate, plan) &&
    matchesStages(candidate, plan) &&
    matchesRecordKind(candidate, plan)
  );
}
