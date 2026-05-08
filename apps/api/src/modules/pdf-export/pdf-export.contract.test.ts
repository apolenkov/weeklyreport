import { describe, expect, it, vi } from 'vitest';

import type { AssembledReport, PdfExportJob } from '@customreport/shared';

import {
  PdfExportDomainError,
  PdfExportService,
  type PdfExportJobRecord,
  type PdfExportRepository,
} from './pdf-export.service';
import { expectDefined } from '../../test-utils/expect-defined.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const reportId = '22222222-2222-4222-8222-222222222222';
const unknownReportId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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

// ---------------------------------------------------------------------------
// In-memory repository
// ---------------------------------------------------------------------------

function createRepository(report: AssembledReport | null): PdfExportRepository {
  const jobs = new Map<string, PdfExportJobRecord>();

  return {
    async getPublishedReport(id: string) {
      if (report && id === report.reportId) {
        return structuredClone(report);
      }
      return null;
    },
    async createExportJob(job: PdfExportJob, requestedBy?: string) {
      jobs.set(job.jobId, {
        ...structuredClone(job),
        requestedBy: requestedBy ?? 'system',
      });
      return structuredClone(job);
    },
    async getExportJob(jobId: string) {
      const job = jobs.get(jobId);
      return job ? structuredClone(job) : null;
    },
    async saveExportJob(job: PdfExportJob) {
      jobs.set(job.jobId, {
        ...structuredClone(job),
        requestedBy: jobs.get(job.jobId)?.requestedBy ?? 'system',
      });
      return structuredClone(job);
    },
    async markExportFailed(jobId: string, _error: string) {
      const job = jobs.get(jobId);
      if (job) {
        jobs.set(jobId, { ...job, status: 'failed' as const });
      }
    },
  };
}

function createMockQueue() {
  return { add: vi.fn() };
}

// ---------------------------------------------------------------------------
// Contract tests
// ---------------------------------------------------------------------------

