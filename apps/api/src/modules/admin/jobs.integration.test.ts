import { randomUUID } from "node:crypto";

import { QUEUE_NAMES, type ReminderQueuePayload } from "@weeklyreport/shared";
import { type Job, Queue, QueueEvents, Worker } from "bullmq";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { AdminBullmqJobsQueue } from "../../infrastructure/bullmq/admin-jobs-queue.adapter.js";
import { getBullMQOptions } from "../../infrastructure/bullmq/bullmq-options";
import {
  type EmailReminderJobData,
  EmailReminderProcessor,
} from "../../infrastructure/bullmq/email-reminder.processor.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { requireEnv } from "../../lib/env";
import { createNullLogger } from "../../lib/logger";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../test-utils/prisma-test-helper";
import { RemindersPrismaRepository } from "../reminders/reminders.prisma-repository";
import { RemindersService } from "../reminders/reminders.service";
import { JobsService } from "./jobs.service";

// getBullMQConnectionOptions reads REDIS_HOST, REDIS_PORT and REDIS_DB; a partial stub
// from the live test env avoids validateEnv() (which parses the full schema
// and process.exit(1)s under the minimal integration env).
const REDIS_ENV = {
  REDIS_DB: Number(requireEnv(process.env, "REDIS_DB")),
  REDIS_HOST: requireEnv(process.env, "REDIS_HOST"),
  REDIS_PORT: Number(requireEnv(process.env, "REDIS_PORT")),
} as unknown as EnvConfig;

function buildReminderPayload(): Extract<
  ReminderQueuePayload,
  { kind: "deadline" }
> {
  return {
    contractVersion: 1,
    kind: "deadline",
    cycleDate: "2026-04-11",
    leadName: "Test Lead",
    reportPeriod: "2026-04-06 → 2026-04-12",
    deadlineIso: "2026-04-11T00:00:00.000Z",
    sectionUrl: "https://example.test/lead/report",
    organization: {
      shortName: "WeeklyReport",
      fullName: "WeeklyReport Department",
    },
  };
}

function buildQueueJobData(
  executionId: string,
  recipientEmail: string,
): EmailReminderJobData {
  return {
    ...buildReminderPayload(),
    executionId,
    recipientEmail,
  };
}

class TestEmailReminderProcessor extends EmailReminderProcessor {
  readonly run = (job: Job<EmailReminderJobData>): Promise<void> =>
    this.processJob(job);
}

describe("JobsService — integration (BullMQ failed jobs)", () => {
  const prisma = createTestPrisma();
  const queueName = "email-reminder";

  let queue: Queue<EmailReminderJobData, unknown>;
  let queueEvents: QueueEvents;
  let worker: Worker<EmailReminderJobData, unknown>;
  let processJob: (job: Job<EmailReminderJobData>) => Promise<unknown>;

  beforeEach(async () => {
    await cleanDatabase();

    const options = {
      ...getBullMQOptions(REDIS_ENV),
      prefix: `test-admin-jobs-${randomUUID()}`,
    };
    processJob = () =>
      Promise.reject(new Error("forced reminder delivery failure"));
    queue = new Queue<EmailReminderJobData, unknown, string>(
      queueName,
      options,
    );
    queueEvents = new QueueEvents(queueName, options);
    worker = new Worker<EmailReminderJobData, unknown, string>(
      queueName,
      (job) => processJob(job),
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
      buildQueueJobData(missingExecutionId, "lead@example.com"),
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
        retryPdfExportGeneration: () =>
          Promise.reject(
            new Error("pdf-export retry is not exercised by this suite"),
          ),
        listPdfRecoveryJobs: () => Promise.resolve([]),
      },
      createNullLogger(),
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

  it("revives a failed reminder, claims the pending row, and marks it sent", async () => {
    const testData = await seedTestData(prisma);
    const policy = await prisma.reminderPolicy.create({
      data: {
        id: randomUUID(),
        kind: "deadline",
        offsetMinutes: 540,
        timezone: "UTC",
        audience: "LEAD_WITH_DRAFT",
        active: true,
        validFrom: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    const rule = await prisma.reminderRule.create({
      data: {
        id: randomUUID(),
        policyId: policy.id,
        kind: "deadline",
        fireAt: new Date("2026-04-11T09:00:00.000Z"),
        deadline: new Date("2026-04-11T00:00:00.000Z"),
        timezone: "UTC",
        status: "active",
        version: 1,
        reportId: testData.report.id,
      },
    });
    const executionId = randomUUID();
    const recipientEmail = "retry-lead@example.com";
    const queuePayload = buildReminderPayload();

    await prisma.reminderExecution.create({
      data: {
        id: executionId,
        ruleId: rule.id,
        recipientEmail,
        dedupeKey: `integration-retry-${executionId}`,
        status: "pending",
        error: null,
        queuePayload,
      },
    });

    let deliveryAttempts = 0;
    const processor = new TestEmailReminderProcessor(
      new RemindersService(
        new RemindersPrismaRepository(prisma as unknown as PrismaService),
        createNullLogger(),
      ),
      {
        sendMail: () => Promise.resolve(),
        sendMailMultipart: () => {
          deliveryAttempts += 1;
          if (deliveryAttempts === 1) {
            return Promise.reject(
              new Error("forced reminder delivery failure"),
            );
          }
          return Promise.resolve();
        },
      },
      REDIS_ENV,
      {
        getSettings: () => Promise.resolve({ notificationFromEmail: null }),
      } as never,
      createNullLogger(),
      null,
    );
    processJob = (job) => processor.run(job);

    const job = await queue.add(
      "send",
      buildQueueJobData(executionId, recipientEmail),
      { attempts: 1, jobId: executionId },
    );
    await expect(job.waitUntilFinished(queueEvents, 10_000)).rejects.toThrow(
      "forced reminder delivery failure",
    );
    await expect(
      prisma.reminderExecution.findUnique({
        where: { id: executionId },
        select: { status: true, error: true, sentAt: true },
      }),
    ).resolves.toMatchObject({
      status: "failed",
      error: "forced reminder delivery failure",
      sentAt: null,
    });

    // Pause before retry so the durable revival can be asserted before the
    // worker claims the requeued job.
    await worker.pause();
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
        reminderExecutionExists: async (id) =>
          (await prisma.reminderExecution.findUnique({
            where: { id },
            select: { id: true },
          })) !== null,
        reviveFailedReminderExecution: async (id) => {
          await prisma.reminderExecution.updateMany({
            where: { id, status: "failed" },
            data: { status: "pending", error: null },
          });
        },
        retryPdfExportGeneration: () =>
          Promise.reject(
            new Error("pdf-export retry is not exercised by this suite"),
          ),
        listPdfRecoveryJobs: () => Promise.resolve([]),
      },
      createNullLogger(),
    );

    await expect(
      service.retryFailed({ queue: queueName, jobId: String(job.id) }),
    ).resolves.toEqual({ retried: true, jobId: String(job.id) });
    await expect(
      prisma.reminderExecution.findUnique({
        where: { id: executionId },
        select: { status: true, error: true },
      }),
    ).resolves.toEqual({ status: "pending", error: null });

    await worker.resume();
    await expect(
      job.waitUntilFinished(queueEvents, 10_000),
    ).resolves.toBeNull();
    const sent = await prisma.reminderExecution.findUnique({
      where: { id: executionId },
      select: { status: true, error: true, sentAt: true },
    });
    expect(sent?.status).toBe("sent");
    expect(sent?.error).toBeNull();
    expect(sent?.sentAt).toBeInstanceOf(Date);
    expect(deliveryAttempts).toBe(2);
  });
});
