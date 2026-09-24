import type { Job } from "bullmq";
import type { ClsService } from "nestjs-cls";

import { RawBullMqProcessor } from "../../../infrastructure/bullmq/raw-bullmq-processor.js";
import type { WorkerLivenessRegistry } from "../../../infrastructure/bullmq/worker-liveness.registry.js";
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
    logger: AppLogger,
    cls: ClsService | null,
    workerLiveness?: WorkerLivenessRegistry,
  ) {
    super(env, logger, cls, workerLiveness);
  }

  protected override readonly extraWorkerOptions = () => ({ concurrency: 1 });

  protected readonly onJobFailed = async (
    job: Job<AiProviderTestJobData> | undefined,
    _error: Error,
  ): Promise<void> => {
    this.logger.error("AI provider test job failed", {
      executionId: job?.data.executionId,
      failureCode: AI_PROVIDER_TEST_JOB_FAILED,
    });
    if (!job) return;
    const { executionId } = job.data;
    // The enqueuer sets the BullMQ job id to the execution id, so a mismatched
    // or empty identity marks a stale/foreign delivery that must not write.
    if (!executionId || job.id !== executionId) return;
    // The durable claim identity is attemptsStarted; attemptsMade only decides
    // whether the retry budget is exhausted and this failure is terminal. A
    // counter BullMQ never produced cannot prove exhaustion.
    const executionAttempt = job.attemptsStarted;
    if (!Number.isSafeInteger(executionAttempt) || executionAttempt < 1) return;
    if (
      !Number.isSafeInteger(job.attemptsMade) ||
      job.attemptsMade < (job.opts.attempts ?? 1)
    ) {
      return;
    }
    try {
      await this.completeClaimedExecution(
        executionId,
        "inconclusive",
        AI_PROVIDER_TEST_JOB_FAILED,
        [],
        executionAttempt,
      );
    } catch {
      // A rejected terminal write leaves the row running for the manual queue
      // retry; log fixed identity fields only — error payloads can carry
      // provider credentials.
      this.logger.error("AI provider test execution terminal write failed", {
        executionId,
        executionAttempt,
        failureCode: AI_PROVIDER_TEST_JOB_FAILED,
      });
    }
  };

  protected readonly processJob = async (
    job: Job<AiProviderTestJobData>,
  ): Promise<void> => {
    const executionAttempt = job.attemptsStarted;
    if (!Number.isSafeInteger(executionAttempt) || executionAttempt < 1) {
      throw new Error("AI provider test job has no processing attempt");
    }
    if (
      !(await this.repository.startExecution(
        job.data.executionId,
        executionAttempt,
      ))
    ) {
      return;
    }
    const execution = await this.repository.getExecution(job.data.executionId);
    if (!execution) return;
    try {
      await this.providerService.executeTest(
        execution.providerRevisionId,
        "worker",
        { id: job.data.executionId, attempt: executionAttempt },
      );
    } catch (error) {
      const classification = classifyFailure(error);
      await this.completeClaimedExecution(
        job.data.executionId,
        classification.outcome,
        classification.failureCode,
        [],
        executionAttempt,
      );
    }
  };

  private readonly completeClaimedExecution = async (
    executionId: string,
    outcome: "passed" | "incompatible" | "configuration_error" | "inconclusive",
    failureCode: string | null,
    checks: Parameters<
      AiProviderConfigurationRepository["completeExecution"]
    >[3],
    executionAttempt: number,
  ): Promise<void> => {
    const completed = await this.repository.completeExecution(
      executionId,
      outcome,
      failureCode,
      checks,
      executionAttempt,
    );
    if (completed) return;
    this.logger.warn("AI provider test execution claim was superseded", {
      executionId,
      executionAttempt,
    });
  };
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
const AI_PROVIDER_TEST_JOB_FAILED = "ai_provider_test_job_failed";
