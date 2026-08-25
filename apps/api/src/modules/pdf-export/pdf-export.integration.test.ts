import type { UserSession } from "@customreport/shared";
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

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { createNullLogger } from "../../lib/logger.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import type { PdfExportEnqueuer } from "./pdf-export.ports";
import { NOOP_PDF_EXPORT_TELEMETRY } from "./pdf-export.ports.js";
import { PdfExportPrismaRepository } from "./pdf-export.prisma-repository";
import { PdfExportService } from "./pdf-export.service";

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
      requestedAt: new Date(),
      completedAt: null,
      checksum: null,
      templateVersion: "phase-2-pdf-v1",
      artifactUrl: null,
    };

    const created = await repo.createExportJob(job, testData.head.id);

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
        requestedAt: new Date(),
        completedAt: null,
        checksum: null,
        templateVersion: "phase-2-pdf-v1",
        artifactUrl: null,
      },
      testData.head.id,
    );

    const completedChecksum = "sha256:deadbeef";
    const completedArtifactUrl = `/pdfs/${TEST_IDS.pdfJob2}.pdf`;
    const updated = await repo.saveExportJob({
      jobId: TEST_IDS.pdfJob2,
      reportId: testData.report.id,
      status: "completed" as const,
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
});

// Floor against real Prisma (no browser): enqueued job carries a JWT bound
// to reportId under AUTH_DEV_MODE=false / AUTH_DEV_MODE_ALLOW_TEST=true.
describe("cookie seam — service against real Prisma repo", () => {
  const prisma = createTestPrisma();
  let repo: PdfExportPrismaRepository;

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
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("enqueues non-credential identifiers bound to the requester for a published report", async () => {
    const testData = await seedTestData(prisma);
    // Promote the report to published so the service accepts the export.
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        periodStatus: "published",
        publishedAt: new Date("2026-04-15T10:00:00.000Z"),
        publishedById: testData.head.id,
      },
    });

    interface EnqueuedJob {
      reportId: string;
      jobId: string;
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
    // The durable payload must not carry a bearer credential — the worker
    // mints the short-lived render token from this identity at execution time.
    expect(expectDefined(enqueued[0]).requestedBy).toBe(testData.head.id);
    const serialized = JSON.stringify(enqueued[0]);
    expect(serialized).not.toContain("authToken");
    expect(serialized).not.toMatch(/eyJ/);
  });

  it("rejects a published report outside the caller's group before enqueue", async () => {
    const testData = await seedTestData(prisma);
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        periodStatus: "published",
        publishedAt: new Date("2026-04-15T10:00:00.000Z"),
        publishedById: testData.head.id,
      },
    });
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
    );

    await expect(
      service.requestPdfExport(testData.report.id, session),
    ).rejects.toThrow("PDF export is not available for this caller.");
    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});
