import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

import type {
  ArchiveReportDetail,
  ArchiveReportSummary,
  ReportSectionReadModel,
} from '@customreport/shared';
import {
  archiveReportDetailSchema,
  archiveReportSummarySchema,
} from '@customreport/shared';

import {
  ArchiveDomainError,
  ArchiveService,
  type ArchiveRepository,
} from './archive.service';

// ---------------------------------------------------------------------------
// Fixture data
// ---------------------------------------------------------------------------

const headUserId = '00000000-0000-4000-8000-000000000001';

const sectionLead1: ReportSectionReadModel = {
  reportSectionId: 'a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1',
  reportId: '22222222-2222-4222-8222-222222222222',
  authorId: '33333333-3333-4333-8333-333333333333',
  authorName: 'Lead Alpha',
  status: 'submitted',
  submittedAt: new Date('2026-04-09T10:00:00.000Z'),
  projects: [
    {
      projectId: '44444444-4444-4444-8444-444444444444',
      projectName: 'Project Alpha',
      trafficLight: 'green',
    },
  ],
  items: [
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      projectId: '44444444-4444-4444-8444-444444444444',
      type: 'current',
      text: 'Implement API gateway',
      tag: 'feature',
      workflowStatus: 'done',
      carriedOver: false,
    },
  ],
  risks: [
    {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      projectId: '44444444-4444-4444-8444-444444444444',
      risk: 'Vendor delay risk',
      impact: 'May delay launch by 1 week',
      mitigation: 'Prepare fallback vendor',
    },
  ],
  decisions: [
    {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      text: 'Upgrade to Node 22',
      owner: 'Lead Alpha',
      deadline: new Date('2026-04-30T00:00:00.000Z'),
      impact: 'Unlocks native fetch',
      resolvedAt: null,
    },
  ],
  priorities: [
    { id: 'f1f1f1f1-f1f1-4f1f-8f1f-f1f1f1f1f1f1', rank: 1, text: 'Ship API gateway' },
    { id: 'f2f2f2f2-f2f2-4f2f-8f2f-f2f2f2f2f2f2', rank: 2, text: 'Fix auth flow' },
    { id: 'f3f3f3f3-f3f3-4f3f-8f3f-f3f3f3f3f3f3', rank: 3, text: 'Write docs' },
  ],
};

function makeSummary(overrides: Partial<ArchiveReportSummary> = {}): ArchiveReportSummary {
  return {
    reportId: '22222222-2222-4222-8222-222222222222',
    periodStart: new Date('2026-04-06T00:00:00.000Z'),
    periodEnd: new Date('2026-04-12T23:59:59.000Z'),
    publishedAt: new Date('2026-04-09T14:00:00.000Z'),
    publishedByName: 'Department Head',
    portfolioStatus: 'yellow',
    ...overrides,
  };
}

function makeDetail(overrides: {
  summary?: Partial<ArchiveReportSummary>;
  sections?: ReportSectionReadModel[];
} = {}): ArchiveReportDetail {
  const summary = makeSummary(overrides.summary);
  return {
    summary,
    report: {
      reportId: summary.reportId,
      periodStart: summary.periodStart,
      periodEnd: summary.periodEnd,
      deadline: new Date('2026-04-10T15:00:00.000Z'),
      status: 'published',
      publishedAt: summary.publishedAt,
      publishedById: headUserId,
      publishedByName: summary.publishedByName,
      portfolioOverview: {
        status: summary.portfolioStatus,
        totals: { green: 1, yellow: 2, red: 0 },
      },
      sections: overrides.sections ?? [],
    },
  };
}

// ---------------------------------------------------------------------------
// In-memory repository
// ---------------------------------------------------------------------------

