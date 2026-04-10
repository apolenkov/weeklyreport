import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  createTestPrisma,
  cleanDatabase,
  seedTestData,
  disconnectTestPrisma,
  TEST_IDS,
} from '../../test-utils/prisma-test-helper';
import { PdfExportPrismaRepository } from './pdf-export.prisma-repository';

describe('PdfExportPrismaRepository (integration)', () => {
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
    await disconnectTestPrisma();
  });

  it('createExportJob creates and returns job', async () => {
    const job = {
      jobId: TEST_IDS.pdfJob1,
      reportId: testData.report.id,
      status: 'queued' as const,
      requestedAt: new Date(),
      completedAt: null,
      checksum: null,
      templateVersion: 'phase-2-pdf-v1',
      artifactUrl: null,
    };

    const created = await repo.createExportJob(job);

    expect(created.jobId).toBe(TEST_IDS.pdfJob1);
    expect(created.reportId).toBe(testData.report.id);
    expect(created.status).toBe('queued');

    // Verify in database
    const dbJob = await prisma.pdfExportJob.findUnique({ where: { id: TEST_IDS.pdfJob1 } });
    expect(dbJob).not.toBeNull();
    expect(dbJob!.status).toBe('pending'); // domain "queued" maps to DB "pending"
  });

  it('saveExportJob updates status and filePath', async () => {
    // Create a job first
    await repo.createExportJob({
      jobId: TEST_IDS.pdfJob2,
      reportId: testData.report.id,
      status: 'queued' as const,
      requestedAt: new Date(),
      completedAt: null,
      checksum: null,
      templateVersion: 'phase-2-pdf-v1',
      artifactUrl: null,
    });

    // Update the job to completed
    const updated = await repo.saveExportJob({
      jobId: TEST_IDS.pdfJob2,
      reportId: testData.report.id,
      status: 'completed' as const,
      requestedAt: new Date(),
      completedAt: new Date(),
      checksum: null,
      templateVersion: 'phase-2-pdf-v1',
      artifactUrl: '/exports/report-2026-04-07.pdf',
    });

    expect(updated.status).toBe('completed');
    expect(updated.artifactUrl).toBe('/exports/report-2026-04-07.pdf');

    // Verify in database
    const dbJob = await prisma.pdfExportJob.findUnique({ where: { id: TEST_IDS.pdfJob2 } });
    expect(dbJob!.status).toBe('completed');
    expect(dbJob!.filePath).toBe('/exports/report-2026-04-07.pdf');
  });
});
