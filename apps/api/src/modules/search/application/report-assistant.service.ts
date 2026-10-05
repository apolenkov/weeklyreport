import {
  type ReportAssistantOutcome,
  reportAssistantOutcomeSchema,
  type ReportAssistantRequest,
  reportAssistantRequestSchema,
} from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";

import { ENV_CONFIG } from "../../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../../infrastructure/config/env.schema.js";
import { ReportAssistantResourceGuard } from "../../../infrastructure/throttler/report-assistant-resource-guard.js";
import { buildGroundingBundle } from "../domain/context-builder.js";
import type { ClarificationTokenCodec } from "../domain/entity-resolver.types.js";
import { ReportSearchPrismaRepository } from "../infrastructure/report-search.prisma-repository.js";
import {
  AiRuntimeResolver,
  type AiRuntimeResolverPort,
} from "./ai-runtime.resolver.js";
import { createClarificationTokenCodec } from "./clarification-token.js";
import {
  type CandidatePreparation,
  prepareReportAssistantCandidates,
} from "./report-assistant.candidate-preparation.js";
import {
  type AnswerPort,
  answerWithCitationRepair,
  planWithOneRepair,
} from "./report-assistant.orchestration.js";
import {
  type GroundedAnswerInput,
  type ReportAssistantResourceGuardPort,
} from "./report-assistant.ports.js";
import {
  createReportAssistantClock,
  failureOutcome,
  type ReportAssistantClock,
  type ReportAssistantConfig,
  resolveReportAssistantTimeZone,
} from "./report-assistant.runtime.js";
import {
  EMPTY_REPORT_ASSISTANT_TRACE,
  NOOP_REPORT_ASSISTANT_TELEMETRY,
  REPORT_ASSISTANT_TELEMETRY,
  type ReportAssistantTelemetry,
  type ReportAssistantTrace,
} from "./report-assistant.telemetry.js";
import type { ReportSearchRepository } from "./report-search.repository.js";

// The Lead gets an answer or a clear outcome inside this bound, whatever the
// per-call provider timeout allows (planner + answer + repairs add up).
export const REPORT_ASSISTANT_REQUEST_DEADLINE_MS = 12_000;

const outcome = (value: ReportAssistantOutcome): ReportAssistantOutcome =>
  reportAssistantOutcomeSchema.parse(value);

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

@Injectable()
export class ReportAssistantService {
  private readonly tokenCodec: ClarificationTokenCodec;
  private readonly config: ReportAssistantConfig;
  private readonly clock: ReportAssistantClock;

  constructor(
    @Inject(ReportSearchPrismaRepository)
    private readonly repository: ReportSearchRepository,
    @Inject(REPORT_ASSISTANT_TELEMETRY)
    private readonly telemetry: ReportAssistantTelemetry = NOOP_REPORT_ASSISTANT_TELEMETRY,
    @Inject(AiRuntimeResolver)
    private readonly runtimeResolver: AiRuntimeResolverPort,
    @Inject(ENV_CONFIG)
    env: Pick<
      EnvConfig,
      | "AUTH_JWT_SECRET"
      | "REPORT_ASSISTANT_CANDIDATE_LIMIT"
      | "REPORT_ASSISTANT_EXHAUSTIVE_LIMIT"
      | "REPORT_ASSISTANT_CONTEXT_TOKEN_BUDGET"
    >,
    @Inject(ReportAssistantResourceGuard)
    private readonly resourceGuard: ReportAssistantResourceGuardPort,
  ) {
    this.tokenCodec = createClarificationTokenCodec({
      AUTH_JWT_SECRET: env.AUTH_JWT_SECRET,
    });
    this.config = {
      candidateLimit: env.REPORT_ASSISTANT_CANDIDATE_LIMIT,
      exhaustiveLimit: env.REPORT_ASSISTANT_EXHAUSTIVE_LIMIT,
      contextTokenBudget: env.REPORT_ASSISTANT_CONTEXT_TOKEN_BUDGET,
      model: "active-provider",
      timeZone: resolveReportAssistantTimeZone(),
    };
    this.clock = createReportAssistantClock();
  }

  async answer(
    request: ReportAssistantRequest,
    actorId: string,
  ): Promise<ReportAssistantOutcome> {
    const startedAt = Date.now();
    const resource = await this.resourceGuard.acquire(actorId);
    if (resource.kind === "denied") {
      return outcome({
        kind: "resource_limited",
        retryAfterSeconds: resource.retryAfterSeconds,
      });
    }
    const deadline = new AbortController();
    const deadlineTimer = setTimeout(
      () => deadline.abort(),
      REPORT_ASSISTANT_REQUEST_DEADLINE_MS,
    );
    try {
      const execution = await this.answerInternal(
        request,
        actorId,
        AbortSignal.any([resource.lease.signal, deadline.signal]),
      );
      resource.lease.signal.throwIfAborted();
      this.recordTelemetry(
        execution.outcome.kind,
        execution.trace,
        execution.model,
        startedAt,
      );
      return execution.outcome;
    } catch (error) {
      const failure = failureOutcome(error, {
        lease: resource.lease.signal,
        deadline: deadline.signal,
      });
      if (failure) {
        this.recordTelemetry(
          failure.kind,
          EMPTY_REPORT_ASSISTANT_TRACE,
          this.config.model,
          startedAt,
        );
        return failure;
      }
      this.recordTelemetry(
        "error",
        EMPTY_REPORT_ASSISTANT_TRACE,
        this.config.model,
        startedAt,
      );
      throw error;
    } finally {
      clearTimeout(deadlineTimer);
      await resource.lease.release();
    }
  }

  private async answerInternal(
    request: ReportAssistantRequest,
    actorId: string,
    signal: AbortSignal,
  ): Promise<AssistantExecution> {
    signal.throwIfAborted();
    const parsedRequest = reportAssistantRequestSchema.parse(request);
    const runtime = await this.runtimeResolver.resolveActive();
    signal.throwIfAborted();
    if (!runtime) {
      return complete(
        { kind: "ai_not_configured" },
        EMPTY_REPORT_ASSISTANT_TRACE,
        this.config.model,
      );
    }
    const { planner, answerer, model, semanticRetrieval } = runtime;
    const planAttempt = await planWithOneRepair(
      planner,
      {
        question: parsedRequest.question,
        now: this.clock.now,
        timeZone: this.config.timeZone,
      },
      signal,
    );
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
      signal,
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
    return this.answerGroundedCandidates(parsedRequest.question, preparation, {
      answerer,
      model,
      signal,
    });
  }

  private async answerGroundedCandidates(
    question: string,
    preparation: ReadyCandidatePreparation,
    {
      answerer,
      model,
      signal,
    }: Readonly<{
      answerer: AnswerPort;
      model: string;
      signal: AbortSignal;
    }>,
  ): Promise<AssistantExecution> {
    signal.throwIfAborted();
    const grounding = buildGroundingBundle(
      preparation.sorted,
      preparation.plan,
      {
        contextTokenBudget: this.config.contextTokenBudget,
        classificationContext: {
          now: this.clock.now,
          timeZone: this.config.timeZone,
        },
        evidenceCandidates: preparation.limited.candidates,
      },
    );
    const answered = await answerWithCitationRepair(
      answerer,
      {
        question,
        grounding: {
          ...grounding,
          truncated: grounding.truncated || preparation.limited.truncated,
        },
      } satisfies GroundedAnswerInput,
      signal,
    );
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
