import type { ReportAssistantOutcome, SearchPlan } from "@weeklyreport/shared";

import {
  type CandidateLimitOutcome,
  checkCandidateSetLimit,
  limitCandidates,
  sortCandidates,
} from "../domain/candidate-filter.js";
import type { ClarificationTokenCodec } from "../domain/entity-resolver.types.js";
import type { SearchCandidate } from "../domain/report-retrieval.types.js";
import {
  semanticCandidates,
  semanticQuery,
} from "./report-assistant.orchestration.js";
import { resolveReportAssistantCandidates } from "./report-assistant.retrieval.js";
import type { ReportAssistantTrace } from "./report-assistant.telemetry.js";
import type { ReportSearchRepository } from "./report-search.repository.js";
import type { SemanticRetrievalService } from "./semantic-retrieval.service.js";

type ResolvedCandidates = Extract<
  Awaited<ReturnType<typeof resolveReportAssistantCandidates>>,
  { kind: "resolved" }
>;

export type CandidatePreparation =
  | Readonly<{
      kind: "ready";
      plan: ResolvedCandidates["plan"];
      sorted: readonly SearchCandidate[];
      limited: Extract<CandidateLimitOutcome, { kind: "ok" }>;
      trace: ReportAssistantTrace;
    }>
  | Readonly<{
      kind: "terminal";
      outcome: ReportAssistantOutcome;
      trace: ReportAssistantTrace;
    }>;

type CandidatePreparationDependencies = Readonly<{
  repository: ReportSearchRepository;
  tokenCodec: ClarificationTokenCodec;
  clock: Readonly<{ now: Date }>;
  semanticRetrieval: SemanticRetrievalService | undefined;
  timeZone: string;
  candidateLimits: Readonly<{
    candidateLimit: number;
    exhaustiveLimit: number;
  }>;
}>;

export type CandidatePreparationInput = Readonly<{
  plan: SearchPlan;
  actorId: string;
  resolutionTokens: readonly string[];
  trace: ReportAssistantTrace;
  signal: AbortSignal;
  dependencies: CandidatePreparationDependencies;
}>;

const emptyCache = {
  hitCount: 0,
  missCount: 0,
  readThrough: false,
} as const;

type RankCandidatesInput = Readonly<{
  plan: SearchPlan;
  resolved: ResolvedCandidates;
  trace: ReportAssistantTrace;
  signal: AbortSignal;
  dependencies: CandidatePreparationDependencies;
}>;

const rankCandidates = async ({
  plan,
  resolved,
  trace,
  signal,
  dependencies,
}: RankCandidatesInput): Promise<CandidatePreparation> => {
  const candidateTrace = {
    ...trace,
    candidateCount: resolved.candidates.length,
  };
  const semantic =
    plan.retrieval.mode === "semantic_ranked"
      ? await semanticCandidates(
          dependencies.semanticRetrieval,
          semanticQuery(plan),
          resolved.candidates,
          signal,
        )
      : {
          kind: "ranked" as const,
          candidates: resolved.candidates,
          scores: new Map<string, number>(),
          cache: emptyCache,
        };
  const cacheTrace = {
    ...candidateTrace,
    cacheHitCount: semantic.cache.hitCount,
    cacheMissCount: semantic.cache.missCount,
    readThrough: semantic.cache.readThrough,
  };
  if (semantic.kind !== "ranked") {
    return {
      kind: "terminal",
      outcome: { kind: semantic.kind },
      trace: cacheTrace,
    };
  }

  const sorted = sortCandidates(
    semantic.candidates,
    plan.retrieval.mode,
    semantic.scores,
  );
  const limited = limitCandidates(
    sorted,
    resolved.plan,
    dependencies.candidateLimits,
  );
  if (limited.kind !== "ok") {
    return {
      kind: "terminal",
      outcome: { kind: limited.kind },
      trace: cacheTrace,
    };
  }
  return {
    kind: "ready",
    plan: resolved.plan,
    sorted,
    limited,
    trace: cacheTrace,
  };
};

export const prepareReportAssistantCandidates = async ({
  plan,
  actorId,
  resolutionTokens,
  trace,
  signal,
  dependencies,
}: CandidatePreparationInput): Promise<CandidatePreparation> => {
  signal.throwIfAborted();
  const resolved = await resolveReportAssistantCandidates(
    dependencies.repository,
    plan,
    {
      actorId,
      resolutionTokens,
      tokenCodec: dependencies.tokenCodec,
      clock: dependencies.clock,
      timeZone: dependencies.timeZone,
    },
  );
  signal.throwIfAborted();
  if (resolved.kind !== "resolved") {
    return {
      kind: "terminal",
      outcome:
        resolved.kind === "clarification_required"
          ? {
              kind: resolved.kind,
              options: [...resolved.options],
              total: resolved.total,
              truncated: resolved.truncated,
            }
          : resolved,
      trace: { ...trace, candidateCount: 0 },
    };
  }
  const sizeCheck = checkCandidateSetLimit(
    resolved.candidates,
    resolved.plan,
    dependencies.candidateLimits,
  );
  if (sizeCheck.kind !== "ok") {
    return {
      kind: "terminal",
      outcome: { kind: sizeCheck.kind },
      trace: { ...trace, candidateCount: sizeCheck.totalCount },
    };
  }
  return rankCandidates({ plan, resolved, trace, signal, dependencies });
};
