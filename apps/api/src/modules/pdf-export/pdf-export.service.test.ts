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

  describe('markExportFailed', () => {
    it('updates job status to failed with error message', async () => {
      const repo = createRepository(publishedReport);
      const service = new PdfExportService(repo);

      // Create a job first
      const queued = await service.requestPdfExport(reportId);

      // Mark it as failed
      await service.markExportFailed(queued.jobId, 'timeout error');

      // Verify the job status was updated
      const job = await service.getPdfExportStatus(queued.jobId);
      expect(job.status).toBe('failed');
    });

    it('calls repository.markExportFailed with correct parameters', async () => {
      const repo = createRepository(publishedReport);
      const markExportFailedCalls: Array<{ jobId: string; error: string }> = [];
      const originalMarkExportFailed = repo.markExportFailed.bind(repo);
      repo.markExportFailed = async (jobId: string, error: string) => {
        markExportFailedCalls.push({ jobId, error });
        return originalMarkExportFailed(jobId, error);
      };

      const service = new PdfExportService(repo);
      const queued = await service.requestPdfExport(reportId);

      await service.markExportFailed(queued.jobId, 'browser crashed');

      expect(markExportFailedCalls).toHaveLength(1);
      expect(markExportFailedCalls[0]).toEqual({
        jobId: queued.jobId,
        error: 'browser crashed',
      });
    });
  });

  describe('buildAuthCookies', () => {
    it('uses AUTH_JWT_COOKIE_NAME env for cookie name', () => {
      const originalEnv = process.env.AUTH_JWT_COOKIE_NAME;
      process.env.AUTH_JWT_COOKIE_NAME = 'my_custom_session';

      try {
        const service = new PdfExportService(createRepository(publishedReport));
        const cookies = service.buildAuthCookies('test-jwt-token');

        expect(cookies).toHaveLength(1);
        expect(cookies[0]?.name).toBe('my_custom_session');
        expect(cookies[0]?.value).toBe('test-jwt-token');
      } finally {
        if (originalEnv === undefined) {
          delete process.env.AUTH_JWT_COOKIE_NAME;
        } else {
          process.env.AUTH_JWT_COOKIE_NAME = originalEnv;
        }
      }
    });

    it('falls back to default cookie name when env is not set', () => {
      const originalEnv = process.env.AUTH_JWT_COOKIE_NAME;
      delete process.env.AUTH_JWT_COOKIE_NAME;

      try {
        const service = new PdfExportService(createRepository(publishedReport));
        const cookies = service.buildAuthCookies('test-jwt-token');

        expect(cookies[0]?.name).toBe('customreport_session');
      } finally {
        if (originalEnv !== undefined) {
          process.env.AUTH_JWT_COOKIE_NAME = originalEnv;
        }
      }
    });

    it('sets httpOnly to true for security', () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const cookies = service.buildAuthCookies('test-jwt-token');

      expect(cookies[0]?.httpOnly).toBe(true);
    });

    it('extracts domain from PDF_BASE_URL', () => {
      const originalEnv = process.env.PDF_BASE_URL;
      process.env.PDF_BASE_URL = 'https://reports.example.com';

      try {
        const service = new PdfExportService(createRepository(publishedReport));
        const cookies = service.buildAuthCookies('test-jwt-token');

        expect(cookies[0]?.domain).toBe('reports.example.com');
        expect(cookies[0]?.secure).toBe(true);
      } finally {
        if (originalEnv === undefined) {
          delete process.env.PDF_BASE_URL;
        } else {
          process.env.PDF_BASE_URL = originalEnv;
        }
      }
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
