import { randomUUID } from "node:crypto";

import { QUEUE_NAMES } from "@customreport/shared";
import { Queue, QueueEvents, Worker } from "bullmq";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { AdminBullmqJobsQueue } from "../../infrastructure/bullmq/admin-jobs-queue.adapter.js";
import { getBullMQOptions } from "../../infrastructure/bullmq/bullmq-options";
import type { EnvConfig } from "../../infrastructure/config/env.schema";
import { requireEnv } from "../../lib/env";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import { JobsService } from "./jobs.service";

// getBullMQConnectionOptions reads only REDIS_HOST/REDIS_PORT; a partial stub
// from the live test env avoids validateEnv() (which parses the full schema
// and process.exit(1)s under the minimal integration env).
const REDIS_ENV = {
  REDIS_DB: Number(requireEnv(process.env, "REDIS_DB")),
  REDIS_HOST: requireEnv(process.env, "REDIS_HOST"),
  REDIS_PORT: Number(requireEnv(process.env, "REDIS_PORT")),
} as unknown as EnvConfig;

describe("JobsService — integration (BullMQ failed jobs)", () => {
  const prisma = createTestPrisma();
  const queueName = "email-reminder";

  let queue: Queue<unknown, unknown>;
  let queueEvents: QueueEvents;
  let worker: Worker<unknown, unknown>;

  beforeEach(async () => {
    await cleanDatabase();

    const options = {
      ...getBullMQOptions(REDIS_ENV),
      prefix: `test-admin-jobs-${randomUUID()}`,
    };
    queue = new Queue<unknown, unknown, string>(queueName, options);
    queueEvents = new QueueEvents(queueName, options);
    worker = new Worker<unknown, unknown, string>(
      queueName,
      (): Promise<void> => {
        return Promise.reject(new Error("forced reminder delivery failure"));
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
    await cleanDatabase();
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

    const service = new JobsService(
      {
        names: QUEUE_NAMES,
        get: (name) => {
          if (name !== queueName) {
            throw new Error(`No test queue for '${name}'`);
          }
          return new AdminBullmqJobsQueue(name, queue);
        },
      },
      {
        reminderExecutionExists: async (executionId) => {
          const execution = await prisma.reminderExecution.findUnique({
            where: { id: executionId },
            select: { id: true },
          });
          return execution !== null;
        },
      },
    );

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
