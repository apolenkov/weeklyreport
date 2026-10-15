import { describe, expect, it, vi } from "vitest";

import {
  AI_PROVIDER_TEST_QUEUE_NAME,
  AiProviderTestBullmqEnqueuer,
} from "./ai-provider-test.queue.js";

const job = { traceId: "trace-1", executionId: "execution-1" };
const jobOptions = {
  jobId: job.executionId,
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
};

const storedJob = (
  state: string,
  remove = vi.fn().mockResolvedValue(undefined),
) => ({
  getState: vi.fn().mockResolvedValue(state),
  remove,
});

describe("AiProviderTestBullmqEnqueuer", () => {
  it("re-enqueues a queued execution with a stable deduplication key", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const enqueuer = new AiProviderTestBullmqEnqueuer({ add });

    await enqueuer.enqueue(job);

    expect(add).toHaveBeenCalledWith("execute", job, jobOptions);
    expect(AI_PROVIDER_TEST_QUEUE_NAME).toBe("ai-provider-test");
  });

  it.each(["failed", "completed"])(
    "removes a retained %s job before re-dispatching the same execution",
    async (state) => {
      const stored = storedJob(state);
      const add = vi.fn().mockResolvedValue(undefined);
      const getJob = vi.fn().mockResolvedValue(stored);
      const enqueuer = new AiProviderTestBullmqEnqueuer({ add, getJob });

      await enqueuer.enqueue(job);

      expect(getJob).toHaveBeenCalledWith(job.executionId);
      expect(stored.remove).toHaveBeenCalledOnce();
      expect(add).toHaveBeenCalledWith("execute", job, jobOptions);
      expect(stored.remove.mock.invocationCallOrder[0]).toBeLessThan(
        add.mock.invocationCallOrder[0] ?? 0,
      );
    },
  );

  it.each(["waiting", "delayed", "active"])(
    "leaves a %s job to BullMQ deduplication",
    async (state) => {
      const stored = storedJob(state);
      const add = vi.fn().mockResolvedValue(undefined);
      const enqueuer = new AiProviderTestBullmqEnqueuer({
        add,
        getJob: vi.fn().mockResolvedValue(stored),
      });

      await enqueuer.enqueue(job);

      expect(stored.remove).not.toHaveBeenCalled();
      expect(add).toHaveBeenCalledWith("execute", job, jobOptions);
    },
  );

  it("keeps a replacement that a worker already locked when removal collides", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const getState = vi
      .fn()
      .mockResolvedValueOnce("failed")
      .mockResolvedValueOnce("active");
    const remove = vi.fn().mockRejectedValue(new Error("job is locked"));
    const enqueuer = new AiProviderTestBullmqEnqueuer({
      add,
      getJob: vi.fn().mockResolvedValue({ getState, remove }),
    });

    await enqueuer.enqueue(job);

    expect(remove).toHaveBeenCalledOnce();
    expect(getState).toHaveBeenCalledTimes(2);
    expect(add).not.toHaveBeenCalled();
  });

  it("fails loudly when a terminal job cannot be removed", async () => {
    const failure = new Error("remove failed");
    const add = vi.fn().mockResolvedValue(undefined);
    const enqueuer = new AiProviderTestBullmqEnqueuer({
      add,
      getJob: vi
        .fn()
        .mockResolvedValue(
          storedJob("failed", vi.fn().mockRejectedValue(failure)),
        ),
    });

    await expect(enqueuer.enqueue(job)).rejects.toBe(failure);
    expect(add).not.toHaveBeenCalled();
  });
});
