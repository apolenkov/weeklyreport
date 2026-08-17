import { describe, expect, it, vi } from "vitest";

import {
  AiCompatibilityBullmqEnqueuer,
  type AiCompatibilityJobData,
} from "./ai-compatibility.queue.js";

describe("AiCompatibilityBullmqEnqueuer", () => {
  it("enqueues only bounded execution and trace references", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const enqueuer = new AiCompatibilityBullmqEnqueuer({ add });
    const job: AiCompatibilityJobData = {
      traceId: "trace-1",
      correlationId: "correlation-1",
      executionId: "11111111-1111-4111-8111-111111111111",
      kind: "provider_test",
    };

    await enqueuer.enqueue(job);

    expect(add).toHaveBeenCalledWith("execute", job, {
      jobId: job.executionId,
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    });
    expect(JSON.stringify(add.mock.calls)).not.toMatch(
      /credential|ciphertext|provider-secret/i,
    );
  });
});
