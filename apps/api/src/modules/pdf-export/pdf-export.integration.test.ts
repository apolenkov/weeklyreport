import { randomUUID } from "node:crypto";

import type { UserSession } from "@weeklyreport/shared";
import {
  PDF_EXPORT_QUEUE_NAME,
  publishedReportSnapshotSchema,
  type QueueName,
} from "@weeklyreport/shared";
import { Queue } from "bullmq";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  assertE2eRuntimeDestructiveTarget,
  assertRedisDbMatchesDatabase,
} from "../../../../../prisma/guards/_destructive-guard.js";
import { getBullMQOptions } from "../../infrastructure/bullmq/bullmq-options";
import { PdfExportReconciliationScheduler } from "../../infrastructure/bullmq/pdf-export-reconciliation.scheduler.js";
import type { EnvConfig } from "../../infrastructure/config/env.schema";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { requireEnv } from "../../lib/env";
import { type AppLogger, createNullLogger } from "../../lib/logger.js";
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
import type { PdfExportEnqueuer } from "./pdf-export.ports";
import { PdfExportPrismaRepository } from "./pdf-export.prisma-repository";
import { PdfExportService } from "./pdf-export.service";
import { PdfExportBullmqEnqueuer } from "./pdf-export-bullmq-enqueuer.adapter.js";

