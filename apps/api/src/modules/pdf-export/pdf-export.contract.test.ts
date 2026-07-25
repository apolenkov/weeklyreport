import type {
  AssembledReport,
  PdfExportJob,
  UserSession,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  PdfExportDomainError,
  type PdfExportJobRecord,
  type PdfExportRepository,
  PdfExportService,
} from "./pdf-export.service";

const reportId = "22222222-2222-4222-8222-222222222222";
const unknownReportId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const requesterSession: UserSession = {
  userId: "00000000-0000-4000-8000-00000000aaaa",
  email: "head@test.local",
  name: "Head",
  role: "head",
  activeReportId: reportId,
  activeReportSectionId: null,
  reportingGroupId: "00000000-0000-4000-8000-000000000301",
};

function sessionFor(userId: string): UserSession {
  return { ...requesterSession, userId };
}

const publishedReport: AssembledReport = {
  reportId,
  periodStart: new Date("2026-04-06T00:00:00.000Z"),
  periodEnd: new Date("2026-04-12T23:59:59.000Z"),
  deadline: new Date("2026-04-10T15:00:00.000Z"),
  status: "published",
  publishedAt: new Date("2026-04-09T14:00:00.000Z"),
  publishedById: "00000000-0000-4000-8000-000000000001",
  publishedByName: "Department Head",
  portfolioOverview: {
    status: "yellow",
    totals: { green: 1, yellow: 2, red: 0 },
  },
  sections: [],
};

const draftReport: AssembledReport = {
  ...publishedReport,
  status: "draft",
  publishedAt: null,
  publishedById: null,
  publishedByName: null,
};

