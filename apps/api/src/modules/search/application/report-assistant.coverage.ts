import {
  type RecordOmission,
  type RecordOmissionSummary,
  summarizeRecordOmissions,
} from "@weeklyreport/shared";

import {
  type CandidateScope,
  matchesCandidateScope,
  matchesOccurrenceScope,
} from "../domain/candidate-scope.js";
import type {
  ReportOccurrence,
  ResolvedSearchPlan,
  SectionScope,
} from "../domain/report-retrieval.types.js";

type Bucket = RecordOmission["buckets"][number];
type Subject = CandidateScope["context"]["subject"];

const omissionKinds = (plan: ResolvedSearchPlan): readonly Bucket["kind"][] =>
  (["risk", "decision"] as const).filter(
    (kind) =>
      plan.plan.recordKinds.length === 0 ||
      plan.plan.recordKinds.includes(kind),
  );

const coordinates = (
  scope: SectionScope,
  occurrence: ReportOccurrence,
  {
    kind,
    subject,
    stageIds,
  }: {
    readonly kind: Bucket["kind"];
    readonly subject: Subject;
    readonly stageIds: readonly string[];
  },
): CandidateScope => ({
  kind,
  context: {
    authorId: scope.authorId,
    periodId: occurrence.periodId,
    subject,
    stageIds,
    linkedProductIds:
      subject.kind === "activity"
        ? (scope.section.activities
            .find((activity) => activity.activityId === subject.id)
            ?.linkedProducts.map((product) => product.productId) ?? [])
        : [],
  },
});

const admittedBucket = (scope: SectionScope, bucket: Bucket): boolean =>
  scope.visibility === "own" ||
  (bucket.parentKind === "product" &&
    scope.sharedProductIds.includes(bucket.parentId));

// Legacy metadata cannot prove a count or a stage absence. Only a provably
// empty authorized corpus can turn that unknown into known zero.
function legacyScopeCanMatch(
  scope: SectionScope,
  occurrence: ReportOccurrence,
  plan: ResolvedSearchPlan,
): boolean {
  const kinds = omissionKinds(plan);
  if (kinds.length === 0) return false;
  const hasReferences =
    plan.productIds.length > 0 || plan.activityIds.length > 0;
  if (scope.visibility === "own" && !hasReferences) {
    const parents = plan.plan.subjects.parentKinds;
    return (
      parents.length === 0 ||
      parents.includes("product") ||
      plan.stageIds.length === 0
    );
  }
  const productIds =
    scope.visibility === "own" ? plan.productIds : scope.sharedProductIds;
  const activityIds =
    scope.visibility === "own"
      ? [
          ...new Set([
            ...plan.activityIds,
            ...scope.section.activities.map((activity) => activity.activityId),
          ]),
        ]
      : [];
  const subjects: readonly Subject[] = [
    ...productIds.map((id) => ({ kind: "product" as const, id })),
    ...activityIds.map((id) => ({ kind: "activity" as const, id })),
  ];
  return subjects.some((subject) =>
    kinds.some((kind) =>
      matchesCandidateScope(
        coordinates(scope, occurrence, {
          kind,
          subject,
          stageIds: subject.kind === "product" ? plan.stageIds : [],
        }),
        plan,
      ),
    ),
  );
}

/** Counts the resolved corpus before text matching, ranking or truncation. */
export function summarizeAssistantCoverage(
  plan: ResolvedSearchPlan,
): RecordOmissionSummary {
  const occurrences = new Map(
    plan.occurrences.map((occurrence) => [occurrence.reportId, occurrence]),
  );
  const selected = plan.sectionScopes.flatMap(
    (scope): (RecordOmission | undefined)[] => {
      const occurrence = occurrences.get(scope.reportId);
      if (
        !occurrence ||
        !matchesOccurrenceScope(scope.authorId, occurrence.periodId, plan)
      )
        return [];
      const omission = occurrence.recordOmissions?.get(scope.sectionId);
      if (!omission)
        return legacyScopeCanMatch(scope, occurrence, plan) ? [undefined] : [];
      return [
        {
          ...omission,
          buckets: omission.buckets.filter(
            (bucket) =>
              admittedBucket(scope, bucket) &&
              matchesCandidateScope(
                coordinates(scope, occurrence, {
                  kind: bucket.kind,
                  subject: { kind: bucket.parentKind, id: bucket.parentId },
                  stageIds: bucket.stageNames,
                }),
                plan,
              ),
          ),
        },
      ];
    },
  );
  return summarizeRecordOmissions(selected);
}
