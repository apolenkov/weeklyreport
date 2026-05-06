import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  createTestPrisma,
  cleanDatabase,
  seedTestData,
  disconnectTestPrisma,
} from '../../test-utils/prisma-test-helper';
import { ReportSectionsPrismaRepository } from './report-sections.prisma-repository';
import { expectDefined } from '../../test-utils/expect-defined.js';

describe('ReportSectionsPrismaRepository (integration)', () => {
  const prisma = createTestPrisma();
  let repo: ReportSectionsPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(() => {
    // PrismaClient structurally satisfies PrismaService (both extend PrismaClient)
    repo = new ReportSectionsPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it('getSectionById returns full section with nested relations', async () => {
    // Seed additional nested data for the section
    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: 'green',
      },
    });

    await prisma.item.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        type: 'current',
        text: 'Integration test item',
        tag: 'feature',
        workflowStatus: 'in_progress',
        carriedOver: false,
      },
    });

    await prisma.risk.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        risk: 'Test risk',
        impact: 'High',
        mitigation: 'Mitigate it',
      },
    });

    await prisma.decision.create({
      data: {
        reportSectionId: testData.section.id,
        text: 'Test decision',
        owner: 'Test Lead 1',
        impact: 'Medium',
      },
    });

    await prisma.priority.create({
      data: {
        reportSectionId: testData.section.id,
        rank: 1,
        text: 'Priority 1',
      },
    });

    const result = await repo.getSectionById(testData.section.id);

    expect(result).not.toBeNull();
    expect(expectDefined(result).reportSectionId).toBe(testData.section.id);
    expect(expectDefined(result).authorName).toBe('Test Lead 1');
    expect(expectDefined(result).status).toBe('draft');
    expect(expectDefined(result).projects).toHaveLength(1);
    expect(expectDefined(expectDefined(result).projects[0]).trafficLight).toBe('green');
    expect(expectDefined(result).items).toHaveLength(1);
    expect(expectDefined(expectDefined(result).items[0]).text).toBe('Integration test item');
    expect(expectDefined(result).risks).toHaveLength(1);
    expect(expectDefined(result).decisions).toHaveLength(1);
    expect(expectDefined(result).priorities).toHaveLength(1);
  });

  it('getSectionById returns null for non-existent ID', async () => {
    const result = await repo.getSectionById('ffffffff-ffff-ffff-ffff-ffffffffffff');
    expect(result).toBeNull();
  });

  it('saveSection persists all nested entities and returns updated section', async () => {
    // First seed a project status so the section has a project
    await prisma.projectStatus.create({
      data: {
        reportSectionId: testData.section.id,
        projectId: testData.project.id,
        status: 'green',
      },
    });

    // Get the section via the repository
    const original = await repo.getSectionById(testData.section.id);
    expect(original).not.toBeNull();

    // Modify the section with new items, risks, decisions, priorities
    const modified = {
      ...expectDefined(original),
      status: 'draft' as const,
      projects: [
        {
          projectId: testData.project.id,
          projectName: 'Test Project 1',
          trafficLight: 'yellow' as const,
        },
      ],
      items: [
        {
          projectId: testData.project.id,
          type: 'current' as const,
          text: 'Saved item',
          tag: 'bugfix',
          workflowStatus: 'done' as const,
          carriedOver: false,
        },
      ],
      risks: [
        {
          projectId: testData.project.id,
          risk: 'Saved risk',
          impact: 'Low',
          mitigation: 'None needed',
        },
      ],
      decisions: [
        {
          text: 'Saved decision',
          owner: 'Lead',
          deadline: null,
          impact: 'High',
          resolvedAt: null,
        },
      ],
      priorities: [
        { rank: 1, text: 'Top priority' },
        { rank: 2, text: 'Second priority' },
      ],
    };

    const saved = await repo.saveSection(modified);

    expect(saved.reportSectionId).toBe(testData.section.id);
    expect(saved.projects).toHaveLength(1);
    expect(expectDefined(saved.projects[0]).trafficLight).toBe('yellow');
    expect(saved.items).toHaveLength(1);
    expect(expectDefined(saved.items[0]).text).toBe('Saved item');
    expect(saved.risks).toHaveLength(1);
    expect(expectDefined(saved.risks[0]).risk).toBe('Saved risk');
    expect(saved.decisions).toHaveLength(1);
    expect(expectDefined(saved.decisions[0]).text).toBe('Saved decision');
    expect(saved.priorities).toHaveLength(2);
  });
});