describe("PdfExportPrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  let repo: PdfExportPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(() => {
    repo = new PdfExportPrismaRepository(prisma as unknown as PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase();
  });

  it("createExportJob creates and returns job", async () => {
    const job = {
      jobId: TEST_IDS.pdfJob1,
      reportId: testData.report.id,
      status: "queued" as const,
      generation: 1,
      requestedAt: new Date(),
      completedAt: null,
      checksum: null,
      templateVersion: "phase-2-pdf-v1",
      artifactUrl: null,
    };

    const created = await repo.createExportJob(
      job,
      testData.head.id,
      publishedReportSnapshotSchema.parse(
        publishedSnapshotFixture({
          reportId: testData.report.id,
          periodStart: testData.report.periodStart,
          periodEnd: testData.report.periodEnd,
          deadline: testData.report.deadline,
          publishedAt: testData.report.publishedAt ?? new Date(),
        }),
      ),
    );

    expect(created.jobId).toBe(TEST_IDS.pdfJob1);
    expect(created.reportId).toBe(testData.report.id);
    expect(created.status).toBe("queued");

    const dbJob = await prisma.pdfExportJob.findUnique({
      where: { id: TEST_IDS.pdfJob1 },
    });
    expect(dbJob).not.toBeNull();
    expect(expectDefined(dbJob).status).toBe("pending"); // domain "queued" maps to DB "pending"
  });

  it("saveExportJob updates status and filePath", async () => {
    await repo.createExportJob(
      {
        jobId: TEST_IDS.pdfJob2,
        reportId: testData.report.id,
        status: "queued" as const,
        generation: 1,
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
        }),
      ),
    );

    const completedChecksum = "sha256:deadbeef";
    const completedArtifactUrl = `/pdfs/${TEST_IDS.pdfJob2}.pdf`;
    const updated = await repo.saveExportJob({
      jobId: TEST_IDS.pdfJob2,
      reportId: testData.report.id,
      status: "completed" as const,
      generation: 1,
      requestedAt: new Date(),
      completedAt: new Date(),
      checksum: completedChecksum,
      templateVersion: "phase-2-pdf-v1",
      artifactUrl: completedArtifactUrl,
    });

    expect(updated.status).toBe("completed");
    expect(updated.artifactUrl).toBe(completedArtifactUrl);
    expect(updated.checksum).toBe(completedChecksum);

    const dbJob = await prisma.pdfExportJob.findUnique({
      where: { id: TEST_IDS.pdfJob2 },
    });
    expect(expectDefined(dbJob).status).toBe("completed");
    expect(expectDefined(dbJob).filePath).toBe(completedArtifactUrl);
    expect(expectDefined(dbJob).checksum).toBe(completedChecksum);

    // The checksum round-trips through a fresh read, not just the write path.
    const reread = await repo.getExportJob(TEST_IDS.pdfJob2);
    expect(expectDefined(reread).checksum).toBe(completedChecksum);
  });

  // These are the cases the unit fakes can only approximate: the real
  // SELECT … FOR UPDATE wait, the real rollback, and the real row contents.
  describe("runLockedExportJob (real row lock)", () => {
    async function createFailedExportJob(jobId: string): Promise<void> {
      await repo.createExportJob(
        {
          jobId,
          reportId: testData.report.id,
          status: "queued" as const,
          generation: 1,
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
          }),
        ),
      );
      await repo.markExportFailed(jobId, 1, "terminal failure");
    }

    it("serializes a generation advance against another lock holder on the same row", async () => {
      await createFailedExportJob(TEST_IDS.pdfJob1);

      const events: string[] = [];
      await Promise.all([
        repo.runLockedExportJob(TEST_IDS.pdfJob1, async (job, writes) => {
          events.push(
            `first:saw:${job?.status ?? "missing"}:g${job?.generation ?? "-"}`,
          );
          await writes.advanceGeneration(1);
          // Hold the lock long enough for the second holder to queue behind it.
          await new Promise((resolve) => setTimeout(resolve, 50));
          events.push("first:released");
        }),
        (async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          await repo.runLockedExportJob(TEST_IDS.pdfJob1, (job) => {
            events.push(
              `second:saw:${job?.status ?? "missing"}:g${job?.generation ?? "-"}`,
            );
            return Promise.resolve();
          });
        })(),
      ]);

      // The second holder's FOR UPDATE blocked until the first transaction
      // committed, so it reads the advanced pending(g2) row — never the old
      // failed(g1) one.
      expect(events).toEqual([
        "first:saw:failed:g1",
        "first:released",
        "second:saw:queued:g2",
      ]);
    });

    it("rolls back the locked generation advance when the callback rejects", async () => {
      await createFailedExportJob(TEST_IDS.pdfJob1);

      await expect(
        repo.runLockedExportJob(TEST_IDS.pdfJob1, async (_job, writes) => {
          await writes.advanceGeneration(1);
          throw new Error("generation dispatch acknowledgement lost");
        }),
      ).rejects.toThrow("generation dispatch acknowledgement lost");

      // The uncertain enqueue left no trace: the durable row is still
      // failed(1) with its original error, not half-advanced and not
      // compensated.
      const dbRow = await prisma.pdfExportJob.findUnique({
        where: { id: TEST_IDS.pdfJob1 },
      });
      expect(dbRow).toMatchObject({
        status: "failed",
        generation: 1,
        error: "terminal failure",
      });
    });

    it("advances only lifecycle fields and lets the retried export complete", async () => {
      await createFailedExportJob(TEST_IDS.pdfJob2);
      const before = expectDefined(
        await prisma.pdfExportJob.findUnique({
          where: { id: TEST_IDS.pdfJob2 },
        }),
      );

      const enqueuer: PdfExportEnqueuer = {
        enqueue: vi
          .fn<PdfExportEnqueuer["enqueue"]>()
          .mockResolvedValue(undefined),
      };
      const service = new PdfExportService(
        repo,
        createNullLogger(),
        enqueuer,
        NOOP_PDF_EXPORT_TELEMETRY,
        {
          PDF_BASE_URL: "http://localhost:3000",
          PDF_EXPORT_JWT_SECRET: "test-pdf-export-secret-at-least-32-chars",
        },
      );

      const outcome = await service.retryExportGeneration({
        jobId: TEST_IDS.pdfJob2,
        expectedGeneration: 1,
      });

      expect(outcome).toBe("retried");
      // The transition dispatches a fresh generation-scoped job built from
      // the durable row — never an in-place retry of a retained entry.
      expect(enqueuer.enqueue).toHaveBeenCalledTimes(1);
      expect(enqueuer.enqueue).toHaveBeenCalledWith(
        {
          jobId: TEST_IDS.pdfJob2,
          reportId: testData.report.id,
          generation: 2,
          requestedBy: testData.head.id,
        },
        {},
      );

      const advanced = expectDefined(
        await prisma.pdfExportJob.findUnique({
          where: { id: TEST_IDS.pdfJob2 },
        }),
      );
      expect(advanced).toMatchObject({
        status: "pending",
        generation: 2,
        filePath: null,
        checksum: null,
        error: null,
      });
      // Publication, requester, and template provenance are immutable.
      expect(advanced.reportId).toBe(testData.report.id);
      expect(advanced.requestedBy).toBe(testData.head.id);
      expect(advanced.templateVersion).toBe("phase-2-pdf-v1");
      expect(advanced.publicationAt.getTime()).toBe(
        before.publicationAt.getTime(),
      );
      expect(advanced.publicationSnapshot).toEqual(before.publicationSnapshot);

      // The advanced pending row is what lets the new generation's
      // completion CAS and terminal handling run unchanged.
      const completed = await repo.saveExportJob({
        jobId: TEST_IDS.pdfJob2,
        reportId: testData.report.id,
        status: "completed",
        generation: 2,
        requestedAt: new Date(),
        completedAt: new Date(),
        checksum: "sha-256-retry",
        templateVersion: "phase-2-pdf-v1",
        artifactUrl: `/pdfs/${TEST_IDS.pdfJob2}.pdf`,
      });
      expect(completed.status).toBe("completed");
    });
  });
});

