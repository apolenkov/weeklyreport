import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  vi,
} from "vitest";
import jwt from "jsonwebtoken";
import {
  createTestPrisma,
  cleanDatabase,
  seedTestData,
  disconnectTestPrisma,
  TEST_IDS,
} from "../../test-utils/prisma-test-helper";
import { PdfExportPrismaRepository } from "./pdf-export.prisma-repository";
import { PdfExportService } from "./pdf-export.service";
import { expectDefined } from "../../test-utils/expect-defined.js";

describe("PdfExportPrismaRepository (integration)", () => {
  const prisma = createTestPrisma();
  let repo: PdfExportPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(() => {
    repo = new PdfExportPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
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

    const created = await repo.createExportJob(job);

    expect(created.jobId).toBe(TEST_IDS.pdfJob1);
    expect(created.reportId).toBe(testData.report.id);
    expect(created.status).toBe("queued");

    // Verify in database
    const dbJob = await prisma.pdfExportJob.findUnique({
      where: { id: TEST_IDS.pdfJob1 },
    });
    expect(dbJob).not.toBeNull();
    expect(expectDefined(dbJob).status).toBe("pending"); // domain "queued" maps to DB "pending"
  });

  it("saveExportJob updates status and filePath", async () => {
    // Create a job first
    await repo.createExportJob({
      jobId: TEST_IDS.pdfJob2,
      reportId: testData.report.id,
      status: "queued" as const,
      requestedAt: new Date(),
      completedAt: null,
      checksum: null,
      templateVersion: "phase-2-pdf-v1",
      artifactUrl: null,
    });

    // Update the job to completed
    const updated = await repo.saveExportJob({
      jobId: TEST_IDS.pdfJob2,
      reportId: testData.report.id,
      status: "completed" as const,
      requestedAt: new Date(),
      completedAt: new Date(),
      checksum: null,
      templateVersion: "phase-2-pdf-v1",
      artifactUrl: "/exports/report-2026-04-07.pdf",
    });

    expect(updated.status).toBe("completed");
    expect(updated.artifactUrl).toBe("/exports/report-2026-04-07.pdf");

    // Verify in database
    const dbJob = await prisma.pdfExportJob.findUnique({
      where: { id: TEST_IDS.pdfJob2 },
    });
    expect(expectDefined(dbJob).status).toBe("completed");
    expect(expectDefined(dbJob).filePath).toBe(
      "/exports/report-2026-04-07.pdf",
    );
  });
});

// ---------------------------------------------------------------------------
// AUTH-05 cookie seam (CC-1) — Phase 28-02.
//
// Integration-shaped guard that exercises the service against the real Prisma
// repository with AUTH_DEV_MODE=false / AUTH_DEV_MODE_ALLOW_TEST=true.
//
// Strict end-to-end (BullMQ + Playwright bring-up) is the ceiling — out of
// scope here because the integration harness does not stand up a real
// browser. This test is the FLOOR per Plan 28-02 / Task 6 / Step 6.3:
//   1. Seed a published report.
//   2. Call PdfExportService.requestPdfExport (real Prisma repo, fake queue).
//   3. Assert the enqueued job carries a JWT-shaped authToken bound to the
//      reportId, AND that AUTH_DEV_MODE_ALLOW_TEST=true is honoured by the
//      tRPC dev-fallback (asserted at the unit layer in trpc.context.test.ts).
// ---------------------------------------------------------------------------

describe("AUTH-05 cookie seam (CC-1) — service against real Prisma repo", () => {
  const prisma = createTestPrisma();
  let repo: PdfExportPrismaRepository;

  beforeAll(() => {
    repo = new PdfExportPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
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
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it("enqueues a JWT-shaped authToken bound to the reportId for a published report", async () => {
    const testData = await seedTestData(prisma);
    // Promote the report to published so the service accepts the export.
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: "published",
        publishedAt: new Date("2026-04-15T10:00:00.000Z"),
        publishedById: testData.head.id,
      },
    });

    type EnqueuedJob = {
      name: string;
      data: { reportId: string; jobId: string; authToken: string };
    };
    const enqueued: EnqueuedJob[] = [];
    const fakeQueue = {
      add: async (name: string, data: EnqueuedJob["data"]) => {
        enqueued.push({ name, data });
        return { id: "fake" };
      },
    } as never;

    const service = new PdfExportService(repo, undefined, fakeQueue);
    await service.requestPdfExport(testData.report.id, testData.head.id);

    expect(enqueued).toHaveLength(1);
    expect(expectDefined(enqueued[0]).data.reportId).toBe(testData.report.id);
    expect(expectDefined(enqueued[0]).data.authToken).toMatch(/^eyJ/);

    const decoded = jwt.verify(
      expectDefined(enqueued[0]).data.authToken,
      "integration-test-secret-32-chars-or-more",
    ) as { reportId: string };
    expect(decoded.reportId).toBe(testData.report.id);
  });
});
