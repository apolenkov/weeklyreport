import type {
  AssembledReport,
  PdfExportJob,
  PublishedReportSnapshot,
  UserSession,
} from "@customreport/shared";
import { AUTH_COOKIE_NAME } from "@customreport/shared";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";

import { type AppLogger, createNullLogger } from "../../lib/logger.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import { NOOP_PDF_EXPORT_TELEMETRY } from "../../test-utils/pdf-export.js";
import {
  dbStatusToDomain,
  type LockedPdfExportJobRow,
  PdfExportStateConflictError,
  pdfStatusToDb,
  toDomainStatus,
  toExportJob,
  UnsupportedPdfExportStatusError,
} from "./pdf-export.job-state.js";
import {
  type PdfExportEnqueuer,
  type PdfExportJobRecord,
  type PdfExportLockedJobWrites,
  type PdfExportPendingCandidate,
  type PdfExportPendingCursor,
  type PdfExportRepository,
  type PdfExportRetryOutcome,
  type PdfExportTelemetry,
} from "./pdf-export.ports.js";
import { PdfExportDomainError, PdfExportService } from "./pdf-export.service";

const reportId = "22222222-2222-4222-8222-222222222222";
const unknownReportId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TEST_PDF_SECRET = "test-pdf-export-secret-at-least-32-chars";
const NOOP_PDF_QUEUE: PdfExportEnqueuer = {
  enqueue: () => Promise.resolve(),
};

function createPdfExportService(
  repository: PdfExportRepository,
  logger: AppLogger = createNullLogger(),
  queue: PdfExportEnqueuer = NOOP_PDF_QUEUE,
  telemetry: PdfExportTelemetry = NOOP_PDF_EXPORT_TELEMETRY,
): PdfExportService {
  return new PdfExportService(repository, logger, queue, telemetry, {
    // An absent URL remains invalid for the required-value contract test.
    PDF_BASE_URL: process.env.PDF_BASE_URL ?? "",
    PDF_EXPORT_JWT_SECRET: process.env.PDF_EXPORT_JWT_SECRET ?? TEST_PDF_SECRET,
  });
}

