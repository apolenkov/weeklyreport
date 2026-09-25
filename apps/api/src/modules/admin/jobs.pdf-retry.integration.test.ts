import { randomUUID } from "node:crypto";

import {
  PDF_EXPORT_QUEUE_NAME,
  publishedReportSnapshotSchema,
  QUEUE_NAMES,
  type QueueName,
} from "@customreport/shared";
import { type Job, Queue, QueueEvents, Worker } from "bullmq";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

import { assertE2eRuntimeDestructiveTarget } from "../../../../../prisma/guards/_destructive-guard.js";
import { AdminBullmqJobsQueue } from "../../infrastructure/bullmq/admin-jobs-queue.adapter.js";
import { getBullMQOptions } from "../../infrastructure/bullmq/bullmq-options";
import { PdfExportProcessor } from "../../infrastructure/bullmq/pdf-export.processor.js";
import { PdfExportReconciliationScheduler } from "../../infrastructure/bullmq/pdf-export-reconciliation.scheduler.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { requireEnv } from "../../lib/env";
import { createNullLogger } from "../../lib/logger";
import { expectDefined } from "../../test-utils/expect-defined.js";
import { NOOP_PDF_EXPORT_TELEMETRY } from "../../test-utils/pdf-export.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  publishedSnapshotFixture,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import { PdfExportPrismaRepository } from "../pdf-export/pdf-export.prisma-repository";
import { PdfExportService } from "../pdf-export/pdf-export.service";
import { PdfExportBullmqEnqueuer } from "../pdf-export/pdf-export-bullmq-enqueuer.adapter.js";
import { JobsService } from "./jobs.service";

// Real Postgres + BullMQ proof for the coordinated pdf-export retry: the
// durable row lock, the queue state check, and terminal reconciliation all run
// against the actual adapters. The Worker only returns or throws metadata —
// rendering, browsers and providers are out of scope for state verification.
const QUEUE_NAME = PDF_EXPORT_QUEUE_NAME;
const SCRIPT_NAME = "jobs.pdf-retry.integration";
const FIRST_ATTEMPT_ERROR = "attempt-A failed";
const SECOND_ATTEMPT_ERROR = "attempt-B exploded";
const RETRY_CHECKSUM = "sha256:retry-second-attempt";
const WAIT_TIMEOUT_MS = 10_000;
const PDF_EXPORT_ENV = {
  PDF_BASE_URL: "http://localhost:3000",
  PDF_EXPORT_JWT_SECRET: "test-pdf-export-secret-at-least-32-chars",
};

// getBullMQOptions reads REDIS_HOST, REDIS_PORT and REDIS_DB; a partial stub
// from the live test env avoids validateEnv() (which parses the full schema
// and process.exit(1)s under the minimal integration env).
const REDIS_ENV = {
  REDIS_DB: Number(requireEnv(process.env, "REDIS_DB")),
  REDIS_HOST: requireEnv(process.env, "REDIS_HOST"),
  REDIS_PORT: Number(requireEnv(process.env, "REDIS_PORT")),
} as unknown as EnvConfig;

function assertSafeRedisMutation(): void {
  assertE2eRuntimeDestructiveTarget(
    SCRIPT_NAME,
    requireEnv(process.env, "E2E_DATABASE_URL"),
    process.env,
  );
  if (REDIS_ENV.REDIS_DB !== 15) {
    throw new Error(
      `[${SCRIPT_NAME}] REDIS_DB must be exactly 15 before Redis access.`,
    );
  }
}

assertSafeRedisMutation();

type PdfJob = Job<unknown, unknown>;

interface CapturedFailure {
  readonly job: PdfJob;
  readonly error: Error;
}

// Two-sided handoff primitive: the held party calls signal() when it reaches
// the barrier, then awaits `gate`, which only an explicit release() opens —
// a timeout must fail the test, never silently let the held party through.
// Entry is observed by polling isEntered() inside a bounded vi.waitFor, so an
// absent signal rejects instead of hanging the test.
function barrier(): {
  isEntered: () => boolean;
  gate: Promise<void>;
  signal: () => void;
  release: () => void;
} {
  let entered = false;
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    isEntered: () => entered,
    gate,
    signal: () => {
      entered = true;
    },
    release,
  };
}

