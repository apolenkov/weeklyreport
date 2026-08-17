import type { JobEnqueuer } from "../../../infrastructure/bullmq/job-enqueuer.js";

export const AI_COMPATIBILITY_QUEUE_NAME = "ai-compatibility" as const;
export const AI_PROVIDER_EVALUATOR_VERSION = "provider-compatibility-v7";

export type AiCompatibilityJobData = Readonly<{
  traceId: string;
  correlationId?: string;
  traceparent?: string;
  tracestate?: string;
  executionId: string;
  kind: "provider_test" | "prompt_evaluation";
}>;

export type AiCompatibilityEnqueuer = Readonly<{
  enqueue(job: AiCompatibilityJobData): Promise<void>;
}>;

export class AiCompatibilityBullmqEnqueuer implements AiCompatibilityEnqueuer {
  constructor(private readonly queue: JobEnqueuer) {}

  async enqueue(job: AiCompatibilityJobData): Promise<void> {
    await this.queue.add("execute", job, {
      jobId: job.executionId,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    });
  }
}
