import { describe, expect, it, vi } from 'vitest';

import {
  weeklyReportReadModelSchema,
  type WeeklyReportReadModel,
} from '@customreport/shared';

import {
  WeeklyReportService,
  WeeklyReportDomainError,
  type WeeklyReportRepository,
} from './weekly-report.service';

/* ------------------------------------------------------------------ */
/*  Fixed test UUIDs                                                   */
/* ------------------------------------------------------------------ */

const reportId = '11111111-1111-4111-8111-111111111111';
const activeReportId = '22222222-2222-4222-8222-222222222222';
const sectionId = '33333333-3333-4333-8333-333333333333';
const authorId = '44444444-4444-4444-8444-444444444444';
const projectId = '55555555-5555-4555-8555-555555555555';

/* ------------------------------------------------------------------ */
/*  Fixture helpers                                                    */
/* ------------------------------------------------------------------ */

function makeWeeklyReport(
  overrides: Partial<WeeklyReportReadModel> = {},
): WeeklyReportReadModel {
  return weeklyReportReadModelSchema.parse({
    reportId,
    periodStart: new Date('2026-04-14'),
    periodEnd: new Date('2026-04-18'),
    periodStatus: 'open',
    weekLabel: 'W16-2026',
    submissionCount: 1,
    totalLeads: 3,
    portfolioOverview: [
      {
        productId: projectId,
        productName: 'Project Alpha',
        worstStatus: 'green',
        stageCount: 2,
        leadNames: ['Lead A'],
      },
    ],
    leadSections: [
      {
        reportSectionId: sectionId,
        reportId,
        authorId,
        authorName: 'Lead A',
        status: 'submitted',
        submittedAt: new Date('2026-04-16T10:00:00.000Z'),
        projects: [
          { projectId, projectName: 'Project Alpha', trafficLight: 'green' },
        ],
        items: [
          {
            id: '66666666-6666-4666-8666-666666666666',
            projectId,
            type: 'current',
            text: 'Implemented feature X',
            tag: 'dev',
            workflowStatus: 'done',
            carriedOver: false,
          },
        ],
        risks: [],
        decisions: [],
        priorities: [
          { id: '77777777-7777-4777-8777-777777777777', rank: 1, text: 'Finish feature X' },
        ],
      },
    ],
    escalations: [],
    ...overrides,
  });
}

/* ------------------------------------------------------------------ */
/*  Spy repository                                                     */
/* ------------------------------------------------------------------ */

function createSpyRepository(
  reports: Map<string, WeeklyReportReadModel>,
  activeId: string | null = null,
): WeeklyReportRepository & {
  getWeeklyReport: ReturnType<typeof vi.fn>;
  getActiveReportId: ReturnType<typeof vi.fn>;
} {
  return {
    getWeeklyReport: vi.fn(async (id: string) =>
      structuredClone(reports.get(id) ?? null),
    ),
    getActiveReportId: vi.fn(async () => activeId),
  };
}

/* ------------------------------------------------------------------ */
/*  Service-level unit tests                                           */
/* ------------------------------------------------------------------ */

describe('WeeklyReportService — unit tests', () => {
  it('calls getWeeklyReport with the provided reportId', async () => {
    const report = makeWeeklyReport();
    const reports = new Map([[reportId, report]]);
    const repo = createSpyRepository(reports);
    const service = new WeeklyReportService(repo);

    await service.getWeeklyReport(reportId);

    expect(repo.getWeeklyReport).toHaveBeenCalledOnce();
    expect(repo.getWeeklyReport).toHaveBeenCalledWith(reportId);
    // Should NOT call getActiveReportId when explicit ID is provided
    expect(repo.getActiveReportId).not.toHaveBeenCalled();
  });

  it('falls back to getActiveReportId when no ID is provided', async () => {
    const report = makeWeeklyReport({ reportId: activeReportId });
    const reports = new Map([[activeReportId, report]]);
    const repo = createSpyRepository(reports, activeReportId);
    const service = new WeeklyReportService(repo);

    await service.getWeeklyReport();

    expect(repo.getActiveReportId).toHaveBeenCalledOnce();
    expect(repo.getWeeklyReport).toHaveBeenCalledWith(activeReportId);
  });

  it('throws WeeklyReportDomainError (not generic Error) for missing report', async () => {
    const repo = createSpyRepository(new Map());
    const service = new WeeklyReportService(repo);

    const error = await service
      .getWeeklyReport(reportId)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(WeeklyReportDomainError);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(reportId);
  });

  it('throws WeeklyReportDomainError when no active and no explicit ID', async () => {
    const repo = createSpyRepository(new Map(), null);
    const service = new WeeklyReportService(repo);

    const error = await service.getWeeklyReport().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(WeeklyReportDomainError);
    expect((error as Error).message).toContain('No active report');
    // Should not have called getWeeklyReport at all
    expect(repo.getWeeklyReport).not.toHaveBeenCalled();
  });

  it('returns published period data unchanged', async () => {
    const report = makeWeeklyReport({
      periodStatus: 'published',
      submissionCount: 6,
      totalLeads: 6,
    });
    const reports = new Map([[reportId, report]]);
    const service = new WeeklyReportService(createSpyRepository(reports));

    const result = await service.getWeeklyReport(reportId);

    expect(result.periodStatus).toBe('published');
    expect(result.submissionCount).toBe(6);
    expect(result.totalLeads).toBe(6);
  });
});
