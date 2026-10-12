import {
  type SearchPlan,
  searchPlanSchema,
  type SourceCitation,
} from "@weeklyreport/shared";

import { validateGroundedAnswerCitations } from "../domain/citation-validator.js";
import type { SearchCandidate } from "../domain/report-retrieval.types.js";
import type {
  GroundedAnswer,
  GroundedAnswerInput,
  PlannerInput,
  PlannerRepairInput,
  ReportAssistantAnswerPort,
  ReportAssistantCitationRepairPort,
  ReportAssistantPlannerPort,
  ReportAssistantPlannerRepairPort,
} from "./report-assistant.ports.js";
import type { SemanticRetrievalService } from "./semantic-retrieval.service.js";

export type PlannerPort = ReportAssistantPlannerPort &
  Partial<ReportAssistantPlannerRepairPort>;
export type AnswerPort = ReportAssistantAnswerPort &
  Partial<ReportAssistantCitationRepairPort>;

type ParsedPlan = ReturnType<typeof searchPlanSchema.safeParse>;

export type PlanAttempt = Readonly<{
  parsed: ParsedPlan;
  repaired: boolean;
}>;

export const planWithOneRepair = async (
  planner: PlannerPort,
  input: PlannerInput,
  signal?: AbortSignal,
): Promise<PlanAttempt> => {
  signal?.throwIfAborted();
  const rawPlan = await planner.plan(input, signal);
  signal?.throwIfAborted();
  const parsedPlan = searchPlanSchema.safeParse(rawPlan);
  if (parsedPlan.success || !planner.repairPlan) {
    return { parsed: parsedPlan, repaired: false };
  }
  const repairInput: PlannerRepairInput = {
    original: input,
    previousArguments: rawPlan,
    issues: parsedPlan.error.issues.map(({ path, code }) => ({
      path: path.filter(
        (part): part is string | number =>
          typeof part === "string" || typeof part === "number",
      ),
      code,
    })),
  };
  return {
    parsed: searchPlanSchema.safeParse(
      await planner.repairPlan(repairInput, signal),
    ),
    repaired: true,
  };
};

type SemanticCache = Readonly<{
  hitCount: number;
  missCount: number;
  readThrough: boolean;
}>;

export const semanticCandidates = async (
  retrieval: SemanticRetrievalService | undefined,
  query: string,
  candidates: readonly SearchCandidate[],
  signal?: AbortSignal,
): Promise<
  | Readonly<{
      kind: "ranked";
      candidates: readonly SearchCandidate[];
      scores: ReadonlyMap<string, number>;
      cache: SemanticCache;
    }>
  | Readonly<{ kind: "semantic_index_pending"; cache: SemanticCache }>
  | Readonly<{ kind: "no_results"; cache: SemanticCache }>
> => {
  if (!retrieval) throw new Error("Semantic retrieval is not configured");
  signal?.throwIfAborted();
  const result = await retrieval.retrieve(query, candidates, signal);
  signal?.throwIfAborted();
  if (result.kind !== "ranked") {
    return { kind: result.kind, cache: result.cache };
  }
  return {
    kind: "ranked",
    candidates: result.candidates.map(({ candidate }) => candidate),
    scores: new Map(
      result.candidates.map(({ candidate, similarity }) => [
        candidate.identity.occurrenceId,
        similarity,
      ]),
    ),
    cache: result.cache,
  };
};

export type AnswerAttempt = Readonly<{
  answer: GroundedAnswer;
  citations: readonly SourceCitation[];
  repaired: boolean;
}>;

export const answerWithCitationRepair = async (
  answerer: AnswerPort,
  input: GroundedAnswerInput,
  signal?: AbortSignal,
): Promise<AnswerAttempt> => {
  signal?.throwIfAborted();
  const answer = await answerer.answer(input, signal);
  signal?.throwIfAborted();
  const validation = validateGroundedAnswerCitations(answer, input.grounding);
  if (validation.kind === "valid") {
    return { answer, citations: validation.citations, repaired: false };
  }
  if (!answerer.repairAnswer) {
    throw new Error("Grounded answer citation repair is not configured");
  }
  const repaired = await answerer.repairAnswer(
    {
      original: input,
      previousAnswer: answer,
      allowedSourceIds: input.grounding.evidence.map(
        ({ source }) => source.sourceId,
      ),
      issues: validation.issues,
    },
    signal,
  );
  signal?.throwIfAborted();
  const repairedValidation = validateGroundedAnswerCitations(
    repaired,
    input.grounding,
  );
  if (repairedValidation.kind !== "valid") {
    throw new Error("Grounded answer citation repair failed");
  }
  return {
    answer: repaired,
    citations: repairedValidation.citations,
    repaired: true,
  };
};

export const semanticQuery = (plan: SearchPlan): string => {
  if (plan.retrieval.semanticQuery === null) {
    throw new Error("Semantic retrieval requires a semantic query");
  }
  return plan.retrieval.semanticQuery;
};
