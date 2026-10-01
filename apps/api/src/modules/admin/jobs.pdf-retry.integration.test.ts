import { randomUUID } from "node:crypto";

import {
  PDF_EXPORT_QUEUE_NAME,
  publishedReportSnapshotSchema,
  QUEUE_NAMES,
  type QueueName,
} from "@customreport/shared";
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

import { assertE2eRuntimeDestructiveTarget } from "../../../../../prisma/guards/_destructive-guard.js";
import { AdminBullmqJobsQueue } from "../../infrastructure/bullmq/admin-jobs-queue.adapter.js";
import { getBullMQOptions } from "../../infrastructure/bullmq/bullmq-options";
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
import type { AdminPdfExportRetryOutcome } from "./admin-jobs.port.js";
import { JobsService } from "./jobs.service";

// Real Postgres + BullMQ proof for the generation-bound pdf-export retry: the
// durable row lock, the generation advance, and the fresh generation-scoped
// enqueue all run against the actual adapters. The Worker only returns or
// throws metadata — rendering, browsers and providers are out of scope for
// state verification. Stale-worker reconciliation races are covered by the
// pdf-export module's own integration suite.
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

type RetrySeam = (input: {
  jobId: string;
  expectedGeneration: number;
}) => Promise<AdminPdfExportRetryOutcome>;

const queueJobId = (jobId: string, generation: number): string =>
  `${jobId}-g${generation}`;

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

