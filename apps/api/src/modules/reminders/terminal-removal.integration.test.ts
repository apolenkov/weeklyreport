import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import { EMAIL_REMINDER_QUEUE_NAME, QUEUE_NAMES } from "@weeklyreport/shared";
import {
  type Job,
  Queue,
  QueueEvents,
  UnrecoverableError,
  Worker,
} from "bullmq";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  assertE2eRuntimeDestructiveTarget,
  parseE2eRuntimeRedisTarget,
} from "../../../../../prisma/guards/_destructive-guard.js";
import { ACTIVE_REPORT_ID } from "../../../../../prisma/seeds/support/seed-identifiers.js";
import { createBootstrapJobsService } from "../../bootstrap/jobs-service.js";
import { QueueRegistry } from "../../infrastructure/bullmq/queue-registry.js";
import { BullmqTerminalJobRemoval } from "../../infrastructure/bullmq/terminal-job-removal.js";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { requireEnv } from "../../lib/env.js";
import { createNullLogger } from "../../lib/logger.js";
import type { JobsService } from "../../modules/admin/index.js";
import { RemindersBullmqEnqueuer } from "../../modules/reminders/reminders-bullmq-enqueuer.adapter.js";
import {
  buildReminderQueueJobData,
  parseReminderQueueJobData,
  type ReminderQueueJobData,
} from "../../modules/reminders/reminders-queue-payload.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper.js";

const SCRIPT_NAME = "terminal-removal.integration";
const FAILURE = "controlled terminal failure";
const WAIT_MS = 10_000;

function safeTarget() {
  const databaseUrl = requireEnv(process.env, "E2E_DATABASE_URL");
  assertE2eRuntimeDestructiveTarget(SCRIPT_NAME, databaseUrl, process.env);
  const redis = parseE2eRuntimeRedisTarget(SCRIPT_NAME, process.env);
  const target = new URL(databaseUrl);
  console.info(
    JSON.stringify({
      postgresHost: target.hostname,
      postgresPort: target.port,
      database: target.pathname.slice(1),
      redisHost: redis.host,
      redisPort: redis.port,
      redisDb: redis.db,
    }),
  );
  return redis;
}

// The timeout rejects; it never releases the stale operation automatically.
async function bounded<T>(pending: Promise<T>): Promise<T> {
  const controller = new AbortController();
  try {
    return await Promise.race([
      pending,
      setTimeout(WAIT_MS, undefined, { signal: controller.signal }).then(() => {
        throw new Error("Terminal-removal barrier was not reached");
      }),
    ]);
  } finally {
    controller.abort();
  }
}

function holdTerminalRead(queue: Queue, job: Job) {
  const entered = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  const getState = job.getState.bind(job);
  vi.spyOn(job, "getState").mockImplementationOnce(async () => {
    const state = await getState();
    expect(state).toBe("failed");
    entered.resolve();
    await released.promise;
    return state;
  });
  // Only the stale caller receives the held real handle; retry and assertions
  // obtain fresh handles from Redis through the original Queue.getJob.
  vi.spyOn(queue, "getJob").mockResolvedValueOnce(job);
  return { entered: entered.promise, release: () => released.resolve() };
}