function createRepository(
  report: AssembledReport | null,
  canRead = true,
): PdfExportRepository {
  const jobs = new Map<string, PdfExportJobRecord>();

  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async PdfExportRepository contract (no awaitable work in the stub)
    async canReadReport() {
      return canRead;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async PdfExportRepository contract (no awaitable work in the stub)
    async getPublishedReport(id: string) {
      if (id === report?.reportId) {
        return structuredClone(report);
      }
      return null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async PdfExportRepository contract (no awaitable work in the stub)
    async createExportJob(job: PdfExportJob, requestedBy?: string) {
      jobs.set(job.jobId, {
        ...structuredClone(job),
        requestedBy: requestedBy ?? "system",
      });
      return structuredClone(job);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async PdfExportRepository contract (no awaitable work in the stub)
    async getExportJob(jobId: string) {
      const job = jobs.get(jobId);
      return job ? structuredClone(job) : null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async PdfExportRepository contract (no awaitable work in the stub)
    async saveExportJob(job: PdfExportJob) {
      jobs.set(job.jobId, {
        ...structuredClone(job),
        requestedBy: jobs.get(job.jobId)?.requestedBy ?? "system",
      });
      return structuredClone(job);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async PdfExportRepository contract (no awaitable work in the stub)
    async markExportFailed(jobId: string, _error: string) {
      const job = jobs.get(jobId);
      if (job) {
        jobs.set(jobId, { ...job, status: "failed" as const });
      }
    },
  };
}

function createMockQueue() {
  return { enqueue: vi.fn() };
}

describe("PdfExportService — contract tests", () => {
  describe("requestPdfExport", () => {
    it("creates a job for a published report", async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const job = await service.requestPdfExport(reportId, requesterSession);

      expect(job).toBeDefined();
      expect(job.reportId).toBe(reportId);
      expect(job.jobId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("throws PdfExportDomainError when report is not found", async () => {
      const service = new PdfExportService(createRepository(publishedReport));

      await expect(
        service.requestPdfExport(unknownReportId, requesterSession),
      ).rejects.toBeInstanceOf(PdfExportDomainError);

      await expect(
        service.requestPdfExport(unknownReportId, requesterSession),
      ).rejects.toThrow("PDF export requires a published report.");
    });

    it("throws PdfExportDomainError when report is a draft", async () => {
      const service = new PdfExportService(createRepository(draftReport));

      await expect(
        service.requestPdfExport(reportId, requesterSession),
      ).rejects.toBeInstanceOf(PdfExportDomainError);

      await expect(
        service.requestPdfExport(reportId, requesterSession),
      ).rejects.toThrow("PDF export requires a published report.");
    });

    it('creates a job with status "queued"', async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const job = await service.requestPdfExport(reportId, requesterSession);

      expect(job.status).toBe("queued");
    });

    it("enqueues a BullMQ job when a queue is provided", async () => {
      // The queue payload carries an authToken signed with
      // PDF_EXPORT_JWT_SECRET. Stub the secret for deterministic signing.
      const originalSecret = process.env.PDF_EXPORT_JWT_SECRET;
      process.env.PDF_EXPORT_JWT_SECRET = "a".repeat(32);
      try {
        const mockQueue = createMockQueue();
        const service = new PdfExportService(
          createRepository(publishedReport),
          undefined,
          mockQueue,
        );

        const job = await service.requestPdfExport(reportId, requesterSession);

        expect(mockQueue.enqueue).toHaveBeenCalledTimes(1);
        expect(mockQueue.enqueue).toHaveBeenCalledWith(
          expect.objectContaining({
            reportId,
            jobId: job.jobId,
            authToken: expect.stringMatching(/^eyJ/) as unknown,
          }),
          {},
        );
      } finally {
        if (originalSecret === undefined) {
          delete process.env.PDF_EXPORT_JWT_SECRET;
        } else {
          process.env.PDF_EXPORT_JWT_SECRET = originalSecret;
        }
      }
    });

    it("works without a queue (null queue)", async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const job = await service.requestPdfExport(reportId, requesterSession);

      expect(job).toBeDefined();
      expect(job.status).toBe("queued");
    });

    it('sets templateVersion to "phase-2-pdf-v1"', async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const job = await service.requestPdfExport(reportId, requesterSession);

      expect(job.templateVersion).toBe("phase-2-pdf-v1");
    });

    it("rejects a cross-group request before enqueue", async () => {
      const queue = createMockQueue();
      const service = new PdfExportService(
        createRepository(publishedReport, false),
        undefined,
        queue,
      );

      await expect(
        service.requestPdfExport(reportId, requesterSession),
      ).rejects.toThrow("PDF export is not available for this caller.");
      expect(queue.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("requestPdfExport — job lifecycle", () => {
    it("export job transitions: queued -> completed", async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const job = await service.requestPdfExport(reportId, requesterSession);
      expect(job.status).toBe("queued");

      const completed = await service.markExportCompleted(
        job.jobId,
        "/exports/test.pdf",
        "sha256-test",
      );
      expect(completed.status).toBe("completed");
      expect(completed.completedAt).toBeInstanceOf(Date);
    });

    it("export job failure marks status as failed", async () => {
      const repo = createRepository(publishedReport);
      const service = new PdfExportService(repo);
      const job = await service.requestPdfExport(reportId, requesterSession);

      await service.markExportFailed(job.jobId, "Browser crashed");

      const fetched = await service.getPdfExportStatus(
        job.jobId,
        requesterSession.userId,
      );
      expect(fetched.status).toBe("failed");
    });

    it("created job has correct reportId and templateVersion", async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const job = await service.requestPdfExport(reportId, requesterSession);

      expect(job.reportId).toBe(reportId);
      expect(job.templateVersion).toBe("phase-2-pdf-v1");
      expect(job.status).toBe("queued");
      expect(job.artifactUrl).toBeNull();
      expect(job.checksum).toBeNull();
      expect(job.completedAt).toBeNull();
    });
  });

  describe("getPdfExportStatus", () => {
    it("returns the job when found", async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const created = await service.requestPdfExport(
        reportId,
        requesterSession,
      );

      const fetched = await service.getPdfExportStatus(
        created.jobId,
        requesterSession.userId,
      );

      expect(fetched.jobId).toBe(created.jobId);
      expect(fetched.reportId).toBe(reportId);
      expect(fetched.status).toBe("queued");
    });

    it("does not reveal a job to a different requester", async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const ownerId = "00000000-0000-4000-8000-00000000aaaa";
      const otherId = "00000000-0000-4000-8000-00000000bbbb";
      const created = await service.requestPdfExport(
        reportId,
        sessionFor(ownerId),
      );

      await expect(
        service.getPdfExportStatus(created.jobId, otherId),
      ).rejects.toThrow(`PDF export job ${created.jobId} was not found.`);
    });

    it("throws PdfExportDomainError when job is not found", async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const missingJobId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

      await expect(
        service.getPdfExportStatus(missingJobId, requesterSession.userId),
      ).rejects.toBeInstanceOf(PdfExportDomainError);

      await expect(
        service.getPdfExportStatus(missingJobId, requesterSession.userId),
      ).rejects.toThrow(`PDF export job ${missingJobId} was not found.`);
    });
  });

  describe("markExportCompleted", () => {
    it('sets status to "completed" with artifactUrl and checksum', async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const queued = await service.requestPdfExport(reportId, requesterSession);

      const completed = await service.markExportCompleted(
        queued.jobId,
        "/exports/report-2026-04.pdf",
        "sha256-abc123",
      );

      expect(completed.status).toBe("completed");
      expect(completed.artifactUrl).toBe("/exports/report-2026-04.pdf");
      expect(completed.checksum).toBe("sha256-abc123");
    });

    it("sets completedAt timestamp", async () => {
      const service = new PdfExportService(createRepository(publishedReport));
      const queued = await service.requestPdfExport(reportId, requesterSession);

      const before = new Date();
      const completed = await service.markExportCompleted(
        queued.jobId,
        "/exports/report.pdf",
        "checksum-value",
      );
      const after = new Date();

      expect(completed.completedAt).toBeInstanceOf(Date);
      expect(
        expectDefined(completed.completedAt).getTime(),
      ).toBeGreaterThanOrEqual(before.getTime());
      expect(
        expectDefined(completed.completedAt).getTime(),
      ).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("markExportFailed", () => {
    it("delegates to the repository", async () => {
      const repo = createRepository(publishedReport);
      // spyOn calls through, so the repository still records the failure.
      const markExportFailed = vi.spyOn(repo, "markExportFailed");

      const service = new PdfExportService(repo);
      const queued = await service.requestPdfExport(reportId, requesterSession);

      await service.markExportFailed(queued.jobId, "Playwright timeout");

      expect(markExportFailed).toHaveBeenCalledTimes(1);
      expect(markExportFailed).toHaveBeenCalledWith(
        queued.jobId,
        "Playwright timeout",
      );
    });
  });

  describe("buildAuthCookies", () => {
    // PDF_BASE_URL is required (no in-code fallback): its absence throws
    // rather than silently scoping the cookie to localhost.
    it("throws when PDF_BASE_URL is absent (no fallback)", () => {
      const originalBaseUrl = process.env.PDF_BASE_URL;
      delete process.env.PDF_BASE_URL;

      try {
        const service = new PdfExportService(createRepository(publishedReport));
        expect(() => service.buildAuthCookies("jwt-token-value")).toThrow(
          /PDF_BASE_URL/,
        );
      } finally {
        if (originalBaseUrl !== undefined) {
          process.env.PDF_BASE_URL = originalBaseUrl;
        }
      }
    });

    it("respects AUTH_JWT_COOKIE_NAME env variable", () => {
      const originalCookieName = process.env.AUTH_JWT_COOKIE_NAME;
      process.env.AUTH_JWT_COOKIE_NAME = "custom_auth_token";

      try {
        const service = new PdfExportService(createRepository(publishedReport));
        const cookies = service.buildAuthCookies("my-jwt");

        expect(expectDefined(cookies[0]).name).toBe("custom_auth_token");
        expect(expectDefined(cookies[0]).value).toBe("my-jwt");
      } finally {
        if (originalCookieName === undefined) {
          delete process.env.AUTH_JWT_COOKIE_NAME;
        } else {
          process.env.AUTH_JWT_COOKIE_NAME = originalCookieName;
        }
      }
    });

    // Cookie is scoped via Playwright's `url` field rather than
    // `domain`+`secure` inference. Playwright auto-derives the secure flag
    // from the URL's protocol.
    it("passes the full PDF_BASE_URL through as the cookie url for https", () => {
      const originalBaseUrl = process.env.PDF_BASE_URL;
      process.env.PDF_BASE_URL = "https://reports.company.com";

      try {
        const service = new PdfExportService(createRepository(publishedReport));
        const cookies = service.buildAuthCookies("secure-token");

        expect(expectDefined(cookies[0]).url).toBe(
          "https://reports.company.com",
        );
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