describe("JobsService — pdf-export generation retry (Postgres + BullMQ integration)", () => {
  const prisma = createTestPrisma();

  let testData: Awaited<ReturnType<typeof seedTestData>>;
  let queue: Queue<unknown, unknown>;
  let queueEvents: QueueEvents;
  let worker: Worker<unknown, unknown>;
  let processBehavior: (job: PdfJob) => Promise<unknown>;
  let processCalls: number;

  let repo: PdfExportPrismaRepository;
  let enqueuer: PdfExportBullmqEnqueuer;
  let pdfService: PdfExportService;
  let scheduler: PdfExportReconciliationScheduler;
  let jobsService: JobsService;
  let retrySpy: ReturnType<typeof vi.fn<RetrySeam>>;

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

    await queueEvents.waitUntilReady();
    await worker.waitUntilReady();

    repo = new PdfExportPrismaRepository(prisma as unknown as PrismaService);
    enqueuer = new PdfExportBullmqEnqueuer(queue);
    pdfService = new PdfExportService(
      repo,
      createNullLogger(),
      enqueuer,
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
    retrySpy = vi.fn<RetrySeam>((input) =>
      pdfService.retryExportGeneration(input),
    );
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
        retryPdfExportGeneration: retrySpy,
        // Same DB-backed read the bootstrap wires — quarantined rows never
        // require a live Redis job.
        listPdfRecoveryJobs: async () => {
          const rows = await prisma.pdfExportJob.findMany({
            where: { status: "recovery_required" },
            orderBy: { createdAt: "asc" },
          });
          return rows.map((row) => ({
            jobId: row.id,
            reportId: row.reportId,
            generation: row.generation,
            requestedBy: row.requestedBy,
            status: "recovery_required" as const,
            createdAt: row.createdAt,
          }));
        },
      },
      createNullLogger(),
    );
  }

  async function createDurableExport(
    jobId: string,
    generation = 1,
  ): Promise<void> {
    await repo.createExportJob(
      {
        jobId,
        reportId: testData.report.id,
        status: "queued",
        generation,
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

  // One controlled attempt at a generation: the worker throws, BullMQ marks
  // the `${jobId}-g${generation}` job failed, and waitUntilFinished settles it
  // deterministically.
  async function enqueueFailedExport(
    payload: {
      jobId: string;
      reportId: string;
      requestedBy: string;
      generation: number;
    },
    queueId = queueJobId(payload.jobId, payload.generation),
  ): Promise<PdfJob> {
    const job = await queue.add("generate", payload, {
      jobId: queueId,
      attempts: 1,
    });
    await expect(
      job.waitUntilFinished(queueEvents, WAIT_TIMEOUT_MS),
    ).rejects.toThrow(FIRST_ATTEMPT_ERROR);
    return job;
  }

  // The full precondition the admin retry acts on: a durable failed row at
  // generation g that real reconciliation wrote from the real failed
  // generation-scoped queue job.
  async function durableFailedExport(
    jobId: string,
    generation = 1,
  ): Promise<PdfJob> {
    await createDurableExport(jobId, generation);
    const job = await enqueueFailedExport({
      jobId,
      reportId: testData.report.id,
      requestedBy: testData.head.id,
      generation,
    });
    await scheduler.runOnce();
    const row = await exportRow(jobId);
    expect(row.status).toBe("failed");
    expect(row.generation).toBe(generation);
    expect(row.error).toBe(FIRST_ATTEMPT_ERROR);
    return job;
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

  it("advances the failed row exactly one generation and completes through the fresh queue job", async () => {
    const jobId = TEST_IDS.pdfJob1;
    await durableFailedExport(jobId);
    const before = await exportRow(jobId);
    expect(before.publicationGroupIds).toEqual([TEST_IDS.group]);

    // Paused worker: the fresh generation job stays waiting so the case
    // measures the retry transition, not worker timing.
    await worker.pause();

    const result = await jobsService.retryFailed({
      queue: QUEUE_NAME,
      jobId: queueJobId(jobId, 1),
    });

    expect(result).toEqual({ retried: true, jobId: queueJobId(jobId, 1) });
    expect(retrySpy).toHaveBeenCalledWith({
      jobId,
      expectedGeneration: 1,
    });

    // The advance wrote a new pending row generation and enqueued only the
    // fresh `${jobId}-g2` job; the superseded g1 entry is removed from the
    // failed list and the job is never retried in place.
    const revived = await exportRow(jobId);
    expect(revived.status).toBe("pending");
    expect(revived.generation).toBe(2);
    expect(revived.filePath).toBeNull();
    expect(revived.checksum).toBeNull();
    expect(revived.error).toBeNull();
    expect(publicationProjection(revived)).toEqual(
      publicationProjection(before),
    );

    await expect(queue.getJob(queueJobId(jobId, 1))).resolves.toBeUndefined();
    const g2 = expectDefined(await queue.getJob(queueJobId(jobId, 2)));
    expect(await g2.getState()).toBe("waiting");
    // The fresh attempt carries the durable row's identity plus its own
    // generation — it is a new queue entry, not a requeued stale one.
    expect(g2.data).toMatchObject({
      jobId,
      reportId: testData.report.id,
      requestedBy: testData.head.id,
      generation: 2,
    });

    processBehavior = completeWithArtifact(jobId);
    await worker.resume();
    await expect(
      g2.waitUntilFinished(queueEvents, WAIT_TIMEOUT_MS),
    ).resolves.toMatchObject({ checksum: RETRY_CHECKSUM });
    await scheduler.runOnce();

    // One worker invocation failed g1; exactly one more ran for g2 — the
    // retry never re-executes the retained generation.
    expect(processCalls).toBe(2);

    const after = await exportRow(jobId);
    expect(after).toMatchObject({
      status: "completed",
      generation: 2,
      filePath: `/pdfs/${jobId}.pdf`,
      checksum: RETRY_CHECKSUM,
      error: null,
    });
    expect(publicationProjection(after)).toEqual(publicationProjection(before));

    // Re-running terminal reconciliation writes nothing: the completed row
    // is not "pending", so the entire row — updatedAt included — is identical.
    await scheduler.runOnce();
    expect(await exportRow(jobId)).toEqual(after);
  });

  it("settles two concurrent retries on the same retained entry into exactly one advance", async () => {
    const jobId = TEST_IDS.pdfJob1;
    await durableFailedExport(jobId);
    await worker.pause();

    // The first request's enqueue — issued inside the export row lock —
    // blocks on a barrier, so the second request is issued while the first
    // demonstrably holds the transition.
    const hold = barrier();
    let armed = true;
    const realEnqueue = enqueuer.enqueue;
    vi.spyOn(enqueuer, "enqueue").mockImplementation(async (input, context) => {
      if (!armed) {
        return realEnqueue(input, context);
      }
      armed = false;
      hold.signal();
      await hold.gate;
      return realEnqueue(input, context);
    });

    const firstPromise = jobsService.retryFailed({
      queue: QUEUE_NAME,
      jobId: queueJobId(jobId, 1),
    });
    let secondPromise: ReturnType<JobsService["retryFailed"]> | undefined;
    try {
      // Bounded entry check: a timeout rejects here — it never releases the
      // gate as if the intended ordering had happened.
      await waitForCondition(() => expect(hold.isEntered()).toBe(true));
      secondPromise = jobsService.retryFailed({
        queue: QUEUE_NAME,
        jobId: queueJobId(jobId, 1),
      });
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

    // Exactly one request advances the row. The loser blocks on the winner's
    // dispatch lock, then reads the committed pending(g2) row: the seam
    // reports already-advanced for the stale expectedGeneration and the
    // service maps that idempotent repeat to retried:true — the retained g1
    // entry never produces a second g2 dispatch.
    expect(firstResult).toEqual({
      retried: true,
      jobId: queueJobId(jobId, 1),
    });
    expect(secondResult).toEqual({
      retried: true,
      jobId: queueJobId(jobId, 1),
    });
    expect(retrySpy).toHaveBeenCalledTimes(2);
    expect(await exportRow(jobId)).toMatchObject({
      status: "pending",
      generation: 2,
    });
    expect(
      await expectDefined(await queue.getJob(queueJobId(jobId, 2))).getState(),
    ).toBe("waiting");
    await expect(queue.getJob(queueJobId(jobId, 3))).resolves.toBeUndefined();
  });

  it("a retained g1 entry cannot advance a row already failed at g2", async () => {
    const jobId = TEST_IDS.pdfJob1;
    await durableFailedExport(jobId);

    // Advance to g2, then fail that attempt as well: Redis now retains two
    // failed entries — `${jobId}-g1` and `${jobId}-g2` — while the row is
    // failed(2). The fresh g2 job still carries the production 3-attempt /
    // 5s+10s exponential backoff policy; UnrecoverableError is the
    // worker-side terminal-failure signal that settles it on the first run,
    // so the wait below never rides the backoff schedule.
    processBehavior = () =>
      Promise.reject(new UnrecoverableError(SECOND_ATTEMPT_ERROR));
    await expect(
      jobsService.retryFailed({
        queue: QUEUE_NAME,
        jobId: queueJobId(jobId, 1),
      }),
    ).resolves.toEqual({ retried: true, jobId: queueJobId(jobId, 1) });
    await expect(
      expectDefined(await queue.getJob(queueJobId(jobId, 2))).waitUntilFinished(
        queueEvents,
        WAIT_TIMEOUT_MS,
      ),
    ).rejects.toThrow(SECOND_ATTEMPT_ERROR);
    await scheduler.runOnce();
    const failedAtG2 = await exportRow(jobId);
    expect(failedAtG2).toMatchObject({
      status: "failed",
      generation: 2,
      error: SECOND_ATTEMPT_ERROR,
    });

    // The superseded generation-1 entry was removed when g2 was dispatched,
    // so retrying its identity finds no queue entry — no write, no g3
    // dispatch. The locked-transition guard for a stale entry is covered by
    // the jobs.service unit tests.
    await expect(queue.getJob(queueJobId(jobId, 1))).resolves.toBeUndefined();
    await expect(
      jobsService.retryFailed({
        queue: QUEUE_NAME,
        jobId: queueJobId(jobId, 1),
      }),
    ).resolves.toEqual({ retried: false, jobId: queueJobId(jobId, 1) });
    expect(await exportRow(jobId)).toEqual(failedAtG2);
    await expect(queue.getJob(queueJobId(jobId, 3))).resolves.toBeUndefined();

    // The current generation's retained entry is the eligible one.
    await worker.pause();
    await expect(
      jobsService.retryFailed({
        queue: QUEUE_NAME,
        jobId: queueJobId(jobId, 2),
      }),
    ).resolves.toEqual({ retried: true, jobId: queueJobId(jobId, 2) });
    expect(await exportRow(jobId)).toMatchObject({
      status: "pending",
      generation: 3,
    });
    expect(
      await expectDefined(await queue.getJob(queueJobId(jobId, 3))).getState(),
    ).toBe("waiting");
  });

  it("a repeat of the same selected generation is an idempotent no-op", async () => {
    const jobId = TEST_IDS.pdfJob1;
    await durableFailedExport(jobId);
    await worker.pause();

    await expect(
      jobsService.retryFailed({
        queue: QUEUE_NAME,
        jobId: queueJobId(jobId, 1),
      }),
    ).resolves.toEqual({ retried: true, jobId: queueJobId(jobId, 1) });

    // The superseded g1 entry is gone, so a repeated UI request is the
    // structured no-op for a pruned job and dispatches nothing.
    await expect(
      jobsService.retryFailed({
        queue: QUEUE_NAME,
        jobId: queueJobId(jobId, 1),
      }),
    ).resolves.toEqual({ retried: false, jobId: queueJobId(jobId, 1) });

    const row = await exportRow(jobId);
    expect(row).toMatchObject({ status: "pending", generation: 2 });
    // Still exactly one fresh dispatch — the repeat added nothing.
    await expect(queue.getJob(queueJobId(jobId, 3))).resolves.toBeUndefined();
    expect(
      await expectDefined(await queue.getJob(queueJobId(jobId, 2))).getState(),
    ).toBe("waiting");
  });

  it("lists and retries quarantined exports with no Redis job at all", async () => {
    const jobId = TEST_IDS.pdfJob1;
    // A pending(g1) row whose queue job never existed — the exact orphan
    // shape the scan quarantines.
    await createDurableExport(jobId, 1);
    await repo.runLockedExportJob(jobId, async (job, writes) => {
      await writes.markRecoveryRequired(expectDefined(job).generation);
    });
    await expect(queue.getJob(queueJobId(jobId, 1))).resolves.toBeUndefined();

    const listed = await jobsService.listPdfRecovery();
    expect(listed.jobs).toHaveLength(1);
    expect(listed.jobs[0]).toMatchObject({
      jobId,
      reportId: testData.report.id,
      generation: 1,
      requestedBy: testData.head.id,
      status: "recovery_required",
    });

    await worker.pause();
    const result = await jobsService.retryPdfRecovery({
      jobId,
      expectedGeneration: 1,
    });

    expect(result).toEqual({ jobId, outcome: "retried" });
    expect(retrySpy).toHaveBeenCalledWith({
      jobId,
      expectedGeneration: 1,
    });
    expect(await exportRow(jobId)).toMatchObject({
      status: "pending",
      generation: 2,
    });
    expect(
      await expectDefined(await queue.getJob(queueJobId(jobId, 2))).getState(),
    ).toBe("waiting");
    await expect(jobsService.listPdfRecovery()).resolves.toEqual({
      jobs: [],
    });
  });

  it("commits the generation advance even when the fresh enqueue fails", async () => {
    const jobId = TEST_IDS.pdfJob1;
    await durableFailedExport(jobId);

    // The queue add inside the dispatch leg rejects: the committed
    // pending(g2) row stays — it is exactly the orphan the scan quarantines
    // for the recovery surface. Nothing falls back to an in-place retry.
    vi.spyOn(enqueuer, "enqueue").mockRejectedValueOnce(
      new Error("redis add lost"),
    );

    await expect(
      jobsService.retryFailed({
        queue: QUEUE_NAME,
        jobId: queueJobId(jobId, 1),
      }),
    ).rejects.toThrow("redis add lost");

    const row = await exportRow(jobId);
    expect(row).toMatchObject({
      status: "pending",
      generation: 2,
      filePath: null,
      checksum: null,
    });
    await expect(queue.getJob(queueJobId(jobId, 2))).resolves.toBeUndefined();
  });

  it("declines a retained entry whose payload jobId disagrees with its queue id", async () => {
    const jobId = TEST_IDS.pdfJob1;
    await createDurableExport(jobId);
    await repo.markExportFailed(jobId, 1, FIRST_ATTEMPT_ERROR);
    const before = await exportRow(jobId);
    const alienJobId = randomUUID();
    // The queue id claims `${jobId}-g1` while the payload names a different
    // durable jobId — the adapter-side binding rejects it before the seam.
    await enqueueFailedExport(
      {
        jobId: alienJobId,
        reportId: testData.report.id,
        requestedBy: testData.head.id,
        generation: 1,
      },
      queueJobId(jobId, 1),
    );

    const result = await jobsService.retryFailed({
      queue: QUEUE_NAME,
      jobId: queueJobId(jobId, 1),
    });
    expect(result).toEqual({
      retried: false,
      jobId: queueJobId(jobId, 1),
      reason: "PDF export payload identity is missing or mismatched.",
    });

    // No seam call, no durable write, no queue mutation.
    expect(retrySpy).not.toHaveBeenCalled();
    expect(
      await expectDefined(await queue.getJob(queueJobId(jobId, 1))).getState(),
    ).toBe("failed");
    expect(processCalls).toBe(1);
    expect(await exportRow(jobId)).toEqual(before);
    await expect(
      prisma.pdfExportJob.findUnique({ where: { id: alienJobId } }),
    ).resolves.toBeNull();
  });

  it("declines a legacy bare-id queue entry even when its payload is well-formed", async () => {
    const jobId = TEST_IDS.pdfJob1;
    await createDurableExport(jobId);
    await repo.markExportFailed(jobId, 1, FIRST_ATTEMPT_ERROR);
    const before = await exportRow(jobId);
    // Pre-protocol entries carry the bare durable id — they are inert
    // residue and must never drive a retry.
    await enqueueFailedExport(
      {
        jobId,
        reportId: testData.report.id,
        requestedBy: testData.head.id,
        generation: 1,
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

    expect(retrySpy).not.toHaveBeenCalled();
    expect(await expectDefined(await queue.getJob(jobId)).getState()).toBe(
      "failed",
    );
    expect(await exportRow(jobId)).toEqual(before);
  });

  it("the fresh generation job carries the durable row's identity, not a poisoned payload's", async () => {
    const jobId = TEST_IDS.pdfJob1;
    await durableFailedExport(jobId);
    const before = await exportRow(jobId);

    // A tampered retained payload can claim any reportId/requestedBy — the
    // retry binds only the caller-selected generation, and the fresh
    // dispatch is built from the durable row.
    const g1 = expectDefined(await queue.getJob(queueJobId(jobId, 1)));
    await g1.updateData({
      jobId,
      reportId: randomUUID(),
      requestedBy: randomUUID(),
      generation: 1,
    });
    await worker.pause();

    await expect(
      jobsService.retryFailed({
        queue: QUEUE_NAME,
        jobId: queueJobId(jobId, 1),
      }),
    ).resolves.toEqual({ retried: true, jobId: queueJobId(jobId, 1) });

    const g2 = expectDefined(await queue.getJob(queueJobId(jobId, 2)));
    expect(g2.data).toMatchObject({
      jobId,
      reportId: testData.report.id,
      requestedBy: testData.head.id,
      generation: 2,
    });
    const after = await exportRow(jobId);
    expect(after.status).toBe("pending");
    expect(after.generation).toBe(2);
    expect(publicationProjection(after)).toEqual(publicationProjection(before));
  });
});