async function waitForCondition(check: () => void): Promise<void> {
  await vi.waitFor(check, { timeout: WAIT_TIMEOUT_MS });
}

describe("JobsService — pdf-export retry (Postgres + BullMQ integration)", () => {
  const prisma = createTestPrisma();

  let testData: Awaited<ReturnType<typeof seedTestData>>;
  let queue: Queue<unknown, unknown>;
  let queueEvents: QueueEvents;
  let worker: Worker<unknown, unknown>;
  let processBehavior: (job: PdfJob) => Promise<unknown>;
  let processCalls: number;
  let lastFailure: CapturedFailure | undefined;

  let repo: PdfExportPrismaRepository;
  let pdfService: PdfExportService;
  let scheduler: PdfExportReconciliationScheduler;
  let processor: PdfExportProcessor;
  let jobsService: JobsService;

  // Only resources actually constructed land here, so a partially failed
  // beforeEach still leaves cleanup closing exactly what exists.
  let allocated: {
    queue?: Queue<unknown, unknown>;
    queueEvents?: QueueEvents;
    worker?: Worker<unknown, unknown>;
  };

  beforeEach(async () => {
    allocated = {};
    assertSafeRedisMutation();
    await cleanDatabase();
    testData = await seedTestData(prisma);
    processBehavior = () => Promise.reject(new Error(FIRST_ATTEMPT_ERROR));
    processCalls = 0;
    lastFailure = undefined;

    const options = {
      ...getBullMQOptions(REDIS_ENV),
      // Each case owns a unique BullMQ prefix, so obliterate touches only
      // keys this test created on Redis DB 15.
      prefix: `test-pdf-retry-${randomUUID()}`,
    };
    queue = new Queue<unknown, unknown>(QUEUE_NAME, options);
    allocated.queue = queue;
    queueEvents = new QueueEvents(QUEUE_NAME, options);
    allocated.queueEvents = queueEvents;
    worker = new Worker<unknown, unknown>(
      QUEUE_NAME,
      (job) => {
        processCalls += 1;
        return processBehavior(job);
      },
      options,
    );
    allocated.worker = worker;
    worker.on("failed", (job, error) => {
      if (job !== undefined) {
        lastFailure = { job, error };
      }
    });

    await queueEvents.waitUntilReady();
    await worker.waitUntilReady();

    repo = new PdfExportPrismaRepository(prisma as unknown as PrismaService);
    pdfService = new PdfExportService(
      repo,
      createNullLogger(),
      new PdfExportBullmqEnqueuer(queue),
      NOOP_PDF_EXPORT_TELEMETRY,
      PDF_EXPORT_ENV,
    );
    const queueRegistry = {
      get: (name: QueueName): Queue => {
        if (name !== QUEUE_NAME) {
          throw new Error(`No test queue for '${name}'`);
        }
        return queue;
      },
    };
    scheduler = new PdfExportReconciliationScheduler(pdfService, queueRegistry);
    processor = new PdfExportProcessor(
      pdfService,
      REDIS_ENV,
      createNullLogger(),
      null,
      queueRegistry,
    );
    jobsService = jobsServiceOver(queue);
  });

  afterEach(async () => {
    const errors: unknown[] = [];
    const collect = async (
      step: () => Promise<unknown> | undefined,
    ): Promise<void> => {
      try {
        await step();
      } catch (error) {
        errors.push(error);
      }
    };
    const owned = allocated;
    allocated = {};
    await collect(() => owned.worker?.close());
    // Obliterate is the one destructive Redis call — the disposable-target
    // and DB-15 guards must hold immediately before it, not just at setup.
    await collect(async () => {
      if (owned.queue) {
        assertSafeRedisMutation();
        await owned.queue.obliterate({ force: true });
      }
    });
    await collect(() => owned.queueEvents?.close());
    await collect(() => owned.queue?.close());
    await collect(cleanDatabase);
    if (errors.length > 0) {
      throw new AggregateError(errors, `${SCRIPT_NAME} cleanup failed`);
    }
  });

  afterAll(async () => {
    try {
      await cleanDatabase();
    } finally {
      await disconnectTestPrisma();
    }
  });

  function jobsServiceOver(target: Queue): JobsService {
    return new JobsService(
      {
        names: QUEUE_NAMES,
        get: (name) => {
          if (name !== QUEUE_NAME) {
            throw new Error(`No test queue for '${name}'`);
          }
          return new AdminBullmqJobsQueue(name, target);
        },
      },
      {
        reminderExecutionExists: () =>
          Promise.reject(
            new Error("reminder retry is not exercised by this suite"),
          ),
        retryFailedPdfExport: (input) => pdfService.retryFailedExport(input),
      },
      createNullLogger(),
    );
  }

  // Wraps the real Queue so the returned Job carries one patched method —
  // the deterministic form of a race the production seam can hit inside the
  // export row lock. Everything else delegates to the real queue unchanged.
  function queueWithPatchedJob(patch: (job: PdfJob) => void): Queue {
    const wrapped = Object.create(queue) as Queue;
    wrapped.getJob = async (id: string) => {
      const job = await queue.getJob(id);
      if (job === undefined) return undefined;
      patch(job);
      return job;
    };
    return wrapped;
  }

  async function createDurableExport(jobId: string): Promise<void> {
    await repo.createExportJob(
      {
        jobId,
        reportId: testData.report.id,
        status: "queued",
        requestedAt: new Date(),
        completedAt: null,
        checksum: null,
        templateVersion: "phase-2-pdf-v1",
        artifactUrl: null,
      },
      testData.head.id,
      publishedReportSnapshotSchema.parse(
        publishedSnapshotFixture({
          reportId: testData.report.id,
          periodStart: testData.report.periodStart,
          periodEnd: testData.report.periodEnd,
          deadline: testData.report.deadline,
          publishedAt: testData.report.publishedAt ?? new Date(),
          sectionOwners: [
            {
              reportSectionId: testData.section.id,
              authorId: testData.lead.id,
              authorName: testData.lead.name,
              groupId: TEST_IDS.group,
              groupName: "Test Group",
            },
          ],
        }),
      ),
    );
  }

  // One controlled attempt: the worker throws, BullMQ marks the job failed,
  // and waitUntilFinished settles it deterministically.
  async function enqueueFailedExport(
    payload: { jobId: string; reportId: string; requestedBy: string },
    queueJobId = payload.jobId,
  ): Promise<PdfJob> {
    const job = await queue.add("generate", payload, {
      jobId: queueJobId,
      attempts: 1,
    });
    await expect(
      job.waitUntilFinished(queueEvents, WAIT_TIMEOUT_MS),
    ).rejects.toThrow(FIRST_ATTEMPT_ERROR);
    return job;
  }

  // The full precondition the admin retry acts on: a durable failed row that
  // real reconciliation wrote from the real failed queue job.
  async function durableFailedExport(jobId: string): Promise<PdfJob> {
    await createDurableExport(jobId);
    const job = await enqueueFailedExport({
      jobId,
      reportId: testData.report.id,
      requestedBy: testData.head.id,
    });
    await scheduler.runOnce();
    const row = await exportRow(jobId);
    expect(row.status).toBe("failed");
    expect(row.error).toBe(FIRST_ATTEMPT_ERROR);
    return job;
  }

  // The production delayed-failure entry point is protected because only the
  // Worker's "failed" event drives it; this test invokes it directly with a
  // genuinely stale Job the event captured before the retry.
  function emitDelayedFailure(job: PdfJob, error: Error): void {
    (
      processor as unknown as {
        readonly onJobFailed: (job: PdfJob, error: Error) => void;
      }
    ).onJobFailed(job, error);
  }

  // Awaits the fire-and-forget failure callback deterministically: the real
  // reconcileTerminalState call is spied on, and its returned promise only
  // resolves after the row lock and any write have fully settled.
  async function awaitEmittedReconcile(
    spy: MockInstance<PdfExportService["reconcileTerminalState"]>,
  ): Promise<boolean> {
    await waitForCondition(() => expect(spy).toHaveBeenCalledTimes(1));
    const result = expectDefined(spy.mock.results.at(-1));
    if (result.type !== "return") {
      throw new Error("reconcileTerminalState did not return");
    }
    return result.value;
  }

  const completeWithArtifact =
    (jobId: string) => (): Promise<{ artifactUrl: string; checksum: string }> =>
      Promise.resolve({
        artifactUrl: `/pdfs/${jobId}.pdf`,
        checksum: RETRY_CHECKSUM,
      });

  async function exportRow(jobId: string) {
    return expectDefined(
      await prisma.pdfExportJob.findUnique({ where: { id: jobId } }),
    );
  }

  // The columns a retry must never rewrite: row identity, the persisted
  // request time, the report binding, requester, template, and the immutable
  // publication provenance (timestamp, snapshot body, owning groups).
  const publicationProjection = (
    row: Awaited<ReturnType<typeof exportRow>>,
  ) => ({
    id: row.id,
    createdAt: row.createdAt,
    reportId: row.reportId,
    requestedBy: row.requestedBy,
    templateVersion: row.templateVersion,
    publicationAt: row.publicationAt,
    publicationSnapshot: row.publicationSnapshot,
    publicationGroupIds: row.publicationGroupIds,
  });

  it("accepts exactly one of two concurrent retries and lets the export complete", async () => {
    const jobId = TEST_IDS.pdfJob1;
    const job = await durableFailedExport(jobId);
    const before = await exportRow(jobId);
    expect(before.publicationGroupIds).toEqual([TEST_IDS.group]);

    // Paused worker: the requeued job stays waiting so the case measures the
    // two admin requests, not worker timing.
    await worker.pause();

    // The first request's isFailed() — invoked inside the export row lock —
    // blocks on a barrier, so the second request is issued while the first is
    // demonstrably inside its locked callback.
    const hold = barrier();
    let armed = true;
    const barrierQueue = queueWithPatchedJob((job) => {
      if (!armed) return;
      armed = false;
      const realGetState = job.getState.bind(job);
      job.getState = async () => {
        hold.signal();
        await hold.gate;
        return realGetState();
      };
    });

    const firstPromise = jobsServiceOver(barrierQueue).retryFailed({
      queue: QUEUE_NAME,
      jobId,
    });
    let secondPromise: ReturnType<JobsService["retryFailed"]> | undefined;
    try {
      // Bounded entry check: a timeout rejects here — it never releases the
      // gate as if the intended ordering had happened.
      await waitForCondition(() => expect(hold.isEntered()).toBe(true));
      secondPromise = jobsService.retryFailed({ queue: QUEUE_NAME, jobId });
    } finally {
      hold.release();
      if (secondPromise === undefined) {
        // The entry check failed mid-flight: still observe the first
        // request's outcome so it cannot surface as an unhandled rejection.
        await Promise.allSettled([firstPromise]);
      }
    }
    const [firstResult, secondResult] = await Promise.all([
      firstPromise,
      expectDefined(secondPromise),
    ]);

    // Exactly one request revives; the other reads the winner's committed
    // pending row and gets the durable-side decline — never a double retry.
    // This case proves the single-winner outcome only; row-lock ordering
    // itself is proven by the repository suite's own FOR UPDATE case.
    expect(firstResult).toEqual({ retried: true, jobId });
    expect(secondResult).toEqual({
      retried: false,
      jobId,
      reason:
        "PDF export row is missing, not failed, or bound to another payload.",
    });
    expect(await expectDefined(await queue.getJob(jobId)).getState()).toBe(
      "waiting",
    );

    const revived = await exportRow(jobId);
    expect(revived.status).toBe("pending");
    expect(publicationProjection(revived)).toEqual(
      publicationProjection(before),
    );

    processBehavior = completeWithArtifact(jobId);
    await worker.resume();
    await expect(
      job.waitUntilFinished(queueEvents, WAIT_TIMEOUT_MS),
    ).resolves.toMatchObject({ checksum: RETRY_CHECKSUM });
    await scheduler.runOnce();

    // One worker invocation failed the first attempt; exactly one more ran
    // for the retried attempt — the declined request reached no worker.
    expect(processCalls).toBe(2);

    const after = await exportRow(jobId);
    expect(after).toMatchObject({
      status: "completed",
      filePath: `/pdfs/${jobId}.pdf`,
      checksum: RETRY_CHECKSUM,
      error: null,
    });
    expect(publicationProjection(after)).toEqual(publicationProjection(before));

    // Re-running terminal reconciliation writes nothing: the completed row
    // is not "queued", so the entire row — updatedAt included — is identical.
    await scheduler.runOnce();
    expect(await exportRow(jobId)).toEqual(after);
  });

  it("ignores a delayed failure event from the old attempt while the retried attempt is active", async () => {
    const jobId = TEST_IDS.pdfJob1;
    await durableFailedExport(jobId);
    await waitForCondition(() => expect(lastFailure).toBeDefined());
    const stale = expectDefined(lastFailure);

    // The retried attempt parks inside the worker on a gate, so the job is
    // genuinely "active" — not merely waiting — when the stale event lands.
    const attempt = barrier();
    processBehavior = async () => {
      attempt.signal();
      await attempt.gate;
      return {
        artifactUrl: `/pdfs/${jobId}.pdf`,
        checksum: RETRY_CHECKSUM,
      };
    };

    try {
      const result = await jobsService.retryFailed({
        queue: QUEUE_NAME,
        jobId,
      });
      expect(result).toEqual({ retried: true, jobId });
      await waitForCondition(() => expect(attempt.isEntered()).toBe(true));
      expect(await expectDefined(await queue.getJob(jobId)).getState()).toBe(
        "active",
      );

      const reconcile = vi.spyOn(pdfService, "reconcileTerminalState");
      emitDelayedFailure(stale.job, stale.error);
      // The loader re-read the live queue state under the row lock: the job
      // is active again, so the stale failure wrote nothing.
      expect(await awaitEmittedReconcile(reconcile)).toBe(false);

      const revived = await exportRow(jobId);
      expect(revived.status).toBe("pending");
      expect(revived.error).toBeNull();
    } finally {
      // Always release the parked attempt — otherwise worker.close() would
      // wait on a job that can never finish.
      attempt.release();
    }

    // The revived attempt itself is unaffected and completes normally.
    await expect(
      expectDefined(await queue.getJob(jobId)).waitUntilFinished(
        queueEvents,
        WAIT_TIMEOUT_MS,
      ),
    ).resolves.toMatchObject({ checksum: RETRY_CHECKSUM });
    await scheduler.runOnce();
    expect((await exportRow(jobId)).status).toBe("completed");
  });

  it("records the new attempt's failure reason when the retried attempt fails", async () => {
    const jobId = TEST_IDS.pdfJob1;
    const job = await durableFailedExport(jobId);
    await waitForCondition(() => expect(lastFailure).toBeDefined());
    const stale = expectDefined(lastFailure);

    processBehavior = () => Promise.reject(new Error(SECOND_ATTEMPT_ERROR));
    const result = await jobsService.retryFailed({
      queue: QUEUE_NAME,
      jobId,
    });
    expect(result).toEqual({ retried: true, jobId });

    // Attempt B really fails; BullMQ records its failedReason.
    await expect(
      job.waitUntilFinished(queueEvents, WAIT_TIMEOUT_MS),
    ).rejects.toThrow(SECOND_ATTEMPT_ERROR);

    // Only now does the stale attempt-A callback land: its loader re-reads
    // the job under the row lock and must stamp B's reason, not the error the
    // event captured before the retry.
    const reconcile = vi.spyOn(pdfService, "reconcileTerminalState");
    emitDelayedFailure(stale.job, stale.error);
    expect(await awaitEmittedReconcile(reconcile)).toBe(true);

    const row = await exportRow(jobId);
    expect(row.status).toBe("failed");
    expect(row.error).toBe(SECOND_ATTEMPT_ERROR);

    // Scheduler reconciliation afterwards is a no-op on the failed row.
    await scheduler.runOnce();
    expect(await exportRow(jobId)).toEqual(row);
  });

  it("rolls the durable revival back when the real queue retry rejects", async () => {
    const jobId = TEST_IDS.pdfJob1;
    await durableFailedExport(jobId);
    const before = await exportRow(jobId);

    // The test's own queue job is removed between isFailed() and retry()
    // inside the row lock, so the real BullMQ Job.retry() rejects on the
    // missing key; the Postgres revival rolls back with it.
    const racingQueue = queueWithPatchedJob((job) => {
      const realRetry = job.retry.bind(job);
      job.retry = async () => {
        await job.remove();
        return realRetry();
      };
    });

    await expect(
      jobsServiceOver(racingQueue).retryFailed({
        queue: QUEUE_NAME,
        jobId,
      }),
    ).rejects.toThrow();

    // Every column of the durable row — status, error, timestamps and
    // provenance — is exactly what it was before the rejected retry.
    expect(await exportRow(jobId)).toEqual(before);
    await expect(queue.getJob(jobId)).resolves.toBeUndefined();
  });

  it("declines a retry whose payload jobId differs from the queue job id", async () => {
    const jobId = TEST_IDS.pdfJob1;
    await createDurableExport(jobId);
    await repo.markExportFailed(jobId, FIRST_ATTEMPT_ERROR);
    const before = await exportRow(jobId);
    const alienJobId = randomUUID();
    await enqueueFailedExport(
      {
        jobId: alienJobId,
        reportId: testData.report.id,
        requestedBy: testData.head.id,
      },
      jobId,
    );

    const result = await jobsService.retryFailed({
      queue: QUEUE_NAME,
      jobId,
    });
    expect(result).toEqual({
      retried: false,
      jobId,
      reason: "PDF export payload identity is missing or mismatched.",
    });

    // No queue retry and no durable write: queue still failed, row identical.
    expect(await expectDefined(await queue.getJob(jobId)).getState()).toBe(
      "failed",
    );
    expect(processCalls).toBe(1);
    expect(await exportRow(jobId)).toEqual(before);
    await expect(
      prisma.pdfExportJob.findUnique({ where: { id: alienJobId } }),
    ).resolves.toBeNull();
  });

  it("declines a retry whose payload reportId differs from the durable row", async () => {
    const jobId = TEST_IDS.pdfJob1;
    await createDurableExport(jobId);
    await repo.markExportFailed(jobId, FIRST_ATTEMPT_ERROR);
    const before = await exportRow(jobId);
    await enqueueFailedExport({
      jobId,
      reportId: randomUUID(),
      requestedBy: testData.head.id,
    });

    const result = await jobsService.retryFailed({
      queue: QUEUE_NAME,
      jobId,
    });
    expect(result).toEqual({
      retried: false,
      jobId,
      reason:
        "PDF export row is missing, not failed, or bound to another payload.",
    });

    expect(await expectDefined(await queue.getJob(jobId)).getState()).toBe(
      "failed",
    );
    expect(processCalls).toBe(1);
    expect(await exportRow(jobId)).toEqual(before);
  });

  it("declines a retry whose payload requester differs from the durable row", async () => {
    const jobId = TEST_IDS.pdfJob1;
    await createDurableExport(jobId);
    await repo.markExportFailed(jobId, FIRST_ATTEMPT_ERROR);
    const before = await exportRow(jobId);
    await enqueueFailedExport({
      jobId,
      reportId: testData.report.id,
      requestedBy: randomUUID(),
    });

    const result = await jobsService.retryFailed({
      queue: QUEUE_NAME,
      jobId,
    });
    expect(result).toEqual({
      retried: false,
      jobId,
      reason:
        "PDF export row is missing, not failed, or bound to another payload.",
    });

    expect(await expectDefined(await queue.getJob(jobId)).getState()).toBe(
      "failed",
    );
    expect(processCalls).toBe(1);
    expect(await exportRow(jobId)).toEqual(before);
  });
});
