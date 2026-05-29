import { randomUUID } from "node:crypto";
import { Queue, QueueEvents, Worker } from "bullmq";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { getBullMQOptions } from "../../infrastructure/bullmq/bullmq-options";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { JobsService } from "./jobs.service";

describe("JobsService — integration (BullMQ failed jobs)", () => {
  const prisma = createTestPrisma();
  const queueName = "email-reminder";

  let queue: Queue<unknown, unknown, string>;
  let queueEvents: QueueEvents;
  let worker: Worker<unknown, unknown, string>;

  beforeEach(async () => {
    await cleanDatabase(prisma);

    const options = {
      ...getBullMQOptions(),
      prefix: `test-admin-jobs-${randomUUID()}`,
    };
    queue = new Queue<unknown, unknown, string>(queueName, options);
    queueEvents = new QueueEvents(queueName, options);
    worker = new Worker<unknown, unknown, string>(
      queueName,
      async (): Promise<void> => {
        throw new Error("forced reminder delivery failure");
      },
      options,
    );

    await queueEvents.waitUntilReady();
    await worker.waitUntilReady();
  });

  afterEach(async () => {
    await worker.close();
    await queue.obliterate({ force: true }).catch(() => undefined);
    await queueEvents.close();
    await queue.close();
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("removes a failed retry job when its ReminderExecution row is already gone", async () => {
    const missingExecutionId = randomUUID();
    const job = await queue.add(
      "send",
      {
        executionId: missingExecutionId,
        recipientEmail: "lead@example.com",
      },
      { attempts: 1 },
    );

    await expect(job.waitUntilFinished(queueEvents, 10_000)).rejects.toThrow(
      "forced reminder delivery failure",
    );
    expect(await queue.getFailedCount()).toBe(1);
    await expect(
      prisma.reminderExecution.findUnique({
        where: { id: missingExecutionId },
        select: { id: true },
      }),
    ).resolves.toBeNull();

    const service = new JobsService(queue, undefined, {
      reminderExecutionExists: async (executionId) => {
        const execution = await prisma.reminderExecution.findUnique({
          where: { id: executionId },
          select: { id: true },
        });
        return execution !== null;
      },
    });

    const result = await service.retryFailed({
      queue: "email-reminder",
      jobId: String(job.id),
    });

    expect(result).toEqual({
      retried: false,
      removed: true,
      reason: `Reminder execution ${missingExecutionId} no longer exists.`,
      jobId: String(job.id),
    });
    expect(await queue.getFailedCount()).toBe(0);
    expect(await queue.getWaitingCount()).toBe(0);
    expect(await queue.getJob(String(job.id))).toBeUndefined();
  });
});
