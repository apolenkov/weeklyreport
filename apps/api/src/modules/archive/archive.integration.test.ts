import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  createTestPrisma,
  cleanDatabase,
  seedTestData,
  disconnectTestPrisma,
} from '../../test-utils/prisma-test-helper';
import { ArchivePrismaRepository } from './archive.prisma-repository';
import { expectDefined } from '../../test-utils/expect-defined.js';

describe('ArchivePrismaRepository (integration)', () => {
  const prisma = createTestPrisma();
  let repo: ArchivePrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(() => {
    repo = new ArchivePrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it('listArchiveReports returns only published reports', async () => {
    // The seeded report is draft, so archive should be empty
    const emptyList = await repo.listArchiveReports();
    expect(emptyList).toHaveLength(0);

    // Publish the report
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: 'published',
        publishedAt: new Date('2026-04-12T10:00:00.000Z'),
        publishedById: testData.head.id,
      },
    });

    // Add a project status to the section so portfolio overview works
    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: 'green',
      },
    });

    const list = await repo.listArchiveReports();
    expect(list).toHaveLength(1);
    expect(expectDefined(list[0]).reportId).toBe(testData.report.id);
    expect(expectDefined(list[0]).publishedByName).toBe('Test Head');
    expect(expectDefined(list[0]).portfolioStatus).toBe('green');
  });

  it('getArchiveReport returns full detail for published report', async () => {
    // Publish the report with some data
    await prisma.report.update({
      where: { id: testData.report.id },
      data: {
        status: 'published',
        publishedAt: new Date('2026-04-12T10:00:00.000Z'),
        publishedById: testData.head.id,
      },
    });

    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: 'yellow',
      },
    });

    await prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        type: 'current',
        text: 'Archive item',
        tag: 'feature',
        workflowStatus: 'done',
        carriedOver: false,
      },
    });

    const detail = await repo.getArchiveReport(testData.report.id);

    expect(detail).not.toBeNull();
    expect(expectDefined(detail).summary.reportId).toBe(testData.report.id);
    expect(expectDefined(detail).summary.portfolioStatus).toBe('yellow');
    expect(expectDefined(detail).report.sections).toHaveLength(1);
    expect(expectDefined(expectDefined(detail).report.sections[0]).items).toHaveLength(1);
    expect(expectDefined(expectDefined(expectDefined(detail).report.sections[0]).items[0]).text).toBe('Archive item');
  });
});