// Verify queued export identity through the service and real Prisma repository.
describe("PDF enqueue — service against real Prisma repo", () => {
  const prisma = createTestPrisma();
  let repo: PdfExportPrismaRepository;

  async function publishReportFixture(
    testData: Awaited<ReturnType<typeof seedTestData>>,
  ): Promise<void> {
    const publishedAt = new Date("2026-04-15T10:00:00.000Z");
    const sectionOwner = {
      reportSectionId: testData.section.id,
      authorId: testData.lead.id,
      authorName: testData.lead.name,
      groupId: TEST_IDS.group,
      groupName: "Test Group",
    };

    await prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: testData.report.id },
        data: {
          status: "published",
          periodStatus: "published",
          periodState: "published",
          publishedAt,
          publishedById: testData.head.id,
          publishedSnapshot: publishedSnapshotFixture({
            reportId: testData.report.id,
            periodStart: testData.report.periodStart,
            periodEnd: testData.report.periodEnd,
            publishedAt,
            publishedById: testData.head.id,
            sectionOwners: [sectionOwner],
          }),
        },
      });
      await tx.publishedSectionScope.createMany({
        data: [
          {
            reportId: testData.report.id,
            reportSectionId: sectionOwner.reportSectionId,
            authorId: sectionOwner.authorId,
            groupId: sectionOwner.groupId,
          },
        ],
      });
    });
  }

  beforeAll(() => {
    repo = new PdfExportPrismaRepository(prisma as unknown as PrismaService);
  });

  beforeEach(async () => {
    await cleanDatabase();
    vi.stubEnv("AUTH_DEV_MODE", "false");
    vi.stubEnv("AUTH_DEV_MODE_ALLOW_TEST", "true");
    vi.stubEnv(
      "PDF_EXPORT_JWT_SECRET",
      "integration-test-secret-32-chars-or-more",
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    try {
      await cleanDatabase();
    } finally {
      await disconnectTestPrisma();
    }
  });

  it("enqueues non-credential identifiers bound to the requester for a published report", async () => {
    const testData = await seedTestData(prisma);
    await publishReportFixture(testData);

    interface EnqueuedJob {
      reportId: string;
      jobId: string;
      generation: number;
      requestedBy: string;
    }
    const enqueued: EnqueuedJob[] = [];
    const fakeQueue = {
      enqueue: (data: EnqueuedJob) => {
        enqueued.push(data);
        return Promise.resolve();
      },
    } as unknown as PdfExportEnqueuer;

    const service = new PdfExportService(
      repo,
      createNullLogger(),
      fakeQueue,
      NOOP_PDF_EXPORT_TELEMETRY,
      {
        PDF_BASE_URL: "http://localhost:3000",
        PDF_EXPORT_JWT_SECRET: "test-pdf-export-secret-at-least-32-chars",
      },
    );
    const session: UserSession = {
      userId: testData.head.id,
      email: testData.head.email,
      name: testData.head.name,
      role: testData.head.role,
      activeReportId: testData.report.id,
      activeReportSectionId: null,
      reportingGroupId: testData.head.reportingGroupId ?? undefined,
    };
    await service.requestPdfExport(testData.report.id, session);

    expect(enqueued).toHaveLength(1);
    expect(expectDefined(enqueued[0]).reportId).toBe(testData.report.id);
    expect(expectDefined(enqueued[0]).jobId).toBeTypeOf("string");
    // A fresh export is always dispatched bound to generation 1.
    expect(expectDefined(enqueued[0]).generation).toBe(1);
    // The durable payload must not carry a bearer credential — the worker
    // mints the short-lived render token from this identity at execution time.
    expect(expectDefined(enqueued[0]).requestedBy).toBe(testData.head.id);
    const serialized = JSON.stringify(enqueued[0]);
    expect(serialized).not.toContain("authToken");
    expect(serialized).not.toMatch(/eyJ/);
  });

  it("rejects a published report outside the caller's group before enqueue", async () => {
    const testData = await seedTestData(prisma);
    await publishReportFixture(testData);
    const otherGroup = await prisma.reportingGroup.create({
      data: {
        name: "Other Group",
        description: "Outside the report scope",
      },
    });
    const otherHead = await prisma.user.create({
      data: {
        email: "other-head@test.local",
        name: "Other Head",
        lastName: "Other",
        firstName: "Head",
        role: "head",
        samlId: "other-head-test",
        reportingGroupId: otherGroup.id,
      },
    });
    const session: UserSession = {
      userId: otherHead.id,
      email: otherHead.email,
      name: otherHead.name,
      role: otherHead.role,
      activeReportId: testData.report.id,
      activeReportSectionId: null,
      reportingGroupId: otherGroup.id,
    };
    const queue = { enqueue: vi.fn() };
    const service = new PdfExportService(
      repo,
      createNullLogger(),
      queue,
      NOOP_PDF_EXPORT_TELEMETRY,
      {
        PDF_BASE_URL: "http://localhost:3000",
        PDF_EXPORT_JWT_SECRET: "test-pdf-export-secret-at-least-32-chars",
      },
    );

    await expect(
      service.requestPdfExport(testData.report.id, session),
    ).rejects.toThrow("PDF export is not available for this caller.");
    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});

// Real Postgres + BullMQ proof for the orphan scan: the aged-pending listing,
// the FOR UPDATE recheck, the generation-scoped queue probe, and the
// recovery_required CAS all run against the actual adapters. The unit suite
// owns the fake-repository branch matrix; here the only controlled surface is
// the Date clock, frozen just for the pass so its start bound lands on a known
// instant and the exact age boundary can be exercised end to end.
describe("orphan scan (real Postgres + BullMQ)", () => {
  const QUEUE_NAME = PDF_EXPORT_QUEUE_NAME;
  const SCRIPT_NAME = "pdf-export.orphan-scan.integration";
  // Pins the 15-minute orphan threshold PDF_EXPORT_ORPHAN_MIN_AGE_MS in
  // pdf-export.recovery.ts — the exact-age boundary is a spec contract.
  const ORPHAN_MIN_AGE_MS = 900_000;
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
    const databaseUrl = requireEnv(process.env, "E2E_DATABASE_URL");
    assertE2eRuntimeDestructiveTarget(SCRIPT_NAME, databaseUrl, process.env);
    assertRedisDbMatchesDatabase(SCRIPT_NAME, databaseUrl, REDIS_ENV.REDIS_DB);
  }

  let prisma: ReturnType<typeof createTestPrisma>;
  let testData: Awaited<ReturnType<typeof seedTestData>>;
  let repo: PdfExportPrismaRepository;
  let queue: Queue<unknown, unknown>;
  let scheduler: PdfExportReconciliationScheduler;
  let logger: AppLogger;
  // Only resources actually constructed land here, so a partially failed
  // beforeEach still leaves cleanup closing exactly what exists.
  let allocated: { queue?: Queue<unknown, unknown> };

  beforeEach(async () => {
    allocated = {};
    assertSafeRedisMutation();
    // Acquired at run time, not collection: an earlier describe's afterAll
    // may already have disconnected the shared test client.
    prisma = createTestPrisma();
    await cleanDatabase();
    testData = await seedTestData(prisma);

    queue = new Queue<unknown, unknown>(QUEUE_NAME, {
      ...getBullMQOptions(REDIS_ENV),
      // A unique BullMQ prefix per case keeps obliterate scoped to the keys
      // this test created on its assigned Redis DB.
      prefix: `test-pdf-orphan-${randomUUID()}`,
    });
    allocated.queue = queue;
    await queue.waitUntilReady();

    repo = new PdfExportPrismaRepository(prisma as unknown as PrismaService);
    logger = { ...createNullLogger(), error: vi.fn() };
    const pdfService = new PdfExportService(
      repo,
      logger,
      // The real adapter: an unexpected enqueue lands a real Redis job and
      // fails the queue assertions below instead of hiding behind a stub.
      new PdfExportBullmqEnqueuer(queue),
      NOOP_PDF_EXPORT_TELEMETRY,
      PDF_EXPORT_ENV,
    );
    scheduler = new PdfExportReconciliationScheduler(pdfService, {
      get: (name: QueueName): Queue => {
        if (name !== QUEUE_NAME) {
          throw new Error(`No test queue for '${name}'`);
        }
        return queue;
      },
    });
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
    // Obliterate is the one destructive Redis call — the disposable-target
    // and Redis-DB guards must hold immediately before it, not just at setup.
    await collect(async () => {
      if (owned.queue) {
        assertSafeRedisMutation();
        await owned.queue.obliterate({ force: true });
      }
    });
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

  const queueJobId = (jobId: string, generation: number): string =>
    `${jobId}-g${generation}`;

  async function createPendingExport(jobId: string): Promise<void> {
    await repo.createExportJob(
      {
        jobId,
        reportId: testData.report.id,
        status: "queued",
        generation: 1,
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
        }),
      ),
    );
  }

  async function exportRow(jobId: string) {
    return expectDefined(
      await prisma.pdfExportJob.findUnique({ where: { id: jobId } }),
    );
  }

  // The scan's age bound reads the durable createdAt column; freshly created
  // rows carry the DB clock, so fixtures backdate it explicitly.
  async function setCreatedAt(jobId: string, createdAt: Date): Promise<void> {
    await prisma.pdfExportJob.update({
      where: { id: jobId },
      data: { createdAt },
    });
  }

  async function queueJobTotal(): Promise<number> {
    const counts = await queue.getJobCounts();
    return Object.values(counts).reduce((sum, count) => sum + count, 0);
  }

  it("quarantines aged pending rows at and beyond the exact age boundary when the queue job is confirmed absent", async () => {
    // Freezing only Date makes the pass bound an exact instant: bound =
    // fixedNow - ORPHAN_MIN_AGE_MS inside scanOrphanedPendingExports.
    const fixedNow = new Date();
    const bound = new Date(fixedNow.getTime() - ORPHAN_MIN_AGE_MS);
    const agedJobId = TEST_IDS.pdfJob1;
    const boundaryJobId = TEST_IDS.pdfJob2;
    const youngJobId = randomUUID();
    const liveJobId = randomUUID();
    await createPendingExport(agedJobId);
    await setCreatedAt(agedJobId, new Date(bound.getTime() - 1));
    await createPendingExport(boundaryJobId);
    await setCreatedAt(boundaryJobId, bound);
    await createPendingExport(youngJobId);
    await setCreatedAt(youngJobId, new Date(bound.getTime() + 1));
    await createPendingExport(liveJobId);
    await setCreatedAt(liveJobId, new Date(bound.getTime() - 60_000));

    // The live row's generation-scoped job really exists in Redis; each
    // quarantine candidate's job must be confirmed absent by the real probe.
    await queue.add(
      "generate",
      {
        jobId: liveJobId,
        reportId: testData.report.id,
        requestedBy: testData.head.id,
        generation: 1,
      },
      { jobId: queueJobId(liveJobId, 1) },
    );
    await expect(
      queue.getJob(queueJobId(agedJobId, 1)),
    ).resolves.toBeUndefined();
    await expect(
      queue.getJob(queueJobId(boundaryJobId, 1)),
    ).resolves.toBeUndefined();
    await expect(
      queue.getJob(queueJobId(youngJobId, 1)),
    ).resolves.toBeUndefined();
    await expect(queue.getJob(queueJobId(liveJobId, 1))).resolves.toBeDefined();

    // The spy records the probe's queue ids; calls still reach real Redis.
    const getJobSpy = vi.spyOn(queue, "getJob");

    vi.useFakeTimers({ toFake: ["Date"], now: fixedNow });
    try {
      await scheduler.runOnce();
      // A second pass leaves the terminal quarantine rows byte-identical.
      const agedRow = await exportRow(agedJobId);
      const boundaryRow = await exportRow(boundaryJobId);
      await scheduler.runOnce();
      expect(await exportRow(agedJobId)).toEqual(agedRow);
      expect(await exportRow(boundaryJobId)).toEqual(boundaryRow);
    } finally {
      vi.useRealTimers();
    }

    const agedRow = await exportRow(agedJobId);
    const boundaryRow = await exportRow(boundaryJobId);
    // Exactly the confirmed-absent candidates quarantine at their current
    // generation — nothing re-renders or re-enqueues them automatically.
    expect(agedRow).toMatchObject({
      status: "recovery_required",
      generation: 1,
      filePath: null,
      checksum: null,
      error: null,
    });
    expect(boundaryRow).toMatchObject({
      status: "recovery_required",
      generation: 1,
    });
    expect(await exportRow(youngJobId)).toMatchObject({
      status: "pending",
      generation: 1,
      error: null,
    });
    expect(await exportRow(liveJobId)).toMatchObject({
      status: "pending",
      generation: 1,
    });

    // The probe ran under the row lock with generation-scoped queue ids; the
    // too-young row was never even a candidate.
    expect(getJobSpy).toHaveBeenCalledWith(queueJobId(agedJobId, 1));
    expect(getJobSpy).toHaveBeenCalledWith(queueJobId(boundaryJobId, 1));
    expect(getJobSpy).toHaveBeenCalledWith(queueJobId(liveJobId, 1));
    expect(getJobSpy).not.toHaveBeenCalledWith(queueJobId(youngJobId, 1));

    // No new queue job was created: the only Redis entry is the pre-seeded
    // live one.
    await expect(
      queue.getJob(queueJobId(agedJobId, 1)),
    ).resolves.toBeUndefined();
    await expect(
      queue.getJob(queueJobId(boundaryJobId, 1)),
    ).resolves.toBeUndefined();
    expect(await queueJobTotal()).toBe(1);
    await expect(
      expectDefined(await queue.getJob(queueJobId(liveJobId, 1))).getState(),
    ).resolves.toBe("waiting");
  });

  it("leaves the aged pending row unchanged when the queue probe rejects", async () => {
    const jobId = TEST_IDS.pdfJob1;
    await createPendingExport(jobId);
    await setCreatedAt(jobId, new Date(Date.now() - 2 * ORPHAN_MIN_AGE_MS));
    // Missing-job precondition on the real queue before the probe is armed
    // to fail.
    await expect(queue.getJob(queueJobId(jobId, 1))).resolves.toBeUndefined();
    const before = await exportRow(jobId);

    // Only the BullMQ probe is broken: getJobs, the row lock, and every CAS
    // write still run against the real adapters.
    const getJobSpy = vi
      .spyOn(queue, "getJob")
      .mockRejectedValue(new Error("Redis probe timeout"));

    // The scan completes — a probe failure is counted and logged, never
    // treated as absence.
    await scheduler.runOnce();
    expect(getJobSpy).toHaveBeenCalledWith(queueJobId(jobId, 1));
    getJobSpy.mockRestore();

    // The durable row is byte-identical: no status, generation, or error
    // mutation — not even an updatedAt bump.
    expect(await exportRow(jobId)).toEqual(before);
    expect(logger.error).toHaveBeenCalledWith(
      "pdf-export orphan scan skipped a candidate",
      expect.objectContaining({ jobId, generation: 1 }),
    );
    // The unknown outcome never became a queue write either.
    await expect(queue.getJob(queueJobId(jobId, 1))).resolves.toBeUndefined();
    expect(await queueJobTotal()).toBe(0);
  });
});
