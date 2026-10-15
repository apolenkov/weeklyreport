import { AI_PROVIDER_TEST_QUEUE_NAME } from "@weeklyreport/shared";
import { z } from "zod";

import type { JobEnqueuer } from "../../../infrastructure/bullmq/job-enqueuer.js";

export { AI_PROVIDER_TEST_QUEUE_NAME };
export const AI_PROVIDER_TEST_ENQUEUER = "AI_PROVIDER_TEST_ENQUEUER" as const;
export const AI_PROVIDER_TEST_SUITE_VERSION = "provider-test-v8";

export type AiProviderTestJobData = Readonly<{
  traceId: string;
  correlationId?: string;
  traceparent?: string;
  tracestate?: string;
  executionId: string;
}>;

// Redis payloads are untrusted delivery data: the processor parses before use.
export const aiProviderTestJobDataSchema = z.object({
  executionId: z.string().min(1),
});

export type AiProviderTestEnqueuer = Readonly<{
  enqueue(job: AiProviderTestJobData): Promise<void>;
}>;

export class AiProviderTestBullmqEnqueuer implements AiProviderTestEnqueuer {
  constructor(private readonly queue: JobEnqueuer) {}

  async enqueue(job: AiProviderTestJobData): Promise<void> {
    // BullMQ silently ignores an add whose jobId is still retained, so a job
    // that failed before claiming its execution would swallow every later
    // re-dispatch of that still-queued row. Remove the terminal job first,
    // mirroring the semantic-index and reminders replacement paths.
    const existing = await this.queue.getJob?.(job.executionId);
    const state = await existing?.getState();
    if (existing && (state === "failed" || state === "completed")) {
      try {
        await existing.remove();
      } catch (error) {
        // Another request may have replaced this id before a worker locked it.
        if ((await existing.getState()) === "active") return;
        throw error;
      }
    }
    await this.queue.add("execute", job, {
      jobId: job.executionId,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    });
  }
}
