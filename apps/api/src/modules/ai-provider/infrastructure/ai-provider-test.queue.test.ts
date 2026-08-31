import { describe, expect, it, vi } from "vitest";

import {
  AI_PROVIDER_TEST_QUEUE_NAME,
  AiProviderTestBullmqEnqueuer,
} from "./ai-provider-test.queue.js";

describe("AiProviderTestBullmqEnqueuer", () => {
  it("re-enqueues a queued execution with a stable deduplication key", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const enqueuer = new AiProviderTestBullmqEnqueuer({ add });
    const job = {
      traceId: "trace-1",
      executionId: "execution-1",
    };

    await enqueuer.enqueue(job);

    expect(add).toHaveBeenCalledWith("execute", job, {
      jobId: job.executionId,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    });
    expect(AI_PROVIDER_TEST_QUEUE_NAME).toBe("ai-provider-test");
  });
});
