import {
  type ReportAssistantOutcome,
  reportAssistantOutcomeSchema,
  type ReportAssistantRequest,
  reportAssistantRequestSchema,
} from "@customreport/shared";

import { buildGroundingBundle } from "../domain/context-builder.js";
import type { ClarificationTokenCodec } from "../domain/entity-resolver.types.js";
import type { AiRuntimeResolverPort } from "./ai-runtime.resolver.js";
import {
  type CandidatePreparation,
  prepareReportAssistantCandidates,
} from "./report-assistant.candidate-preparation.js";
import {
  type AnswerPort,
  answerWithCitationRepair,
  type PlannerPort,
  planWithOneRepair,
} from "./report-assistant.orchestration.js";
import {
  type GroundedAnswerInput,
  ReportAssistantProviderError,
} from "./report-assistant.ports.js";
import {
  EMPTY_REPORT_ASSISTANT_TRACE,
  NOOP_REPORT_ASSISTANT_TELEMETRY,
  type ReportAssistantTelemetry,
  type ReportAssistantTrace,
} from "./report-assistant.telemetry.js";
import type { ReportSearchRepository } from "./report-search.repository.js";
import type { SemanticRetrievalService } from "./semantic-retrieval.service.js";

const HTTP_TOO_MANY_REQUESTS = 429;
const MILLISECONDS_PER_SECOND = 1000;

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

const providerUnavailable = (
  error: ReportAssistantProviderError,
): ReportAssistantOutcome =>
  outcome({
    kind: "provider_unavailable",
    ...(error.statusCode === HTTP_TOO_MANY_REQUESTS &&
    error.retryAfterMs !== undefined
      ? {
          rateLimit: {
            retryAfterSeconds: Math.ceil(
              error.retryAfterMs / MILLISECONDS_PER_SECOND,
            ),
          },
        }
      : {}),
  });

type AssistantExecution = Readonly<{
  outcome: ReportAssistantOutcome;
  trace: ReportAssistantTrace;
  model: string;
}>;

type ReadyCandidatePreparation = Extract<
  CandidatePreparation,
  { kind: "ready" }
>;

const complete = (
  result: ReportAssistantOutcome,
  trace: ReportAssistantTrace,
  model: string,
): AssistantExecution => ({ outcome: outcome(result), trace, model });

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
    private readonly runtimeResolver?: AiRuntimeResolverPort,
  ) {}

  async answer(
    request: ReportAssistantRequest,
    actorId: string,
  ): Promise<ReportAssistantOutcome> {
    const startedAt = Date.now();
    try {
      const execution = await this.answerInternal(request, actorId);
      this.recordTelemetry(
        execution.outcome.kind,
        execution.trace,
        execution.model,
        startedAt,
      );
      return execution.outcome;
    } catch (error) {
      if (error instanceof ReportAssistantProviderError && error.retryable) {
        this.recordTelemetry(
          "provider_unavailable",
          EMPTY_REPORT_ASSISTANT_TRACE,
          this.config.model,
          startedAt,
        );
        return providerUnavailable(error);
      }
      this.recordTelemetry(
        "error",
        EMPTY_REPORT_ASSISTANT_TRACE,
        this.config.model,
        startedAt,
      );
      throw error;
    }
  }

  private async answerInternal(
    request: ReportAssistantRequest,
    actorId: string,
  ): Promise<AssistantExecution> {
    const parsedRequest = reportAssistantRequestSchema.parse(request);
    const runtime = this.runtimeResolver
      ? await this.runtimeResolver.resolveActive()
      : undefined;
    if (this.runtimeResolver && !runtime) {
      return complete(
        { kind: "ai_not_configured" },
        EMPTY_REPORT_ASSISTANT_TRACE,
        this.config.model,
      );
    }
    const planner = runtime?.planner ?? this.planner;
    const answerer = runtime?.answerer ?? this.answerer;
    const model = runtime?.model ?? this.config.model;
    const semanticRetrieval =
      runtime?.semanticRetrieval ?? this.semanticRetrieval;
    const planAttempt = await planWithOneRepair(planner, {
      question: parsedRequest.question,
      now: this.clock.now,
      timeZone: this.config.timeZone,
    });
    const plannerRepairCount = Number(planAttempt.repaired);
    if (!planAttempt.parsed.success) {
      return complete(
        { kind: "invalid_plan" },
        { ...EMPTY_REPORT_ASSISTANT_TRACE, plannerRepairCount },
        model,
      );
    }

    const plan = planAttempt.parsed.data;
    const preparation = await prepareReportAssistantCandidates({
      plan,
      actorId,
      resolutionTokens: parsedRequest.resolutionTokens,
      trace: {
        ...EMPTY_REPORT_ASSISTANT_TRACE,
        mode: plan.retrieval.mode,
        plannerRepairCount,
      },
      dependencies: {
        repository: this.repository,
        tokenCodec: this.tokenCodec,
        clock: this.clock,
        semanticRetrieval,
        timeZone: this.config.timeZone,
        candidateLimits: {
          candidateLimit: this.config.candidateLimit,
          exhaustiveLimit: this.config.exhaustiveLimit,
        },
      },
    });
    if (preparation.kind === "terminal") {
      return complete(preparation.outcome, preparation.trace, model);
    }
    return this.answerGroundedCandidates(
      parsedRequest.question,
      preparation,
      answerer,
      model,
    );
  }

  private async answerGroundedCandidates(
    question: string,
    preparation: ReadyCandidatePreparation,
    answerer: AnswerPort,
    model: string,
  ): Promise<AssistantExecution> {
    const grounding = buildGroundingBundle(
      preparation.sorted,
      preparation.plan,
      this.config.contextTokenBudget,
      preparation.limited.candidates,
    );
    const answered = await answerWithCitationRepair(answerer, {
      question,
      grounding: {
        ...grounding,
        truncated: grounding.truncated || preparation.limited.truncated,
      },
    } satisfies GroundedAnswerInput);
    return complete(
      {
        kind: "ok",
        answerMarkdown: answered.answer.answerMarkdown,
        citations: [...answered.citations],
        metadata: {
          truncated: grounding.truncated || preparation.limited.truncated,
          insufficientEvidence: answered.answer.insufficientEvidence,
        },
      },
      {
        ...preparation.trace,
        evidenceCount: grounding.evidence.length,
        citationRepairCount: Number(answered.repaired),
        usage: answered.answer.usage,
      },
      model,
    );
  }

  private recordTelemetry(
    outcomeKind: string,
    trace: ReportAssistantTrace,
    model: string,
    startedAt: number,
  ): void {
    this.telemetry.record({
      outcome: outcomeKind,
      latencyMs: Math.max(0, Date.now() - startedAt),
      model,
      trace,
    });
  }
}
