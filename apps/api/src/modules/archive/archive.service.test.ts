import { describe, expect, it } from 'vitest';

import type {
  ArchiveReportDetail,
  ArchiveReportSummary,
} from '@customreport/shared';

import { archiveRouter } from './archive.router';
import {
  ArchiveDomainError,
  ArchiveService,
  type ArchiveRepository,
} from './archive.service';

const reportId = '22222222-2222-4222-8222-222222222222';

const olderSummary: ArchiveReportSummary = {
  reportId: '11111111-1111-4111-8111-111111111111',
  periodStart: new Date('2026-03-30T00:00:00.000Z'),
  periodEnd: new Date('2026-04-05T23:59:59.000Z'),
  publishedAt: new Date('2026-04-05T14:00:00.000Z'),
  publishedByName: 'Department Head',
  portfolioStatus: 'green',
};

const latestDetail: ArchiveReportDetail = {
  summary: {
    reportId,
    periodStart: new Date('2026-04-06T00:00:00.000Z'),
    periodEnd: new Date('2026-04-12T23:59:59.000Z'),
    publishedAt: new Date('2026-04-09T14:00:00.000Z'),
    publishedByName: 'Department Head',
    portfolioStatus: 'yellow',
  },
  report: {
    reportId,
    periodStart: new Date('2026-04-06T00:00:00.000Z'),
    periodEnd: new Date('2026-04-12T23:59:59.000Z'),
    deadline: new Date('2026-04-10T15:00:00.000Z'),
    status: 'published',
    publishedAt: new Date('2026-04-09T14:00:00.000Z'),
    publishedById: '00000000-0000-4000-8000-000000000001',
    publishedByName: 'Department Head',
    portfolioOverview: {
      status: 'yellow',
      totals: { green: 1, yellow: 2, red: 0 },
    },
    sections: [],
  },
};

function createRepository(): ArchiveRepository {
  return {
    async getArchiveReport(reportIdInput: string) {
      return reportIdInput === reportId ? structuredClone(latestDetail) : null;
    },
    async listArchiveReports() {
      return [structuredClone(latestDetail.summary), structuredClone(olderSummary)];
    },
  };
}

describe('ArchiveService', () => {
  it('returns archive reports sorted by latest published first', async () => {
    const service = new ArchiveService(createRepository());
    const reports = await service.listArchiveReports();

    expect(reports[0]?.reportId).toBe(reportId);
    expect(reports[1]?.reportId).toBe(olderSummary.reportId);
  });

  it('returns immutable detail for a published report', async () => {
    const service = new ArchiveService(createRepository());
    const detail = await service.getArchiveReport(reportId);

    expect(detail.report.status).toBe('published');
    expect(detail.summary.portfolioStatus).toBe('yellow');
  });

  it('rejects missing archive detail lookups', async () => {
    const service = new ArchiveService(createRepository());

    await expect(service.getArchiveReport('99999999-9999-4999-8999-999999999999')).rejects.toBeInstanceOf(
      ArchiveDomainError,
    );
  });
});

describe('archiveRouter', () => {
  it('returns list and detail read models', async () => {
    const service = new ArchiveService(createRepository());

    await expect(archiveRouter.listArchiveReports({ archiveService: service })).resolves.toHaveLength(2);
    await expect(
      archiveRouter.getArchiveReport({ archiveService: service, reportId }),
    ).resolves.toMatchObject({
      summary: { reportId },
    });
  });
});
