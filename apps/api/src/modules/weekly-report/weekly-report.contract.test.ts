import { describe, expect, it } from 'vitest';

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
/*  Fixtures                                                           */
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
          {
            projectId,
            projectName: 'Project Alpha',
            trafficLight: 'green',
          },
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
        priorities: [{ id: '77777777-7777-4777-8777-777777777777', rank: 1, text: 'Finish feature X' }],
      },
    ],
    escalations: [],
    ...overrides,
  });
}

/* ------------------------------------------------------------------ */
/*  In-memory mock repository                                          */
/* ------------------------------------------------------------------ */

function createRepository(
  reports: Map<string, WeeklyReportReadModel>,
  activeId: string | null = null,
): WeeklyReportRepository {
  return {
    async getWeeklyReport(id: string) {
      return structuredClone(reports.get(id) ?? null);
    },
    async getActiveReportId() {
      return activeId;
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('WeeklyReportService — contract tests', () => {
  it('returns compiled weekly report data for a given reportId', async () => {
    const report = makeWeeklyReport();
    const reports = new Map([[reportId, report]]);
    const service = new WeeklyReportService(createRepository(reports));

    const result = await service.getWeeklyReport(reportId);

    expect(result.reportId).toBe(reportId);
    expect(result.periodStatus).toBe('open');
    expect(result.weekLabel).toBe('W16-2026');
    expect(result.submissionCount).toBe(1);
    expect(result.totalLeads).toBe(3);
    expect(result.portfolioOverview).toHaveLength(1);
    expect(result.portfolioOverview[0]!.productName).toBe('Project Alpha');
    expect(result.leadSections).toHaveLength(1);
    expect(result.leadSections[0]!.authorName).toBe('Lead A');
    expect(result.escalations).toEqual([]);

    // Verify output conforms to the Zod schema
    const parsed = weeklyReportReadModelSchema.parse(result);
    expect(parsed).toEqual(result);
  });

  it('throws WeeklyReportDomainError when report is not found', async () => {
    const reports = new Map<string, WeeklyReportReadModel>();
    const service = new WeeklyReportService(createRepository(reports));

    await expect(
      service.getWeeklyReport('99999999-9999-4999-8999-999999999999'),
    ).rejects.toThrow(WeeklyReportDomainError);

    await expect(
      service.getWeeklyReport('99999999-9999-4999-8999-999999999999'),
    ).rejects.toThrow('not found');
  });

  it('uses active report when no ID is given', async () => {
    const report = makeWeeklyReport({ reportId: activeReportId });
    const reports = new Map([[activeReportId, report]]);
    const service = new WeeklyReportService(
      createRepository(reports, activeReportId),
    );

    const result = await service.getWeeklyReport();

    expect(result.reportId).toBe(activeReportId);
  });

  it('throws when no active report exists and no ID given', async () => {
    const service = new WeeklyReportService(
      createRepository(new Map(), null),
    );

    await expect(service.getWeeklyReport()).rejects.toThrow(
      WeeklyReportDomainError,
    );

    await expect(service.getWeeklyReport()).rejects.toThrow(
      'No active report period found',
    );
  });

  it('returns report with escalations (blocked items and at-risk projects)', async () => {
    const report = makeWeeklyReport({
      escalations: [
        {
          type: 'blocked',
          productName: 'Project Alpha',
          stageName: null,
          leadName: 'Lead A',
          description: 'Blocked by external dependency',
        },
        {
          type: 'at_risk',
          productName: 'Project Alpha',
          stageName: null,
          leadName: 'Lead A',
          description: 'Project Project Alpha is flagged red.',
        },
        {
          type: 'unresolved_risk',
          productName: 'Project Alpha',
          stageName: null,
          leadName: 'Lead A',
          description: 'Key developer may leave',
        },
      ],
    });
    const reports = new Map([[reportId, report]]);
    const service = new WeeklyReportService(createRepository(reports));

    const result = await service.getWeeklyReport(reportId);

    expect(result.escalations).toHaveLength(3);
    expect(result.escalations.map((e) => e.type)).toEqual([
      'blocked',
      'at_risk',
      'unresolved_risk',
    ]);
  });

  it('returns report with multiple portfolio products and worst status computed', async () => {
    const secondProjectId = '88888888-8888-4888-8888-888888888888';
    const report = makeWeeklyReport({
      portfolioOverview: [
        {
          productId: projectId,
          productName: 'Project Alpha',
          worstStatus: 'red',
          stageCount: 2,
          leadNames: ['Lead A'],
        },
        {
          productId: secondProjectId,
          productName: 'Project Beta',
          worstStatus: 'yellow',
          stageCount: 1,
          leadNames: ['Lead B'],
        },
      ],
    });
    const reports = new Map([[reportId, report]]);
    const service = new WeeklyReportService(createRepository(reports));

    const result = await service.getWeeklyReport(reportId);

    expect(result.portfolioOverview).toHaveLength(2);
    expect(result.portfolioOverview[0]!.worstStatus).toBe('red');
    expect(result.portfolioOverview[1]!.worstStatus).toBe('yellow');
  });

  it('returns report with zero submissions', async () => {
    const report = makeWeeklyReport({
      submissionCount: 0,
      leadSections: [],
    });
    const reports = new Map([[reportId, report]]);
    const service = new WeeklyReportService(createRepository(reports));

    const result = await service.getWeeklyReport(reportId);

    expect(result.submissionCount).toBe(0);
    expect(result.leadSections).toEqual([]);
  });

  it('result conforms to Zod schema', async () => {
    const report = makeWeeklyReport();
    const reports = new Map([[reportId, report]]);
    const service = new WeeklyReportService(createRepository(reports));

    const result = await service.getWeeklyReport(reportId);

    // The service output must parse cleanly through the canonical schema
    const parsed = weeklyReportReadModelSchema.parse(result);
    expect(parsed.reportId).toBe(reportId);
    expect(parsed.leadSections).toHaveLength(1);
  });
});