describe('PdfExportService — contract tests', () => {
  // 1. requestPdfExport — creates job for published report
  describe('requestPdfExport', () => {
    it('creates a job for a published report', async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const job = await service.requestPdfExport(reportId);

      expect(job).toBeDefined();
      expect(job.reportId).toBe(reportId);
      expect(job.jobId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    // 2. requestPdfExport — throws PdfExportDomainError when report not found (null)
    it('throws PdfExportDomainError when report is not found', async () => {
      const service = new PdfExportService(createRepository(publishedReport));

      await expect(
        service.requestPdfExport(unknownReportId),
      ).rejects.toBeInstanceOf(PdfExportDomainError);

      await expect(
        service.requestPdfExport(unknownReportId),
      ).rejects.toThrow('PDF export requires a published report.');
    });

    // 3. requestPdfExport — throws when report status is draft (not published)
    it('throws PdfExportDomainError when report is a draft', async () => {
      const service = new PdfExportService(createRepository(draftReport));

      await expect(
        service.requestPdfExport(reportId),
      ).rejects.toBeInstanceOf(PdfExportDomainError);

      await expect(
        service.requestPdfExport(reportId),
      ).rejects.toThrow('PDF export requires a published report.');
    });

    // 4. requestPdfExport — created job has status 'queued'
    it('creates a job with status "queued"', async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const job = await service.requestPdfExport(reportId);

      expect(job.status).toBe('queued');
    });

    // 5. requestPdfExport — enqueues BullMQ job when queue is provided
    it('enqueues a BullMQ job when a queue is provided', async () => {
      // AUTH-05 (Phase 28-02): the queue payload now carries an authToken
      // signed with PDF_EXPORT_JWT_SECRET. Stub the secret for deterministic
      // signing.
      const originalSecret = process.env['PDF_EXPORT_JWT_SECRET'];
      process.env['PDF_EXPORT_JWT_SECRET'] = 'a'.repeat(32);
      try {
        const mockQueue = createMockQueue();
        const service = new PdfExportService(
          createRepository(publishedReport),
          undefined,
          mockQueue as unknown as import('bullmq').Queue,
        );

        const job = await service.requestPdfExport(reportId);

        expect(mockQueue.add).toHaveBeenCalledTimes(1);
        expect(mockQueue.add).toHaveBeenCalledWith(
          'generate',
          expect.objectContaining({
            reportId,
            jobId: job.jobId,
            authToken: expect.stringMatching(/^eyJ/),
          }),
          { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
        );
      } finally {
        if (originalSecret === undefined) {
          delete process.env['PDF_EXPORT_JWT_SECRET'];
        } else {
          process.env['PDF_EXPORT_JWT_SECRET'] = originalSecret;
        }
      }
    });

    // 6. requestPdfExport — works without queue (null queue)
    it('works without a queue (null queue)', async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const job = await service.requestPdfExport(reportId);

      expect(job).toBeDefined();
      expect(job.status).toBe('queued');
    });

    // 7. requestPdfExport — sets templateVersion to 'phase-2-pdf-v1'
    it('sets templateVersion to "phase-2-pdf-v1"', async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const job = await service.requestPdfExport(reportId);

      expect(job.templateVersion).toBe('phase-2-pdf-v1');
    });
  });

  // P0 Regression — export job status transitions (PDF-010, PDF-011)
  describe('requestPdfExport — job lifecycle', () => {
    it('export job transitions: queued -> completed (PDF-010)', async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const job = await service.requestPdfExport(reportId);
      expect(job.status).toBe('queued');

      const completed = await service.markExportCompleted(
        job.jobId,
        '/exports/test.pdf',
        'sha256-test',
      );
      expect(completed.status).toBe('completed');
      expect(completed.completedAt).toBeInstanceOf(Date);
    });

    it('export job failure marks status as failed (PDF-011)', async () => {
      const repo = createRepository(publishedReport);
      const service = new PdfExportService(repo);
      const job = await service.requestPdfExport(reportId);

      await service.markExportFailed(job.jobId, 'Browser crashed');

      const fetched = await service.getPdfExportStatus(job.jobId);
      expect(fetched.status).toBe('failed');
    });

    it('created job has correct reportId and templateVersion', async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const job = await service.requestPdfExport(reportId);

      expect(job.reportId).toBe(reportId);
      expect(job.templateVersion).toBe('phase-2-pdf-v1');
      expect(job.status).toBe('queued');
      expect(job.artifactUrl).toBeNull();
      expect(job.checksum).toBeNull();
      expect(job.completedAt).toBeNull();
    });
  });

  // 8. getPdfExportStatus — returns job when found
  describe('getPdfExportStatus', () => {
    it('returns the job when found', async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const created = await service.requestPdfExport(reportId);

      const fetched = await service.getPdfExportStatus(created.jobId);

      expect(fetched.jobId).toBe(created.jobId);
      expect(fetched.reportId).toBe(reportId);
      expect(fetched.status).toBe('queued');
    });

    it('does not reveal a job to a different requester', async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const ownerId = '00000000-0000-4000-8000-00000000aaaa';
      const otherId = '00000000-0000-4000-8000-00000000bbbb';
      const created = await service.requestPdfExport(reportId, ownerId);

      await expect(
        service.getPdfExportStatus(created.jobId, otherId),
      ).rejects.toThrow(`PDF export job ${created.jobId} was not found.`);
    });

    // 9. getPdfExportStatus — throws PdfExportDomainError when job not found
    it('throws PdfExportDomainError when job is not found', async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const missingJobId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

      await expect(
        service.getPdfExportStatus(missingJobId),
      ).rejects.toBeInstanceOf(PdfExportDomainError);

      await expect(
        service.getPdfExportStatus(missingJobId),
      ).rejects.toThrow(`PDF export job ${missingJobId} was not found.`);
    });
  });

  // 10. markExportCompleted — sets status to completed with artifactUrl and checksum
  describe('markExportCompleted', () => {
    it('sets status to "completed" with artifactUrl and checksum', async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const queued = await service.requestPdfExport(reportId);

      const completed = await service.markExportCompleted(
        queued.jobId,
        '/exports/report-2026-04.pdf',
        'sha256-abc123',
      );

      expect(completed.status).toBe('completed');
      expect(completed.artifactUrl).toBe('/exports/report-2026-04.pdf');
      expect(completed.checksum).toBe('sha256-abc123');
    });

    // 11. markExportCompleted — sets completedAt timestamp
    it('sets completedAt timestamp', async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const queued = await service.requestPdfExport(reportId);

      const before = new Date();
      const completed = await service.markExportCompleted(
        queued.jobId,
        '/exports/report.pdf',
        'checksum-value',
      );
      const after = new Date();

      expect(completed.completedAt).toBeInstanceOf(Date);
      expect(expectDefined(completed.completedAt).getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(expectDefined(completed.completedAt).getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  // 12. markExportFailed — delegates to repository
  describe('markExportFailed', () => {
    it('delegates to the repository', async () => {
      const repo = createRepository(publishedReport);
      const markExportFailedCalls: Array<{ jobId: string; error: string }> = [];
      const originalFn = repo.markExportFailed.bind(repo);
      repo.markExportFailed = async (jobId: string, error: string) => {
        markExportFailedCalls.push({ jobId, error });
        return originalFn(jobId, error);
      };

      const service = new PdfExportService(repo);
      const queued = await service.requestPdfExport(reportId);

      await service.markExportFailed(queued.jobId, 'Playwright timeout');

      expect(markExportFailedCalls).toHaveLength(1);
      expect(markExportFailedCalls[0]).toEqual({
        jobId: queued.jobId,
        error: 'Playwright timeout',
      });
    });
  });

  // 13-15. buildAuthCookies
  describe('buildAuthCookies', () => {
    // 13. buildAuthCookies — returns correct cookie config with default env
    it('returns correct cookie config with default env', () => {
      const originalCookieName = process.env.AUTH_JWT_COOKIE_NAME;
      const originalBaseUrl = process.env.PDF_BASE_URL;
      delete process.env.AUTH_JWT_COOKIE_NAME;
      delete process.env.PDF_BASE_URL;

      try {
        const service = new PdfExportService(createRepository(publishedReport));
        const cookies = service.buildAuthCookies('jwt-token-value');

        expect(cookies).toHaveLength(1);
        // Phase 32-B2 (M-01): cookie scope is now url-based.
        expect(cookies[0]).toEqual({
          name: 'customreport_session',
          value: 'jwt-token-value',
          url: 'http://localhost:3000',
          httpOnly: true,
          sameSite: 'Lax',
        });
      } finally {
        if (originalCookieName !== undefined) {
          process.env.AUTH_JWT_COOKIE_NAME = originalCookieName;
        }
        if (originalBaseUrl !== undefined) {
          process.env.PDF_BASE_URL = originalBaseUrl;
        }
      }
    });

    // 14. buildAuthCookies — respects AUTH_JWT_COOKIE_NAME env
    it('respects AUTH_JWT_COOKIE_NAME env variable', () => {
      const originalCookieName = process.env.AUTH_JWT_COOKIE_NAME;
      process.env.AUTH_JWT_COOKIE_NAME = 'custom_auth_token';

      try {
        const service = new PdfExportService(createRepository(publishedReport));
        const cookies = service.buildAuthCookies('my-jwt');

        expect(expectDefined(cookies[0]).name).toBe('custom_auth_token');
        expect(expectDefined(cookies[0]).value).toBe('my-jwt');
      } finally {
        if (originalCookieName === undefined) {
          delete process.env.AUTH_JWT_COOKIE_NAME;
        } else {
          process.env.AUTH_JWT_COOKIE_NAME = originalCookieName;
        }
      }
    });

    // 15. buildAuthCookies — Phase 32-B2 (M-01): cookie is now scoped via
    // Playwright's `url` field rather than `domain`+`secure` inference.
    // Playwright auto-derives the secure flag from the URL's protocol.
    it('passes the full PDF_BASE_URL through as the cookie url for https', () => {
      const originalBaseUrl = process.env.PDF_BASE_URL;
      process.env.PDF_BASE_URL = 'https://reports.company.com';

      try {
        const service = new PdfExportService(createRepository(publishedReport));
        const cookies = service.buildAuthCookies('secure-token');

        expect(expectDefined(cookies[0]).url).toBe('https://reports.company.com');
      } finally {
        if (originalBaseUrl === undefined) {
          delete process.env.PDF_BASE_URL;
        } else {
          process.env.PDF_BASE_URL = originalBaseUrl;
        }
      }
    });
  });
});
