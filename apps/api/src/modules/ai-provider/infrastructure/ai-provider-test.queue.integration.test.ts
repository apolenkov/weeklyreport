import { randomUUID } from "node:crypto";

import { Queue, QueueEvents, Worker } from "bullmq";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getBullMQOptions } from "../../../infrastructure/bullmq/bullmq-options";
import type { EnvConfig } from "../../../infrastructure/config/env.schema";
import { requireEnv } from "../../../lib/env";
import {
  AI_PROVIDER_TEST_QUEUE_NAME,
  AiProviderTestBullmqEnqueuer,
} from "./ai-provider-test.queue.js";

// Same partial env stub as admin/jobs.integration.test.ts.
const REDIS_ENV = {
  REDIS_DB: Number(requireEnv(process.env, "REDIS_DB")),
  REDIS_HOST: requireEnv(process.env, "REDIS_HOST"),
  REDIS_PORT: Number(requireEnv(process.env, "REDIS_PORT")),
} as unknown as EnvConfig;

describe("AiProviderTestBullmqEnqueuer — real BullMQ", () => {
  let options: ReturnType<typeof getBullMQOptions> & { prefix: string };
  let queue: Queue;
  let events: QueueEvents;
  let worker: Worker | undefined;

  beforeEach(async () => {
    options = {
      ...getBullMQOptions(REDIS_ENV),
      prefix: `test-ai-provider-${randomUUID()}`,
    };
    // Production retention (bullmq.module.ts BOUNDED_RETENTION_JOB_OPTS) keeps failed hashes.
    queue = new Queue(AI_PROVIDER_TEST_QUEUE_NAME, {
      ...options,
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });
    events = new QueueEvents(AI_PROVIDER_TEST_QUEUE_NAME, options);
    await events.waitUntilReady();
  });

  afterEach(async () => {
    // Close a worker left open by a timed-out wait before removing its queue.
    await worker?.close();
    worker = undefined;
    await queue.obliterate({ force: true }).catch(() => undefined);
    await Promise.all([queue.close(), events.close()]);
  });

  it("dispatches a queued execution again after its previous job failed before any claim", async () => {
    const enqueuer = new AiProviderTestBullmqEnqueuer(queue);
    const executionId = randomUUID();
    await enqueuer.enqueue({ traceId: "first", executionId });

    // Producer: startExecution rejects on all 3 attempts (PG unavailable), so the DB
    // row stays `queued` (completeExecution only matches `running`) while BullMQ fails the job.
    const failed = new Promise<void>((done) => {
      events.on("failed", ({ jobId }) => {
        if (jobId === executionId) done();
      });
    });
    worker = new Worker(
      AI_PROVIDER_TEST_QUEUE_NAME,
      () => Promise.reject(new Error("startExecution: connection refused")),
      options,
    );
    await failed;
    await worker.close();
    worker = undefined;

    // The Test button reuses the still-queued execution id (draft-service.ts:46).
    await enqueuer.enqueue({ traceId: "retest", executionId });

    const job = await queue.getJob(executionId);
    expect(job?.data).toMatchObject({ traceId: "retest" });
    expect(await job?.getState()).toBe("waiting"); // main: "failed" — add() was silently ignored
  }, 15_000);

  it("keeps one job when the same execution is dispatched while still waiting", async () => {
    const enqueuer = new AiProviderTestBullmqEnqueuer(queue);
    const executionId = randomUUID();
    await enqueuer.enqueue({ traceId: "first", executionId });
    await enqueuer.enqueue({ traceId: "second", executionId });

    expect(await queue.getJobCounts("waiting", "failed")).toEqual({
      waiting: 1,
      failed: 0,
    });
    expect((await queue.getJob(executionId))?.data).toMatchObject({
      traceId: "first",
    });
  });
});