beforeEach(() => {
  vi.stubEnv("PDF_EXPORT_JWT_SECRET", TEST_PDF_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});
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
  let lockChain: Promise<unknown> = Promise.resolve();

  function runLockedExportJob<T>(
    jobId: string,
    run: (
      job: PdfExportJobRecord | null,
      writes: PdfExportLockedJobWrites,
    ) => Promise<T>,
  ): Promise<T> {
    const execute = async (): Promise<T> => {
      const snapshot = jobs.get(jobId);
      const backup = snapshot ? structuredClone(snapshot) : undefined;
      const writes: PdfExportLockedJobWrites = {
        markFailed: (generation: number, _error: string) => {
          const current = jobs.get(jobId);
          if (
            current?.status === "queued" &&
            current.generation === generation
          ) {
            jobs.set(jobId, {
              ...current,
              status: "failed",
              artifactUrl: null,
              checksum: null,
            });
          }
          return Promise.resolve();
        },
        markCompleted: (
          generation: number,
          artifactUrl: string,
          checksum: string,
        ) => {
          const current = jobs.get(jobId);
          if (
            current?.status !== "queued" ||
            current.generation !== generation
          ) {
            return Promise.reject(
              new Error(`PDF export job ${jobId} is not pending.`),
            );
          }
          const completed: PdfExportJobRecord = {
            ...current,
            status: "completed",
            artifactUrl,
            checksum,
            completedAt: new Date(),
          };
          jobs.set(jobId, completed);
          return Promise.resolve(structuredClone(completed));
        },
        markRecoveryRequired: (generation: number) => {
          const current = jobs.get(jobId);
          if (
            current?.status !== "queued" ||
            current.generation !== generation
          ) {
            return Promise.reject(
              new Error(`PDF export job ${jobId} is not pending.`),
            );
          }
          jobs.set(jobId, { ...current, status: "recovery_required" });
          return Promise.resolve();
        },
        advanceGeneration: (expectedGeneration: number) => {
          const current = jobs.get(jobId);
          if (
            (current?.status !== "failed" &&
              current?.status !== "recovery_required") ||
            current.generation !== expectedGeneration
          ) {
            return Promise.reject(
              new Error(
                `PDF export job ${jobId} is not retryable at generation ${expectedGeneration}.`,
              ),
            );
          }
          jobs.set(jobId, {
            ...current,
            status: "queued",
            generation: expectedGeneration + 1,
            artifactUrl: null,
            checksum: null,
          });
          return Promise.resolve();
        },
      };
      try {
        return await run(snapshot ? structuredClone(snapshot) : null, writes);
      } catch (error) {
        if (backup === undefined) {
          jobs.delete(jobId);
        } else {
          jobs.set(jobId, backup);
        }
        throw error;
      }
    };
    const result = lockChain.then(execute);
    lockChain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return {
    getPublishedReportForExport(id: string) {
      return Promise.resolve(
        canRead && id === report?.reportId ? structuredClone(report) : null,
      );
    },
    getPublishedReportForJob() {
      return Promise.resolve(null as PublishedReportSnapshot | null);
    },
    createExportJob(job: PdfExportJob, requestedBy: string) {
      jobs.set(job.jobId, {
        ...structuredClone(job),
        requestedBy,
      });
      return Promise.resolve(structuredClone(job));
    },
    getExportJob(jobId: string) {
      const job = jobs.get(jobId);
      return Promise.resolve(job ? structuredClone(job) : null);
    },
    saveExportJob(job: PdfExportJob) {
      // Mirrors the repository's pending+generation CAS: a completion wins
      // only while the row is queued at the claimed generation; an identical
      // completed artifact reads back as an idempotent success.
      const current = jobs.get(job.jobId);
      if (
        current?.status === "queued" &&
        current.generation === job.generation
      ) {
        const completed: PdfExportJobRecord = {
          ...structuredClone(job),
          requestedBy: current.requestedBy,
        };
        jobs.set(job.jobId, completed);
        return Promise.resolve(structuredClone(completed));
      }
      if (
        current?.status === "completed" &&
        current.artifactUrl === job.artifactUrl &&
        current.checksum === job.checksum
      ) {
        return Promise.resolve(structuredClone(current));
      }
      return Promise.reject(
        new PdfExportStateConflictError(
          job.jobId,
          current?.status ?? "missing",
        ),
      );
    },
    markExportFailed(jobId: string, generation: number, _error: string) {
      const job = jobs.get(jobId);
      if (job?.status === "queued" && job.generation === generation) {
        jobs.set(jobId, { ...job, status: "failed" as const });
      }
      return Promise.resolve();
    },
    listPendingExportCandidates(
      bound: Date,
      cursor: PdfExportPendingCursor | null,
      limit: number,
    ): Promise<PdfExportPendingCandidate[]> {
      const matched = [...jobs.values()]
        .filter(
          (job) =>
            job.status === "queued" &&
            job.requestedAt <= bound &&
            (cursor === null ||
              job.requestedAt > cursor.createdAt ||
              (job.requestedAt.getTime() === cursor.createdAt.getTime() &&
                job.jobId > cursor.jobId)),
        )
        .sort(
          (a, b) =>
            a.requestedAt.getTime() - b.requestedAt.getTime() ||
            a.jobId.localeCompare(b.jobId),
        )
        .slice(0, limit)
        .map((job) => ({
          jobId: job.jobId,
          generation: job.generation,
          createdAt: job.requestedAt,
        }));
      return Promise.resolve(matched);
    },
    runLockedExportJob,
  };
}

function createMockQueue() {
  return { enqueue: vi.fn() };
}

describe("PdfExportService — contract tests", () => {
  describe("requestPdfExport", () => {
    it("creates a job for a published report", async () => {
      const service = createPdfExportService(createRepository(publishedReport));
      const job = await service.requestPdfExport(reportId, requesterSession);

      expect(job).toBeDefined();
      expect(job.reportId).toBe(reportId);
      expect(job.jobId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("throws PdfExportDomainError when report is not found", async () => {
      const service = createPdfExportService(createRepository(publishedReport));

      await expect(
        service.requestPdfExport(unknownReportId, requesterSession),
      ).rejects.toBeInstanceOf(PdfExportDomainError);

      await expect(
        service.requestPdfExport(unknownReportId, requesterSession),
      ).rejects.toThrow("PDF export is not available for this caller.");
    });

    it("throws PdfExportDomainError when report is a draft", async () => {
      const service = createPdfExportService(createRepository(draftReport));

      await expect(
        service.requestPdfExport(reportId, requesterSession),
      ).rejects.toBeInstanceOf(PdfExportDomainError);

      await expect(
        service.requestPdfExport(reportId, requesterSession),
      ).rejects.toThrow("PDF export requires a published report.");
    });

    it('creates a job with status "queued"', async () => {
      const service = createPdfExportService(createRepository(publishedReport));
      const job = await service.requestPdfExport(reportId, requesterSession);

      expect(job.status).toBe("queued");
    });

    it("enqueues a BullMQ job when a queue is provided", async () => {
      // The queue payload carries non-credential identifiers only (reportId,
      // jobId, requestedBy) — never the render JWT, which the worker mints at
      // execution time.
      const originalSecret = process.env.PDF_EXPORT_JWT_SECRET;
      process.env.PDF_EXPORT_JWT_SECRET = "a".repeat(32);
      try {
        const mockQueue = createMockQueue();
        const service = createPdfExportService(
          createRepository(publishedReport),
          undefined,
          mockQueue,
        );

        const job = await service.requestPdfExport(reportId, requesterSession);

        expect(mockQueue.enqueue).toHaveBeenCalledTimes(1);
        expect(mockQueue.enqueue).toHaveBeenCalledWith(
          {
            reportId,
            jobId: job.jobId,
            generation: 1,
            requestedBy: requesterSession.userId,
          },
          {},
        );
        const serialized = JSON.stringify(mockQueue.enqueue.mock.calls[0]?.[0]);
        expect(serialized).not.toContain("authToken");
        expect(serialized).not.toMatch(/eyJ/);
      } finally {
        if (originalSecret === undefined) {
          delete process.env.PDF_EXPORT_JWT_SECRET;
        } else {
          process.env.PDF_EXPORT_JWT_SECRET = originalSecret;
        }
      }
    });

    it("creates a queued job with the no-op enqueuer", async () => {
      const service = createPdfExportService(createRepository(publishedReport));
      const job = await service.requestPdfExport(reportId, requesterSession);

      expect(job).toBeDefined();
      expect(job.status).toBe("queued");
    });

    it('sets templateVersion to "phase-2-pdf-v1"', async () => {
      const service = createPdfExportService(createRepository(publishedReport));
      const job = await service.requestPdfExport(reportId, requesterSession);

      expect(job.templateVersion).toBe("phase-2-pdf-v1");
    });

    it("rejects a cross-group request before enqueue", async () => {
      const queue = createMockQueue();
      const service = createPdfExportService(
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
      const service = createPdfExportService(createRepository(publishedReport));
      const job = await service.requestPdfExport(reportId, requesterSession);
      expect(job.status).toBe("queued");

      const completed = await service.markExportCompleted(
        job.jobId,
        job.generation,
        "/exports/test.pdf",
        "sha256-test",
      );
      expect(completed.status).toBe("completed");
      expect(completed.completedAt).toBeInstanceOf(Date);
    });

    it("export job failure marks status as failed", async () => {
      const repo = createRepository(publishedReport);
      const service = createPdfExportService(repo);
      const job = await service.requestPdfExport(reportId, requesterSession);

      await service.markExportFailed(
        job.jobId,
        job.generation,
        "Browser crashed",
      );

      const fetched = await service.getPdfExportStatus(
        job.jobId,
        requesterSession.userId,
      );
      expect(fetched.status).toBe("failed");
    });

    it("created job has correct reportId and templateVersion", async () => {
      const service = createPdfExportService(createRepository(publishedReport));
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
      const service = createPdfExportService(createRepository(publishedReport));
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
      const service = createPdfExportService(createRepository(publishedReport));
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
      const service = createPdfExportService(createRepository(publishedReport));
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
      const service = createPdfExportService(createRepository(publishedReport));
      const queued = await service.requestPdfExport(reportId, requesterSession);

      const completed = await service.markExportCompleted(
        queued.jobId,
        queued.generation,
        "/exports/report-2026-04.pdf",
        "sha256-abc123",
      );

      expect(completed.status).toBe("completed");
      expect(completed.artifactUrl).toBe("/exports/report-2026-04.pdf");
      expect(completed.checksum).toBe("sha256-abc123");
    });

    it("sets completedAt timestamp", async () => {
      const service = createPdfExportService(createRepository(publishedReport));
      const queued = await service.requestPdfExport(reportId, requesterSession);

      const before = new Date();
      const completed = await service.markExportCompleted(
        queued.jobId,
        queued.generation,
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

      const service = createPdfExportService(repo);
      const queued = await service.requestPdfExport(reportId, requesterSession);

      await service.markExportFailed(
        queued.jobId,
        queued.generation,
        "Playwright timeout",
      );

      expect(markExportFailed).toHaveBeenCalledTimes(1);
      expect(markExportFailed).toHaveBeenCalledWith(
        queued.jobId,
        queued.generation,
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
        const service = createPdfExportService(
          createRepository(publishedReport),
        );
        expect(() => service.buildAuthCookies("jwt-token-value")).toThrow(
          /PDF_BASE_URL/,
        );
      } finally {
        if (originalBaseUrl !== undefined) {
          process.env.PDF_BASE_URL = originalBaseUrl;
        }
      }
    });

    // The accepted Gotenberg contract scopes the renderer cookie by host.
    it("scopes the Gotenberg cookie to the PDF_BASE_URL hostname for https", () => {
      const originalBaseUrl = process.env.PDF_BASE_URL;
      process.env.PDF_BASE_URL = "https://reports.company.com";

      try {
        const service = createPdfExportService(
          createRepository(publishedReport),
        );
        const cookies = service.buildAuthCookies("secure-token");

        expect(cookies).toEqual([
          {
            name: AUTH_COOKIE_NAME,
            value: "secure-token",
            domain: "reports.company.com",
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);
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

describe("generation recovery surface contracts", () => {
  // The orphan-scan probe and the retry outcome are the seam the scheduler
  // and admin surfaces bind to — pin the shapes they compiled against.
  it("scanOrphanedPendingExports takes a generation-scoped job probe", () => {
    expectTypeOf<PdfExportService["scanOrphanedPendingExports"]>()
      .parameter(0)
      .toEqualTypeOf<
        (
          candidate: Pick<PdfExportPendingCandidate, "jobId" | "generation">,
        ) => Promise<boolean>
      >();
  });

  it("retryExportGeneration resolves the documented outcome vocabulary", () => {
    expectTypeOf<PdfExportService["retryExportGeneration"]>()
      .parameter(0)
      .toEqualTypeOf<{
        readonly jobId: string;
        readonly expectedGeneration: number;
      }>();
    expectTypeOf<
      PdfExportService["retryExportGeneration"]
    >().returns.resolves.toEqualTypeOf<PdfExportRetryOutcome>();
    expectTypeOf<PdfExportRetryOutcome>().toEqualTypeOf<
      "retried" | "already-advanced" | "ineligible"
    >();
  });

  it("assertPdfExportJobIdentity is the pending+generation pre-render gate", () => {
    expectTypeOf<
      PdfExportService["assertPdfExportJobIdentity"]
    >().toEqualTypeOf<
      (
        jobId: string,
        reportId: string,
        requestedBy: string,
        generation: number,
      ) => Promise<void>
    >();
  });

  it("markExportCompleted claims a generation before artifact metadata", () => {
    expectTypeOf<PdfExportService["markExportCompleted"]>().toEqualTypeOf<
      (
        jobId: string,
        generation: number,
        artifactUrl: string,
        checksum: string,
      ) => Promise<PdfExportJob>
    >();
  });
});

describe("pdf-export job-state mapping", () => {
  function lockedRow(
    overrides: Partial<LockedPdfExportJobRow> = {},
  ): LockedPdfExportJobRow {
    return {
      id: "759b2767-0f86-41e2-b025-49730ca010e4",
      reportId,
      status: "pending",
      generation: 1,
      templateVersion: "phase-2-pdf-v1",
      filePath: null,
      checksum: null,
      error: null,
      requestedBy: requesterSession.userId,
      createdAt: new Date("2026-06-09T00:00:00Z"),
      updatedAt: new Date("2026-06-09T00:00:00Z"),
      ...overrides,
    };
  }

  it("maps every durable status to its domain status", () => {
    expect(dbStatusToDomain.pending).toBe("queued");
    expect(dbStatusToDomain.completed).toBe("completed");
    expect(dbStatusToDomain.failed).toBe("failed");
    expect(dbStatusToDomain.recovery_required).toBe("recovery_required");
    expect(toDomainStatus("recovery_required")).toBe("recovery_required");
  });

  it("maps every domain status back to its durable status", () => {
    expect(pdfStatusToDb.queued).toBe("pending");
    expect(pdfStatusToDb.completed).toBe("completed");
    expect(pdfStatusToDb.failed).toBe("failed");
    expect(pdfStatusToDb.recovery_required).toBe("recovery_required");
  });

  it("still throws UnsupportedPdfExportStatusError on unknown statuses", () => {
    expect(() => toDomainStatus("paused")).toThrow(
      UnsupportedPdfExportStatusError,
    );
    expect(() => toExportJob(lockedRow({ status: "paused" }))).toThrow(
      UnsupportedPdfExportStatusError,
    );
  });

  it("carries generation and recovery_required through toExportJob", () => {
    const record = toExportJob(
      lockedRow({ status: "recovery_required", generation: 3 }),
    );

    expect(record).toMatchObject({
      jobId: "759b2767-0f86-41e2-b025-49730ca010e4",
      reportId,
      status: "recovery_required",
      generation: 3,
      requestedBy: requesterSession.userId,
    });
  });
});
