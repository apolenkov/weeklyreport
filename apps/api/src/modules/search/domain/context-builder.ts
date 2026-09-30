import type { CanonicalStatus, SourceCitation } from "@customreport/shared";

import {
  buildGroundingAggregates,
  type GroundingAggregates,
  type GroundingClassificationContext,
  type SupportingStatusFact,
} from "./grounding-aggregates.js";
import { type GroundingRecord, groundingRecord } from "./grounding-record.js";
import type {
  ResolvedSearchPlan,
  SearchCandidate,
} from "./report-retrieval.types.js";

const CHARS_PER_ESTIMATED_TOKEN = 4;
const FIRST_SOURCE_NUMBER = 1;

type GroundingEvidence = Readonly<{
  source: SourceCitation;
  record: GroundingRecord;
  role: "primary" | "supporting_status";
}>;

export type GroundingBundle = Readonly<{
  aggregates: GroundingAggregates;
  evidence: readonly GroundingEvidence[];
  truncated: boolean;
  estimatedTokens: number;
}>;

type PromptSource = Omit<SourceCitation, "reportId">;

export type GroundingPromptData = Readonly<{
  aggregates: GroundingAggregates;
  evidence: readonly Readonly<{
    source: PromptSource;
    record: GroundingRecord;
    role: GroundingEvidence["role"];
  }>[];
  truncated: boolean;
}>;

type StatusCandidate = SearchCandidate & Readonly<{ status: CanonicalStatus }>;

const isStatusCandidate = (
  candidate: SearchCandidate,
): candidate is StatusCandidate => candidate.kind.endsWith("_status");

const isPrimaryCandidate = (candidate: SearchCandidate): boolean =>
  candidate.kind === "item" ||
  candidate.kind === "risk" ||
  candidate.kind === "decision" ||
  (candidate.kind === "activity_status" && candidate.note !== null);

const statusFact = (candidate: SearchCandidate): SupportingStatusFact => ({
  subjectKind: candidate.context.subject.kind,
  subjectName: candidate.context.subject.name,
  status: isStatusCandidate(candidate) ? candidate.status : "empty",
  stages: candidate.context.stageIds,
});

const sourceCitation = (
  sourceId: string,
  candidate: SearchCandidate,
): SourceCitation => ({
  sourceId,
  reportId: candidate.context.reportId,
  periodLabel: candidate.context.periodLabel,
  authorName: candidate.context.authorName,
  subjectName: candidate.context.subject.name,
  recordKind: candidate.kind,
});

const supportsSubject = (
  record: SearchCandidate,
  status: SearchCandidate,
): boolean => {
  if (!isStatusCandidate(status)) return false;
  if (
    record.context.subject.kind !== status.context.subject.kind ||
    record.context.subject.id !== status.context.subject.id
  ) {
    return false;
  }
  if (status.kind !== "stage_status") return true;
  return status.context.stageIds.some((stage) =>
    record.context.stageIds.includes(stage),
  );
};

type EvidenceBudget = Readonly<{
  evidence: readonly GroundingEvidence[];
  acceptedCandidates: readonly SearchCandidate[];
  omittedCount: number;
}>;

const promptSource = ({ reportId: _reportId, ...source }: SourceCitation) =>
  source;

export const groundingPromptData = (
  bundle: Omit<GroundingBundle, "estimatedTokens">,
): GroundingPromptData => ({
  aggregates: bundle.aggregates,
  evidence: bundle.evidence.map(({ source, record, role }) => ({
    source: promptSource(source),
    record,
    role,
  })),
  truncated: bundle.truncated,
});

const estimatedPromptTokens = (
  bundle: Omit<GroundingBundle, "estimatedTokens">,
): number =>
  Math.max(
    1,
    Math.ceil(
      JSON.stringify(groundingPromptData(bundle)).length /
        CHARS_PER_ESTIMATED_TOKEN,
    ),
  );

const uniqueStatusFacts = (
  candidates: readonly SearchCandidate[],
): readonly SupportingStatusFact[] =>
  candidates
    .filter(isStatusCandidate)
    .map(statusFact)
    .filter(
      (fact, index, facts) =>
        facts.findIndex(
          (candidate) => JSON.stringify(candidate) === JSON.stringify(fact),
        ) === index,
    );

const bundleShape = (
  aggregates: GroundingAggregates,
  evidence: readonly GroundingEvidence[],
  acceptedCandidates: readonly SearchCandidate[],
  truncated: boolean,
): Omit<GroundingBundle, "estimatedTokens"> => ({
  aggregates: {
    ...aggregates,
    supportingStatusFacts: uniqueStatusFacts(
      acceptedCandidates.flatMap((candidate) =>
        acceptedCandidates.filter((status) =>
          supportsSubject(candidate, status),
        ),
      ),
    ),
  },
  evidence,
  truncated,
});

const budgetEvidence = (
  candidates: readonly SearchCandidate[],
  aggregates: GroundingAggregates,
  tokenBudget: number,
): EvidenceBudget =>
  candidates.reduce<EvidenceBudget>(
    (budget, candidate) => {
      const sourceId = `S${budget.evidence.length + FIRST_SOURCE_NUMBER}`;
      const evidence = [
        ...budget.evidence,
        {
          source: sourceCitation(sourceId, candidate),
          record: groundingRecord(candidate),
          role: isPrimaryCandidate(candidate)
            ? ("primary" as const)
            : ("supporting_status" as const),
        },
      ];
      const acceptedCandidates = [...budget.acceptedCandidates, candidate];
      const tentative = bundleShape(
        aggregates,
        evidence,
        acceptedCandidates,
        false,
      );
      return estimatedPromptTokens(tentative) <= tokenBudget
        ? {
            evidence,
            acceptedCandidates,
            omittedCount: budget.omittedCount,
          }
        : { ...budget, omittedCount: budget.omittedCount + 1 };
    },
    { evidence: [], acceptedCandidates: [], omittedCount: 0 },
  );

export function buildGroundingBundle(
  candidates: readonly SearchCandidate[],
  plan: ResolvedSearchPlan,
  options: Readonly<{
    contextTokenBudget: number;
    classificationContext: GroundingClassificationContext;
    evidenceCandidates?: readonly SearchCandidate[];
  }>,
): GroundingBundle {
  const {
    contextTokenBudget,
    classificationContext,
    evidenceCandidates = candidates,
  } = options;
  const aggregates = buildGroundingAggregates(
    candidates,
    plan,
    classificationContext,
  );
  const budget = budgetEvidence(
    evidenceCandidates,
    aggregates,
    contextTokenBudget,
  );
  const shape = bundleShape(
    aggregates,
    budget.evidence,
    budget.acceptedCandidates,
    budget.omittedCount > 0 || evidenceCandidates.length < candidates.length,
  );
  return {
    ...shape,
    estimatedTokens: estimatedPromptTokens(shape),
  };
}
