import {
  type ReportAssistantOutcome,
  reportAssistantOutcomeSchema,
  type ReportAssistantRequest,
  reportAssistantRequestSchema,
} from "@customreport/shared";

import { limitCandidates, sortCandidates } from "../domain/candidate-filter.js";
import { buildGroundingBundle } from "../domain/context-builder.js";
import type { ClarificationTokenCodec } from "../domain/entity-resolver.types.js";
import {
  type AnswerPort,
  answerWithCitationRepair,
  type PlannerPort,
  planWithOneRepair,
  semanticCandidates,
  semanticQuery,
} from "./report-assistant.orchestration.js";
import {
  type GroundedAnswerInput,
  ReportAssistantProviderError,
} from "./report-assistant.ports.js";
import { resolveReportAssistantCandidates } from "./report-assistant.retrieval.js";
import {
  EMPTY_REPORT_ASSISTANT_TRACE,
  NOOP_REPORT_ASSISTANT_TELEMETRY,
  type ReportAssistantTelemetry,
  type ReportAssistantTrace,
} from "./report-assistant.telemetry.js";
import type { ReportSearchRepository } from "./report-search.repository.js";
import type { SemanticRetrievalService } from "./semantic-retrieval.service.js";

export type ReportAssistantConfig = Readonly<{
  candidateLimit: number;
  exhaustiveLimit: number;
  contextTokenBudget: number;
  model: string;
  timeZone: string;
}>;

export type ReportAssistantClock = Readonly<{ now: Date }>;

const outcome = (value: ReportAssistantOutcome): ReportAssistantOutcome =>
  reportAssistantOutcomeSchema.parse(value);

type AssistantExecution = Readonly<{
  outcome: ReportAssistantOutcome;
  trace: ReportAssistantTrace;
}>;

const complete = (
  result: ReportAssistantOutcome,
  trace: ReportAssistantTrace,
): AssistantExecution => ({ outcome: outcome(result), trace });

const emptyCache = {
  hitCount: 0,
  missCount: 0,
  readThrough: false,
} as const;

export class ReportAssistantService {
  constructor(
    private readonly repository: ReportSearchRepository,
    private readonly planner: PlannerPort,
    private readonly answerer: AnswerPort,
    private readonly tokenCodec: ClarificationTokenCodec,
    private readonly config: ReportAssistantConfig,
    private readonly clock: ReportAssistantClock,
    private readonly semanticRetrieval?: SemanticRetrievalService,
    private readonly telemetry: ReportAssistantTelemetry = NOOP_REPORT_ASSISTANT_TELEMETRY,
  ) {}

  async answer(
    request: ReportAssistantRequest,
    actorId: string,
  ): Promise<ReportAssistantOutcome> {
    const startedAt = Date.now();
    try {
      const execution = await this.answerInternal(request, actorId);
      this.recordTelemetry(execution.outcome.kind, execution.trace, startedAt);
      return execution.outcome;
    } catch (error) {
      if (error instanceof ReportAssistantProviderError && error.retryable) {
        this.recordTelemetry(
          "provider_unavailable",
          EMPTY_REPORT_ASSISTANT_TRACE,
          startedAt,
        );
        return outcome({ kind: "provider_unavailable" });
      }
      this.recordTelemetry("error", EMPTY_REPORT_ASSISTANT_TRACE, startedAt);
      throw error;
    }
  }

  private async answerInternal(
    request: ReportAssistantRequest,
    actorId: string,
  ): Promise<AssistantExecution> {
    const parsedRequest = reportAssistantRequestSchema.parse(request);
    const planAttempt = await planWithOneRepair(this.planner, {
      question: parsedRequest.question,
      now: this.clock.now,
      timeZone: this.config.timeZone,
    });
    const plannerRepairCount = Number(planAttempt.repaired);
    if (!planAttempt.parsed.success) {
      return complete(
        { kind: "invalid_plan" },
        { ...EMPTY_REPORT_ASSISTANT_TRACE, plannerRepairCount },
      );
    }

    const plan = planAttempt.parsed.data;
    const trace = {
      ...EMPTY_REPORT_ASSISTANT_TRACE,
      mode: plan.retrieval.mode,
      plannerRepairCount,
    } as const;
    const resolved = await resolveReportAssistantCandidates(
      this.repository,
      plan,
      actorId,
      parsedRequest.resolutionTokens,
      this.tokenCodec,
      this.clock,
      this.config.timeZone,
    );
    if (resolved.kind !== "resolved") {
      return complete(
        resolved.kind === "clarification_required"
          ? { kind: resolved.kind, options: [...resolved.options] }
          : resolved,
        { ...trace, candidateCount: 0 },
      );
    }

    const candidateTrace = {
      ...trace,
      candidateCount: resolved.candidates.length,
    };
    const semantic =
      plan.retrieval.mode === "semantic_ranked"
        ? await semanticCandidates(
            this.semanticRetrieval,
            semanticQuery(plan),
            resolved.candidates,
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
      return complete({ kind: semantic.kind }, cacheTrace);
    }

    const sorted = sortCandidates(
      semantic.candidates,
      plan.retrieval.mode,
      semantic.scores,
    );
    const limited = limitCandidates(sorted, resolved.plan, this.config);
    if (limited.kind === "result_set_too_large") {
      return complete({ kind: limited.kind }, cacheTrace);
    }

    const grounding = buildGroundingBundle(
      sorted,
      resolved.plan,
      this.config.contextTokenBudget,
      limited.candidates,
    );
    const answered = await answerWithCitationRepair(this.answerer, {
      question: parsedRequest.question,
      grounding: {
        ...grounding,
        truncated: grounding.truncated || limited.truncated,
      },
    } satisfies GroundedAnswerInput);
    return complete(
      {
        kind: "ok",
        answerMarkdown: answered.answer.answerMarkdown,
        citations: [...answered.citations],
        metadata: {
          truncated: grounding.truncated || limited.truncated,
          insufficientEvidence: answered.answer.insufficientEvidence,
        },
      },
      {
        ...cacheTrace,
        evidenceCount: grounding.evidence.length,
        citationRepairCount: Number(answered.repaired),
        usage: answered.answer.usage,
      },
    );
  }

  private recordTelemetry(
    outcomeKind: string,
    trace: ReportAssistantTrace,
    startedAt: number,
  ): void {
    this.telemetry.record({
      outcome: outcomeKind,
      latencyMs: Math.max(0, Date.now() - startedAt),
      model: this.config.model,
      trace,
    });
  }
}
