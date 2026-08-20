import type { JobEnqueuer } from "../../../infrastructure/bullmq/job-enqueuer.js";

export const AI_PROVIDER_TEST_QUEUE_NAME = "ai-provider-test" as const;
export const AI_PROVIDER_TEST_ENQUEUER = "AI_PROVIDER_TEST_ENQUEUER" as const;
export const AI_PROVIDER_TEST_SUITE_VERSION = "provider-test-v8";

export type AiProviderTestJobData = Readonly<{
  traceId: string;
  correlationId?: string;
  traceparent?: string;
  tracestate?: string;
  executionId: string;
}>;

export type AiProviderTestEnqueuer = Readonly<{
  enqueue(job: AiProviderTestJobData): Promise<void>;
}>;

export class AiProviderTestBullmqEnqueuer implements AiProviderTestEnqueuer {
  constructor(private readonly queue: JobEnqueuer) {}

  async enqueue(job: AiProviderTestJobData): Promise<void> {
    await this.queue.add("execute", job, {
      jobId: job.executionId,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    });
  }
}
