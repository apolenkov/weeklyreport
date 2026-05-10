import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  createTestPrisma,
  cleanDatabase,
  seedTestData,
  disconnectTestPrisma,
} from '../../test-utils/prisma-test-helper';
import { ReviewPrismaRepository } from './review.prisma-repository';
import { expectDefined } from '../../test-utils/expect-defined.js';

describe('ReviewPrismaRepository (integration)', () => {
  const prisma = createTestPrisma();
  let repo: ReviewPrismaRepository;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(() => {
    repo = new ReviewPrismaRepository(prisma as never);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    testData = await seedTestData(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  it('getSubmissionDashboard returns rows for all sections in report', async () => {
    const rows = await repo.getSubmissionDashboard(testData.report.id, {
      role: 'admin',
    });

    expect(rows).toHaveLength(1);
    expect(expectDefined(rows[0]).leadId).toBe(testData.lead.id);
    expect(expectDefined(rows[0]).leadName).toBe('Test Lead 1');
    expect(expectDefined(rows[0]).status).toBe('draft');
    expect(expectDefined(rows[0]).projectNames).toContain('Test Project 1');
  });

  it('getSubmissionDashboard returns empty array for non-existent report', async () => {
    const rows = await repo.getSubmissionDashboard(
      'ffffffff-ffff-ffff-ffff-ffffffffffff',
      { role: 'admin' },
    );
    expect(rows).toHaveLength(0);
  });
});