describe("terminal removal — real BullMQ caller races", () => {
  const prisma = createTestPrisma();
  let registry: QueueRegistry;
  let queue: Queue;
  let queues: Queue[] = [];
  let queueEvents: QueueEvents | undefined;
  let worker: Worker | undefined;
  let publicJobsService: JobsService;
  let executionId: string;
  let policyId: string;
  let ruleId: string;
  let data: ReminderQueueJobData;
  let options: {
    prefix: string;
    connection: {
      host: string;
      port: number;
      db: number;
      maxRetriesPerRequest: null;
    };
  };

  beforeEach(async () => {
    queues = [];
    executionId = randomUUID();
    policyId = randomUUID();
    ruleId = randomUUID();
    const redis = safeTarget();
    const report = expectDefined(
      await prisma.report.findUnique({ where: { id: ACTIVE_REPORT_ID } }),
      "Canonical demo seed must precede this suite",
    );
    const deadline = expectDefined(report.deadline);
    const payload = {
      kind: "deadline" as const,
      cycleDate: deadline.toISOString().slice(0, 10),
      leadName: "Synthetic Queue Lead",
      reportPeriod: `${report.periodStart.toISOString().slice(0, 10)} → ${report.periodEnd.toISOString().slice(0, 10)}`,
      deadlineIso: deadline.toISOString(),
      sectionUrl: "https://example.test/lead/report",
      organization: {
        shortName: "WeeklyReport",
        fullName: "WeeklyReport Department",
      },
    };
    await prisma.reminderPolicy.create({
      data: {
        id: policyId,
        kind: "deadline",
        offsetMinutes: 0,
        timezone: "UTC",
        audience: "LEAD_WITH_DRAFT",
        validFrom: new Date("2026-01-01"),
      },
    });
    await prisma.reminderRule.create({
      data: {
        id: ruleId,
        reportId: report.id,
        policyId,
        kind: "deadline",
        fireAt: deadline,
        deadline,
        timezone: "UTC",
      },
    });
    await prisma.reminderExecution.create({
      data: {
        id: executionId,
        ruleId,
        recipientEmail: "synthetic-queue@example.test",
        dedupeKey: `terminal-removal-${executionId}`,
        status: "failed",
        error: FAILURE,
        queuePayload: { ...payload, contractVersion: 1 },
      },
    });
    data = buildReminderQueueJobData(
      executionId,
      "synthetic-queue@example.test",
      payload,
    );
    parseReminderQueueJobData({
      ...data,
      correlationId: "original-waiting-attempt",
    });

    options = {
      prefix: `task503-queue-d-${randomUUID()}`,
      connection: {
        host: redis.host,
        port: redis.port,
        db: Number(redis.db),
        maxRetriesPerRequest: null,
      },
    };
    queues = QUEUE_NAMES.map((name) => new Queue(name, options));
    registry = new QueueRegistry(queues);
    queue = registry.get(EMAIL_REMINDER_QUEUE_NAME);
    console.info(
      JSON.stringify({
        prefix: options.prefix,
        redisDb: redis.db,
        executionId,
        policyId,
        ruleId,
      }),
    );
    queueEvents = new QueueEvents(EMAIL_REMINDER_QUEUE_NAME, options);
    await queueEvents.waitUntilReady();
    publicJobsService = createBootstrapJobsService({
      queueRegistry: registry,
      prisma: prisma as unknown as PrismaService,
      logger: createNullLogger(),
      pdfExportService: {
        retryExportGeneration: () =>
          Promise.reject(new Error("PDF retry is outside this fixture")),
      },
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await worker?.close();
    worker = undefined;
    try {
      safeTarget();
      // This UUID prefix belongs to this test; never flush the Redis database.
      await Promise.all(
        queues.map(async (ownedQueue) => {
          safeTarget();
          await ownedQueue.obliterate();
        }),
      );
    } finally {
      await queueEvents?.close();
      queueEvents = undefined;
      await Promise.all(queues.map((ownedQueue) => ownedQueue.close()));
      queues = [];
      safeTarget();
      await prisma.reminderExecution.deleteMany({ where: { id: executionId } });
      safeTarget();
      await prisma.reminderRule.deleteMany({ where: { id: ruleId } });
      safeTarget();
      await prisma.reminderPolicy.deleteMany({ where: { id: policyId } });
    }
  });

  afterAll(disconnectTestPrisma);

  async function failedJob(): Promise<Job> {
    worker = new Worker(
      EMAIL_REMINDER_QUEUE_NAME,
      () => Promise.reject(new UnrecoverableError(FAILURE)),
      { ...options, autorun: false },
    );
    const job = await queue.add(
      "send",
      { ...data, correlationId: "original-waiting-attempt" },
      { jobId: executionId, attempts: 1 },
    );
    const finished = job.waitUntilFinished(expectDefined(queueEvents), WAIT_MS);
    const running = worker.run();
    try {
      await expect(finished).rejects.toThrow(FAILURE);
      expect(await job.getState()).toBe("failed");
    } finally {
      await worker.close();
      await running;
      worker = undefined;
    }
    return expectDefined(await queue.getJob(executionId));
  }

  async function retryToWaiting(): Promise<void> {
    await expect(
      publicJobsService.retryFailed({
        queue: EMAIL_REMINDER_QUEUE_NAME,
        jobId: executionId,
      }),
    ).resolves.toEqual({ retried: true, jobId: executionId });
    expect(
      await expectDefined(await queue.getJob(executionId)).getState(),
    ).toBe("waiting");
    expect(
      await prisma.reminderExecution.findUnique({
        where: { id: executionId },
        select: { status: true, error: true },
      }),
    ).toEqual({ status: "pending", error: null });
  }

  it("C0757: a stale Remove preserves the job retried through publicJobsService", async () => {
    const original = await failedJob();
    const gate = holdTerminalRead(queue, original);
    const removal = publicJobsService
      .removeFailed({
        queue: EMAIL_REMINDER_QUEUE_NAME,
        jobId: executionId,
      })
      .then(
        (result) => ({ result }),
        (error: unknown) => ({ error }),
      );
    try {
      await bounded(gate.entered);
      await retryToWaiting();
    } finally {
      gate.release();
      await removal;
    }
    const outcome = await removal;
    if ("error" in outcome) throw outcome.error;
    const retained = await queue.getJob(executionId);
    expect
      .soft(retained, "the retried waiting job must still exist")
      .toBeDefined();
    expect.soft(outcome.result).toEqual({ removed: false, jobId: executionId });
    if (retained) expect(await retained.getState()).toBe("waiting");
  });

  it("C1358: stale replaceTerminal preserves the original retried waiting attempt", async () => {
    const original = await failedJob();
    const gate = holdTerminalRead(queue, original);
    const enqueuer = new RemindersBullmqEnqueuer(
      queue,
      new BullmqTerminalJobRemoval(queue),
    );
    const replacement = enqueuer
      .enqueue(
        executionId,
        data,
        { correlationId: "replacement-attempt" },
        { replaceTerminal: true },
      )
      .then(
        () => ({ rejected: false }),
        (error: unknown) => ({ rejected: true, error }),
      );
    try {
      await bounded(gate.entered);
      await retryToWaiting();
    } finally {
      gate.release();
      await replacement;
    }
    const outcome = await replacement;
    const retained = expectDefined(await queue.getJob(executionId));
    expect(await retained.getState()).toBe("waiting");
    expect
      .soft(
        parseReminderQueueJobData(retained.data).correlationId,
        "same-id replacement must not erase the original attempt",
      )
      .toBe("original-waiting-attempt");
    expect.soft(retained.attemptsMade).toBe(1);
    expect.soft(outcome.rejected).toBe(true);
    if ("error" in outcome) {
      expect(outcome.error).toBeInstanceOf(Error);
      expect(String(outcome.error)).toMatch(/non-terminal.*waiting/i);
    }
  });

  it("removes an unchanged failed job, emits the local event once, and distinguishes missing", async () => {
    const original = await failedJob();
    const observed = new BullmqTerminalJobRemoval(queue).capture(original);
    const listenerError = new Error("removed listener failed");
    const removed = vi.fn(() => {
      throw listenerError;
    });
    const errors = vi.fn();
    queue.on("removed", removed);
    queue.on("error", errors);
    safeTarget();
    await expect(observed.removeIfTerminal("failed")).resolves.toBe("removed");
    expect(await queue.getJob(executionId)).toBeUndefined();
    expect(removed).toHaveBeenCalledOnce();
    expect(removed).toHaveBeenCalledWith(original);
    expect(errors).toHaveBeenCalledOnce();
    expect(errors).toHaveBeenCalledWith(listenerError);
    safeTarget();
    await expect(observed.removeIfTerminal("failed")).resolves.toBe("missing");
    expect(removed).toHaveBeenCalledOnce();
    expect(errors).toHaveBeenCalledOnce();
  });

  it("preserves a different terminal snapshot recreated under the same execution UUID", async () => {
    const original = await failedJob();
    const observed = new BullmqTerminalJobRemoval(queue).capture(original);
    safeTarget();
    await original.remove();
    const replacement = await failedJob();
    await replacement.updateData({
      ...data,
      correlationId: "new-terminal-instance",
    });
    expect(await replacement.getState()).toBe("failed");
    safeTarget();
    await expect(observed.removeIfTerminal("failed")).resolves.toBe(
      "identity-changed",
    );
    const retained = expectDefined(await queue.getJob(executionId));
    expect(await retained.getState()).toBe("failed");
    expect(parseReminderQueueJobData(retained.data).correlationId).toBe(
      "new-terminal-instance",
    );
    expect(retained.attemptsMade).toBe(1);
  });

  it("preserves a retried active job and its real worker lock", async () => {
    const original = await failedJob();
    const observed = new BullmqTerminalJobRemoval(queue).capture(original);
    await retryToWaiting();
    const entered = Promise.withResolvers<Job>();
    const released = Promise.withResolvers<void>();
    worker = new Worker(
      EMAIL_REMINDER_QUEUE_NAME,
      async (job) => {
        entered.resolve(job);
        await released.promise;
      },
      { ...options, autorun: false },
    );
    const running = worker.run();
    try {
      const active = await bounded(entered.promise);
      expect(await active.getState()).toBe("active");
      const client = await queue.getBackend().client;
      const lockKey = `${queue.toKey(executionId)}:lock`;
      const lock = expectDefined(await client.get(lockKey));
      safeTarget();
      await expect(active.remove()).rejects.toThrow("locked by another worker");
      safeTarget();
      await expect(observed.removeIfTerminal("failed")).resolves.toBe(
        "state-changed",
      );
      expect(
        await expectDefined(await queue.getJob(executionId)).getState(),
      ).toBe("active");
      expect(await client.get(lockKey)).toBe(lock);
    } finally {
      released.resolve();
      await worker.close();
      await running;
      worker = undefined;
    }
  });

  it("allows completed removal only for reminder terminal policy", async () => {
    const job = await queue.add("send", data, { jobId: executionId });
    const finished = job.waitUntilFinished(expectDefined(queueEvents), WAIT_MS);
    worker = new Worker(EMAIL_REMINDER_QUEUE_NAME, () => Promise.resolve(), {
      ...options,
      autorun: false,
    });
    const running = worker.run();
    try {
      await finished;
    } finally {
      await worker.close();
      await running;
      worker = undefined;
    }
    const completed = expectDefined(await queue.getJob(executionId));
    expect(await completed.getState()).toBe("completed");
    const observed = new BullmqTerminalJobRemoval(queue).capture(completed);
    safeTarget();
    await expect(observed.removeIfTerminal("failed")).resolves.toBe(
      "state-changed",
    );
    expect(
      await expectDefined(await queue.getJob(executionId)).getState(),
    ).toBe("completed");
    safeTarget();
    await expect(
      observed.removeIfTerminal("failed-or-completed"),
    ).resolves.toBe("removed");
    expect(await queue.getJob(executionId)).toBeUndefined();
  });
});
