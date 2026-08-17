import type { Job } from "bullmq";
import type { ClsService } from "nestjs-cls";

import { RawBullMqProcessor } from "../../../infrastructure/bullmq/raw-bullmq-processor.js";
import type { EnvConfig } from "../../../infrastructure/config/env.schema.js";
import type { AppLogger } from "../../../lib/logger.js";
import type { AiPromptService } from "../../ai-prompts/index.js";
import { AiProviderConfigurationService } from "../application/ai-provider.service.js";
import {
  AI_COMPATIBILITY_QUEUE_NAME,
  type AiCompatibilityJobData,
} from "./ai-compatibility.queue.js";
import { AiProviderConfigurationRepository } from "./ai-provider.repository.js";

export class AiCompatibilityProcessor extends RawBullMqProcessor<AiCompatibilityJobData> {
  protected readonly queueName = AI_COMPATIBILITY_QUEUE_NAME;
  protected readonly spanName = "ai-compatibility.execute";

  constructor(
    private readonly repository: AiProviderConfigurationRepository,
    private readonly providerService: AiProviderConfigurationService,
    private readonly promptService: AiPromptService,
    env: EnvConfig,
    logger?: AppLogger,
    cls?: ClsService,
  ) {
    super(env, logger, cls);
  }

  protected override extraWorkerOptions() {
    return { concurrency: 1 };
  }

  protected onJobFailed(
    job: Job<AiCompatibilityJobData> | undefined,
    _error: Error,
  ): void {
    this.logger.error("AI compatibility job failed", {
      executionId: job?.data.executionId,
      failureCode: "ai_compatibility_job_failed",
    });
  }

  protected async processJob(job: Job<AiCompatibilityJobData>): Promise<void> {
    if (!(await this.repository.startExecution(job.data.executionId))) return;
    const execution = await this.repository.getExecution(job.data.executionId);
    if (!execution) return;
    try {
      if (job.data.kind === "prompt_evaluation") {
        if (!execution.promptRevisionId || !execution.featureKey) {
          await this.repository.completeExecution(
            job.data.executionId,
            "configuration_error",
            "execution_identity_invalid",
          );
          return;
        }
        const evaluated = await this.promptService.executeEvaluation(
          {
            featureKey: execution.featureKey as "lead-report-assistant",
            revisionId: execution.promptRevisionId,
          },
          execution.providerRevisionId,
        );
        const checks =
          evaluated.latestEvaluation?.checks.map((check) => ({
            code: check.code,
            outcome:
              check.status === "passed"
                ? "passed"
                : check.status === "inconclusive"
                  ? "inconclusive"
                  : "incompatible",
            passedCount: check.passedCount,
            failedCount: check.failedCount,
          })) ?? [];
        const evaluationOutcome = evaluated.latestEvaluation?.outcome;
        await this.repository.completeExecution(
          job.data.executionId,
          evaluationOutcome === "passed"
            ? "passed"
            : evaluationOutcome === "inconclusive"
              ? "inconclusive"
              : "incompatible",
          null,
          checks,
        );
        return;
      }
      const tested = await this.providerService.executeTest(
        execution.providerRevisionId,
        "worker",
        job.data.executionId,
      );
      const outcome = providerTestOutcome(tested.testResult);
      await this.repository.completeExecution(
        job.data.executionId,
        outcome,
        providerFailureCode(tested.testResult),
        [
          ...(tested.testResult?.generation.capabilities ?? []).map(
            (capability) => ({
              code: `generation.${capability.capability}`,
              outcome: capabilityOutcome(capability.status),
              passedCount: capability.status === "passed" ? 1 : 0,
              failedCount: capability.status === "failed" ? 1 : 0,
            }),
          ),
          ...(tested.testResult?.embeddings.capabilities ?? []).map(
            (capability) => ({
              code: `embeddings.${capability.capability}`,
              outcome: capabilityOutcome(capability.status),
              passedCount: capability.status === "passed" ? 1 : 0,
              failedCount: capability.status === "failed" ? 1 : 0,
            }),
          ),
          ...(tested.testResult?.generation.featureCompatibility ?? []).flatMap(
            (feature) =>
              feature.checks.map((check) => ({
                code: `feature.${feature.featureKey}.${check.code}`,
                outcome: capabilityOutcome(check.status),
                passedCount: check.passedCount,
                failedCount: check.failedCount,
              })),
          ),
        ],
      );
    } catch (error) {
      const classification = classifyFailure(error);
      await this.repository.completeExecution(
        job.data.executionId,
        classification.outcome,
        classification.failureCode,
      );
    }
  }
}
const classifyFailure = (
  error: unknown,
): Readonly<{
  outcome: "incompatible" | "configuration_error" | "inconclusive";
  failureCode: string;
}> => {
  if (isProviderFailure(error)) {
    if (
      error.statusCode === HTTP_UNAUTHORIZED ||
      error.statusCode === HTTP_FORBIDDEN
    ) {
      return {
        outcome: "configuration_error",
        failureCode: "provider_authentication_failed",
      };
    }
    if (error.retryable) {
      return {
        outcome: "inconclusive",
        failureCode: "provider_transient_failure",
      };
    }
  }
  if (
    error instanceof Error &&
    /protocol|schema|shape|invalid/i.test(error.message)
  ) {
    return {
      outcome: "incompatible",
      failureCode: "provider_contract_incompatible",
    };
  }
  return { outcome: "inconclusive", failureCode: "provider_unavailable" };
};

const providerFailureCode = (
  result: Awaited<
    ReturnType<AiProviderConfigurationService["executeTest"]>
  >["testResult"],
): string | null => {
  if (!result) return null;
  return (
    [...result.generation.capabilities, ...result.embeddings.capabilities].find(
      ({ status, failureCode }) =>
        status !== "passed" && failureCode !== undefined,
    )?.failureCode ?? null
  );
};

const capabilityOutcome = (
  status: "passed" | "failed" | "inconclusive",
): "passed" | "incompatible" | "inconclusive" =>
  status === "passed"
    ? "passed"
    : status === "inconclusive"
      ? "inconclusive"
      : "incompatible";

const providerTestOutcome = (
  value: unknown,
): "passed" | "incompatible" | "configuration_error" | "inconclusive" => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "inconclusive";
  }
  const result = value as Record<string, unknown>;
  if (result.status === "passed") return "passed";
  if (result.status === "inconclusive") return "inconclusive";
  const lanes = [result.generation, result.embeddings].flatMap((lane) =>
    lane && typeof lane === "object" && !Array.isArray(lane) ? [lane] : [],
  );
  const authenticationFailed = lanes.some((lane) => {
    const capabilities = (lane as Record<string, unknown>).capabilities;
    return (
      Array.isArray(capabilities) &&
      capabilities.some(
        (capability) =>
          capability &&
          typeof capability === "object" &&
          (capability as Record<string, unknown>).status === "failed" &&
          ((capability as Record<string, unknown>).capability ===
            "authentication" ||
            isAuthenticationFailureCode(
              (capability as Record<string, unknown>).failureCode,
            )),
      )
    );
  });
  return authenticationFailed ? "configuration_error" : "incompatible";
};

const isAuthenticationFailureCode = (value: unknown): boolean =>
  typeof value === "string" &&
  [
    "provider_authentication_failed",
    "invalid_api_key",
    "unauthorized",
    "forbidden",
  ].includes(value.toLowerCase());

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

const isProviderFailure = (
  error: unknown,
): error is Readonly<{
  statusCode: number | undefined;
  retryable: boolean;
}> =>
  typeof error === "object" &&
  error !== null &&
  "statusCode" in error &&
  "retryable" in error;