function createInMemoryRepository(
  summaries: ArchiveReportSummary[],
  details: Map<string, ArchiveReportDetail>,
): ArchiveRepository {
  return {
    async listArchiveReports(): Promise<ArchiveReportSummary[]> {
      return structuredClone(summaries);
    },
    async getArchiveReport(reportId: string): Promise<ArchiveReportDetail | null> {
      const detail = details.get(reportId);
      return detail ? structuredClone(detail) : null;
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ArchiveService — contract tests', () => {
  // -----------------------------------------------------------------------
  // listArchiveReports
  // -----------------------------------------------------------------------

  describe('listArchiveReports', () => {
    it('returns empty array when no published reports', async () => {
      const repo = createInMemoryRepository([], new Map());
      const service = new ArchiveService(repo);

      const reports = await service.listArchiveReports();

      expect(reports).toEqual([]);
      expect(reports).toHaveLength(0);
    });

    it('returns reports sorted by publishedAt descending', async () => {
      const oldest = makeSummary({
        reportId: '11111111-1111-4111-8111-111111111111',
        publishedAt: new Date('2026-03-01T10:00:00.000Z'),
      });
      const middle = makeSummary({
        reportId: '22222222-2222-4222-8222-222222222222',
        publishedAt: new Date('2026-03-15T10:00:00.000Z'),
      });
      const newest = makeSummary({
        reportId: '33333333-3333-4333-8333-333333333333',
        publishedAt: new Date('2026-04-01T10:00:00.000Z'),
      });

      // Feed them in scrambled order to verify the service sorts
      const repo = createInMemoryRepository(
        [middle, oldest, newest],
        new Map(),
      );
      const service = new ArchiveService(repo);

      const reports = await service.listArchiveReports();

      expect(reports).toHaveLength(3);
      expect(reports[0]!.reportId).toBe(newest.reportId);
      expect(reports[1]!.reportId).toBe(middle.reportId);
      expect(reports[2]!.reportId).toBe(oldest.reportId);
    });

    it('validates output through Zod schema (rejects malformed data)', async () => {
      const malformed = {
        reportId: 'not-a-uuid', // invalid UUID
        periodStart: new Date('2026-04-06T00:00:00.000Z'),
        periodEnd: new Date('2026-04-12T23:59:59.000Z'),
        publishedAt: new Date('2026-04-09T14:00:00.000Z'),
        publishedByName: 'Department Head',
        portfolioStatus: 'yellow',
      } as unknown as ArchiveReportSummary;

      const repo = createInMemoryRepository([malformed], new Map());
      const service = new ArchiveService(repo);

      await expect(service.listArchiveReports()).rejects.toThrow(ZodError);
    });

    it('validates output conforms to archiveReportSummarySchema', async () => {
      const summary = makeSummary();
      const repo = createInMemoryRepository([summary], new Map());
      const service = new ArchiveService(repo);

      const reports = await service.listArchiveReports();

      expect(reports).toHaveLength(1);
      // Verify each report passes schema independently
      for (const report of reports) {
        expect(() => archiveReportSummarySchema.parse(report)).not.toThrow();
      }
    });

    it('handles single report', async () => {
      const single = makeSummary({
        reportId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      });
      const repo = createInMemoryRepository([single], new Map());
      const service = new ArchiveService(repo);

      const reports = await service.listArchiveReports();

      expect(reports).toHaveLength(1);
      expect(reports[0]!.reportId).toBe(single.reportId);
      expect(reports[0]!.publishedByName).toBe('Department Head');
    });

    it('handles many reports (5+)', async () => {
      const summaries: ArchiveReportSummary[] = [];
      const baseDate = new Date('2026-01-01T00:00:00.000Z');

      for (let i = 0; i < 7; i++) {
        const publishedAt = new Date(baseDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
        const reportUuidSuffix = (i + 1).toString().padStart(12, '0');
        summaries.push(
          makeSummary({
            reportId: `${reportUuidSuffix.slice(0, 8)}-0000-4000-8000-${reportUuidSuffix}`,
            periodStart: new Date(publishedAt.getTime() - 7 * 24 * 60 * 60 * 1000),
            periodEnd: publishedAt,
            publishedAt,
          }),
        );
      }

      const repo = createInMemoryRepository(summaries, new Map());
      const service = new ArchiveService(repo);

      const reports = await service.listArchiveReports();

      expect(reports).toHaveLength(7);
      // Verify descending sort
      for (let i = 0; i < reports.length - 1; i++) {
        expect(reports[i]!.publishedAt.getTime()).toBeGreaterThanOrEqual(
          reports[i + 1]!.publishedAt.getTime(),
        );
      }
    });
  });

  // -----------------------------------------------------------------------
  // getArchiveReport
  // -----------------------------------------------------------------------

  describe('getArchiveReport', () => {
    it('returns report detail when found', async () => {
      const reportId = '22222222-2222-4222-8222-222222222222';
      const detail = makeDetail();
      const details = new Map<string, ArchiveReportDetail>([[reportId, detail]]);
      const repo = createInMemoryRepository([], details);
      const service = new ArchiveService(repo);

      const result = await service.getArchiveReport(reportId);

      expect(result.summary.reportId).toBe(reportId);
      expect(result.report.status).toBe('published');
      expect(result.summary.portfolioStatus).toBe('yellow');
      expect(result.summary.publishedByName).toBe('Department Head');
    });

    it('throws ArchiveDomainError when not found', async () => {
      const repo = createInMemoryRepository([], new Map());
      const service = new ArchiveService(repo);

      const missingId = '99999999-9999-4999-8999-999999999999';

      await expect(service.getArchiveReport(missingId)).rejects.toThrow(
        ArchiveDomainError,
      );
      await expect(service.getArchiveReport(missingId)).rejects.toThrow(
        `Archive report ${missingId} was not found.`,
      );
    });

    it('validates output through Zod schema (rejects malformed detail)', async () => {
      const reportId = '22222222-2222-4222-8222-222222222222';
      const malformedDetail = {
        summary: makeSummary(),
        report: {
          reportId,
          periodStart: new Date('2026-04-06T00:00:00.000Z'),
          periodEnd: new Date('2026-04-12T23:59:59.000Z'),
          deadline: new Date('2026-04-10T15:00:00.000Z'),
          status: 'invalid_status', // not in enum
          publishedAt: null,
          publishedById: null,
          publishedByName: null,
          portfolioOverview: {
            status: 'yellow',
            totals: { green: 1, yellow: 2, red: 0 },
          },
          sections: [],
        },
      } as unknown as ArchiveReportDetail;

      const details = new Map<string, ArchiveReportDetail>([[reportId, malformedDetail]]);
      const repo = createInMemoryRepository([], details);
      const service = new ArchiveService(repo);

      await expect(service.getArchiveReport(reportId)).rejects.toThrow(ZodError);
    });

    it('validates output conforms to archiveReportDetailSchema', async () => {
      const reportId = '22222222-2222-4222-8222-222222222222';
      const detail = makeDetail({ sections: [sectionLead1] });
      const details = new Map<string, ArchiveReportDetail>([[reportId, detail]]);
      const repo = createInMemoryRepository([], details);
      const service = new ArchiveService(repo);

      const result = await service.getArchiveReport(reportId);

      expect(() => archiveReportDetailSchema.parse(result)).not.toThrow();
    });

    it('includes full assembled report with sections', async () => {
      const reportId = '22222222-2222-4222-8222-222222222222';
      const detail = makeDetail({ sections: [sectionLead1] });
      const details = new Map<string, ArchiveReportDetail>([[reportId, detail]]);
      const repo = createInMemoryRepository([], details);
      const service = new ArchiveService(repo);

      const result = await service.getArchiveReport(reportId);

      expect(result.report.sections).toHaveLength(1);

      const section = result.report.sections[0]!;
      expect(section.authorName).toBe('Lead Alpha');
      expect(section.status).toBe('submitted');
      expect(section.projects).toHaveLength(1);
      expect(section.projects[0]!.projectName).toBe('Project Alpha');
      expect(section.items).toHaveLength(1);
      expect(section.items[0]!.text).toBe('Implement API gateway');
      expect(section.risks).toHaveLength(1);
      expect(section.risks[0]!.risk).toBe('Vendor delay risk');
      expect(section.decisions).toHaveLength(1);
      expect(section.decisions[0]!.text).toBe('Upgrade to Node 22');
      expect(section.priorities).toHaveLength(3);
    });
  });
});
