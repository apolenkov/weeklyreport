import { describe, expect, it } from 'vitest';

import type { AssembledReport, PdfExportJob } from '@customreport/shared';

import { pdfExportRouter } from './pdf-export.router';
import {
  PdfExportDomainError,
  PdfExportService,
  type PdfExportRepository,
} from './pdf-export.service';

const reportId = '22222222-2222-4222-8222-222222222222';

const publishedReport: AssembledReport = {
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
};

const draftReport: AssembledReport = {
  ...publishedReport,
  status: 'draft',
  publishedAt: null,
  publishedById: null,
  publishedByName: null,
};

function createRepository(report: AssembledReport): PdfExportRepository {
  const jobs = new Map<string, PdfExportJob>();

  return {
    async createExportJob(job: PdfExportJob) {
      jobs.set(job.jobId, structuredClone(job));
      return structuredClone(job);
    },
    async getExportJob(jobId: string) {
      const job = jobs.get(jobId);
      return job ? structuredClone(job) : null;
    },
    async getPublishedReport(activeReportId: string) {
      return activeReportId === reportId ? structuredClone(report) : null;
    },
    async saveExportJob(job: PdfExportJob) {
      jobs.set(job.jobId, structuredClone(job));
      return structuredClone(job);
    },
    async markExportFailed(jobId: string, error: string) {
      const job = jobs.get(jobId);
      if (job) {
        jobs.set(jobId, { ...job, status: 'failed' as const });
      }
    },
  };
}

describe('PdfExportService', () => {
  it('rejects export requests for unpublished reports', async () => {
    const service = new PdfExportService(createRepository(draftReport));

    await expect(service.requestPdfExport(reportId)).rejects.toBeInstanceOf(PdfExportDomainError);
  });

  it('creates an async queued export job for a published report', async () => {
    const service = new PdfExportService(createRepository(publishedReport));
    const job = await service.requestPdfExport(reportId);

    expect(job.reportId).toBe(reportId);
    expect(job.status).toBe('queued');
    expect(job.templateVersion).toBe('phase-2-pdf-v1');
  });

  it('marks export jobs complete with deterministic metadata', async () => {
    const service = new PdfExportService(createRepository(publishedReport));
    const queued = await service.requestPdfExport(reportId);
    const completed = await service.markExportCompleted(
      queued.jobId,
      '/exports/report.pdf',
      'phase-2-demo-checksum',
    );

    expect(completed.status).toBe('completed');
    expect(completed.checksum).toBe('phase-2-demo-checksum');
    expect(completed.artifactUrl).toBe('/exports/report.pdf');
  });
});

describe('pdfExportRouter', () => {
  it('returns the latest async export status for an existing job', async () => {
    const service = new PdfExportService(createRepository(publishedReport));
    const queued = await pdfExportRouter.requestPdfExport({
      pdfExportService: service,
      reportId,
    });
    const completed = await service.markExportCompleted(
      queued.jobId,
      '/exports/report.pdf',
      'phase-2-demo-checksum',
    );

    await expect(
      pdfExportRouter.getPdfExportStatus({
        jobId: queued.jobId,
        pdfExportService: service,
      }),
    ).resolves.toMatchObject(completed);
  });
});
