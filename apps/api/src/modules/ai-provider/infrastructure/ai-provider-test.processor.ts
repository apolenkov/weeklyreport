import type { Job } from "bullmq";
import type { ClsService } from "nestjs-cls";

import { RawBullMqProcessor } from "../../../infrastructure/bullmq/raw-bullmq-processor.js";
import type { EnvConfig } from "../../../infrastructure/config/env.schema.js";
import type { AppLogger } from "../../../lib/logger.js";
import { AiProviderConfigurationService } from "../application/ai-provider.service.js";
import { AiProviderConfigurationRepository } from "./ai-provider.repository.js";
import {
  AI_PROVIDER_TEST_QUEUE_NAME,
  type AiProviderTestJobData,
} from "./ai-provider-test.queue.js";

export class AiProviderTestProcessor extends RawBullMqProcessor<AiProviderTestJobData> {
  protected readonly queueName = AI_PROVIDER_TEST_QUEUE_NAME;
  protected readonly spanName = "ai-provider-test.execute";

  constructor(
    private readonly repository: AiProviderConfigurationRepository,
    private readonly providerService: AiProviderConfigurationService,
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
    job: Job<AiProviderTestJobData> | undefined,
    _error: Error,
  ): void {
    this.logger.error("AI provider test job failed", {
      executionId: job?.data.executionId,
      failureCode: "ai_provider_test_job_failed",
    });
  }

  protected async processJob(job: Job<AiProviderTestJobData>): Promise<void> {
    if (!(await this.repository.startExecution(job.data.executionId))) return;
    const execution = await this.repository.getExecution(job.data.executionId);
    if (!execution) return;
    try {
      const tested = await this.providerService.executeTest(
        execution.providerRevisionId,
        "worker",
        job.data.executionId,
      );
      await this.repository.completeExecution(
        job.data.executionId,
        providerTestOutcome(tested.testResult),
        providerFailureCode(tested.testResult),
        providerChecks(tested.testResult),
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

const providerChecks = (
  value: Awaited<
    ReturnType<AiProviderConfigurationService["executeTest"]>
  >["testResult"],
) => [
  ...(value?.generation.capabilities ?? []).map((capability) => ({
    code: `generation.${capability.capability}`,
    outcome: capabilityOutcome(capability.status),
    passedCount: capability.status === "passed" ? 1 : 0,
    failedCount: capability.status === "failed" ? 1 : 0,
  })),
  ...(value?.embeddings.capabilities ?? []).map((capability) => ({
    code: `embeddings.${capability.capability}`,
    outcome: capabilityOutcome(capability.status),
    passedCount: capability.status === "passed" ? 1 : 0,
    failedCount: capability.status === "failed" ? 1 : 0,
  })),
];

const providerFailureCode = (
  result: Awaited<
    ReturnType<AiProviderConfigurationService["executeTest"]>
  >["testResult"],
): string | null =>
  result
    ? ([
        ...result.generation.capabilities,
        ...result.embeddings.capabilities,
      ].find(
        ({ status, failureCode }) =>
          status !== "passed" && failureCode !== undefined,
      )?.failureCode ?? null)
    : null;

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
    /protocol|schema|shape|invalid/iu.test(error.message)
  ) {
    return {
      outcome: "incompatible",
      failureCode: "provider_contract_incompatible",
    };
  }
  return { outcome: "inconclusive", failureCode: "provider_unavailable" };
};

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

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
