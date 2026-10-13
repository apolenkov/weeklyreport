import { EventEmitter } from "node:events";

import { Job, type Queue, QueueBase, RedisQueueBackend } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import { BullmqTerminalJobRemoval } from "./terminal-job-removal.js";

// These doubles exercise reply admission, not Lua or Redis state transitions.
function responseFixture(response: unknown) {
  const runCommand = vi.fn().mockResolvedValue(response);
  const backend = {
    client: Promise.resolve({ defineCommand: vi.fn(), runCommand }),
    finishedErrors: RedisQueueBackend.prototype.finishedErrors.bind(
      RedisQueueBackend.prototype,
    ),
  };
  const events = new EventEmitter();
  const queue = Object.assign(events, {
    qualifiedName: "unit:email-reminder",
    backend,
    getBackend: () => backend,
    toKey: (suffix: string) => `unit:email-reminder:${suffix}`,
    emit: vi.fn(QueueBase.prototype.emit.bind(events)),
  }) as unknown as Queue;
  const job = new Job(
    queue,
    "send",
    { executionId: "unit-job" },
    { timestamp: 1_700_000_000_000 },
    "unit-job",
  );
  job.finishedOn = 1_700_000_000_001;
  return {
    remover: new BullmqTerminalJobRemoval(queue),
    queue,
    job,
    runCommand,
  };
}

describe("terminal removal reply and snapshot admission", () => {
  it("reports removal and routes a synchronous removed-listener failure to the error event", async () => {
    const { remover, job, queue } = responseFixture(1);
    const listenerError = new Error("removed listener failed");
    const removed = vi.fn(() => {
      throw listenerError;
    });
    const errors = vi.fn();
    queue.on("removed", removed);
    queue.on("error", errors);

    await expect(remover.capture(job).removeIfTerminal("failed")).resolves.toBe(
      "removed",
    );
    expect(removed).toHaveBeenCalledOnce();
    expect(removed).toHaveBeenCalledWith(job);
    expect(errors).toHaveBeenCalledOnce();
    expect(errors).toHaveBeenCalledWith(listenerError);
  });

  it.each([2, null, "unexpected-native-reply"])(
    "rejects unknown native reply %s without a removed event",
    async (reply) => {
      const { remover, job, queue } = responseFixture(reply);
      await expect(
        remover.capture(job).removeIfTerminal("failed"),
      ).rejects.toThrow("unknown result");
      expect(queue.emit).not.toHaveBeenCalled();
    },
  );

  it("preserves the native locked-job error for return zero", async () => {
    const { remover, job, queue } = responseFixture(0);
    await expect(
      remover.capture(job).removeIfTerminal("failed"),
    ).rejects.toThrow(
      "Job unit-job could not be removed because it is locked by another worker",
    );
    expect(queue.emit).not.toHaveBeenCalled();
  });

  it("preserves native scheduler errors rather than reporting removal", async () => {
    const { remover, job, queue } = responseFixture(-8);
    await expect(
      remover.capture(job).removeIfTerminal("failed"),
    ).rejects.toThrow("job scheduler");
    expect(queue.emit).not.toHaveBeenCalled();
  });

  it("permits non-terminal lookup but refuses removal without a terminal snapshot", async () => {
    const { remover, job, runCommand } = responseFixture(1);
    expect(Reflect.deleteProperty(job, "finishedOn")).toBe(true);
    const observed = remover.capture(job);
    await expect(observed.removeIfTerminal("failed")).rejects.toThrow(
      "snapshot is missing or invalid",
    );
    expect(runCommand).not.toHaveBeenCalled();
  });
});
