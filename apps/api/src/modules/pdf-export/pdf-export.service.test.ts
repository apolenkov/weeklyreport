import {
  type AssembledReport,
  AUTH_COOKIE_NAME,
  type PdfExportJob,
  pdfExportJobSchema,
  type PublishedReportSnapshot,
  type UserSession,
} from "@weeklyreport/shared";
import jwt from "jsonwebtoken";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";

import type { EnvConfig } from "../../infrastructure/config/env.schema.js";
import { weeklyreportPdfExportRequestsTotal } from "../../infrastructure/metrics/metrics.registry.js";
import { type AppLogger, createNullLogger } from "../../lib/logger.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import { NOOP_PDF_EXPORT_TELEMETRY } from "../../test-utils/pdf-export.js";
import {
  PdfExportDomainError,
  PdfExportStateConflictError,
} from "./pdf-export.job-state.js";
import {
  type PdfExportEnqueueInput,
  type PdfExportEnqueuer,
  type PdfExportJobIdentity,
  type PdfExportJobRecord,
  type PdfExportLockedJobWrites,
  type PdfExportPendingCandidate,
  type PdfExportPendingCursor,
  type PdfExportRepository,
  type PdfExportTelemetry,
  type PdfExportTerminalState,
} from "./pdf-export.ports.js";
import { PdfExportService } from "./pdf-export.service";
import { verifyPdfExportToken as verifyPdfExportTokenImpl } from "./pdf-export.token";
import { PdfExportInfrastructureTelemetry } from "./pdf-export-telemetry.adapter.js";

const reportId = "22222222-2222-4222-8222-222222222222";
const TEST_PDF_SECRET = "test-pdf-export-secret-at-least-32-chars";
const NOOP_PDF_QUEUE: PdfExportEnqueuer = {
  enqueue: () => Promise.resolve(),
};
const verifyPdfExportToken = (token: string) =>
  verifyPdfExportTokenImpl(token, process.env.PDF_EXPORT_JWT_SECRET);

function createPdfExportService(
  repository: PdfExportRepository,
  logger: AppLogger = createNullLogger(),
  queue: PdfExportEnqueuer = NOOP_PDF_QUEUE,
  telemetry: PdfExportTelemetry = NOOP_PDF_EXPORT_TELEMETRY,
): PdfExportService {
  return new PdfExportService(repository, logger, queue, telemetry, {
    PDF_BASE_URL: process.env.PDF_BASE_URL ?? "http://localhost:3000",
    PDF_EXPORT_JWT_SECRET: process.env.PDF_EXPORT_JWT_SECRET ?? TEST_PDF_SECRET,
  });
}

beforeEach(() => {
  vi.stubEnv("PDF_EXPORT_JWT_SECRET", TEST_PDF_SECRET);
  vi.stubEnv("PDF_BASE_URL", "http://localhost:3000");
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

function sessionFor(
  userId: string,
  role: UserSession["role"] = "head",
): UserSession {
  return { ...requesterSession, userId, role };
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
  capture?: {
    lastRequestedBy?: string;
    lastCreatedJobId?: string;
    events?: string[];
  },
  canRead = true,
): PdfExportRepository {
  const jobs = new Map<string, PdfExportJobRecord>();
  // Serializes lock holders in arrival order like FOR UPDATE does; a rejected
  // callback restores the pre-transaction row like a rollback.
  let lockChain: Promise<unknown> = Promise.resolve();

  function runLockedExportJob<T>(
    jobId: string,
    run: (
      job: PdfExportJobRecord | null,
      writes: PdfExportLockedJobWrites,
    ) => Promise<T>,
  ): Promise<T> {
    const execute = async (): Promise<T> => {
      capture?.events?.push("lock:acquire");
      try {
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
      } finally {
        capture?.events?.push("lock:release");
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
    getPublishedReportForExport() {
      return Promise.resolve(canRead ? structuredClone(report) : null);
    },
    getPublishedReportForJob() {
      return Promise.resolve(null as PublishedReportSnapshot | null);
    },
    createExportJob(job: PdfExportJob, requestedBy: string) {
      if (capture) {
        capture.lastRequestedBy = requestedBy;
        capture.lastCreatedJobId = job.jobId;
      }
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

describe("PdfExportService", () => {
  it("rejects a reopened report without creating or enqueuing a job", async () => {
    const repository = createRepository(null);
    const createExportJob = vi.spyOn(repository, "createExportJob");
    const queue = { enqueue: vi.fn() };
    const service = createPdfExportService(repository, undefined, queue);

    await expect(
      service.requestPdfExport(reportId, requesterSession),
    ).rejects.toThrow(
      new PdfExportDomainError("PDF export is not available for this caller."),
    );
    expect(createExportJob).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("rejects export requests for unpublished reports", async () => {
    const service = createPdfExportService(createRepository(draftReport));

    await expect(
      service.requestPdfExport(reportId, requesterSession),
    ).rejects.toBeInstanceOf(PdfExportDomainError);
  });

  it("creates an async queued export job for a published report", async () => {
    const service = createPdfExportService(createRepository(publishedReport));
    const job = await service.requestPdfExport(reportId, requesterSession);

    expect(job.reportId).toBe(reportId);
    expect(job.status).toBe("queued");
    expect(job.templateVersion).toBe("phase-2-pdf-v1");
  });

  it("marks export jobs complete with deterministic metadata", async () => {
    const service = createPdfExportService(createRepository(publishedReport));
    const queued = await service.requestPdfExport(reportId, requesterSession);
    const completed = await service.markExportCompleted(
      queued.jobId,
      queued.generation,
      "/exports/report.pdf",
      "phase-2-demo-checksum",
    );

    expect(completed.status).toBe("completed");
    expect(completed.checksum).toBe("phase-2-demo-checksum");
    expect(completed.artifactUrl).toBe("/exports/report.pdf");
  });

  it("threads requestedBy from the session userId into createExportJob", async () => {
    const capture: { lastRequestedBy?: string } = {};
    const service = createPdfExportService(
      createRepository(publishedReport, capture),
    );
    const sessionUserId = "00000000-0000-4000-8000-00000000abcd";

    await service.requestPdfExport(reportId, sessionFor(sessionUserId));

    expect(capture.lastRequestedBy).toBe(sessionUserId);
  });

  it("always attributes the job to the required session", async () => {
    const capture: { lastRequestedBy?: string } = {};
    const service = createPdfExportService(
      createRepository(publishedReport, capture),
    );

    await service.requestPdfExport(reportId, requesterSession);

    expect(capture.lastRequestedBy).toBe(requesterSession.userId);
  });

  it("still rejects unpublished reports even when a requestedBy is supplied", async () => {
    const service = createPdfExportService(createRepository(draftReport));

    await expect(
      service.requestPdfExport(
        reportId,
        sessionFor("00000000-0000-4000-8000-00000000abcd"),
      ),
    ).rejects.toBeInstanceOf(PdfExportDomainError);
  });

  it("hides export status from a different requester", async () => {
    const service = createPdfExportService(createRepository(publishedReport));
    const ownerId = "00000000-0000-4000-8000-00000000aaaa";
    const otherId = "00000000-0000-4000-8000-00000000bbbb";
    const job = await service.requestPdfExport(reportId, sessionFor(ownerId));

    await expect(
      service.getPdfExportStatus(job.jobId, otherId),
    ).rejects.toThrow(`PDF export job ${job.jobId} was not found.`);

    await expect(
      service.getPdfExportStatus(job.jobId, ownerId),
    ).resolves.toMatchObject({ jobId: job.jobId });

    expectTypeOf<PdfExportService["getPdfExportStatus"]>()
      .parameter(1)
      .toEqualTypeOf<string>();
  });

  it("rejects an out-of-scope report before enqueue", async () => {
    const queue = { enqueue: vi.fn() };
    const service = createPdfExportService(
      createRepository(publishedReport, undefined, false),
      undefined,
      queue,
    );

    await expect(
      service.requestPdfExport(reportId, requesterSession),
    ).rejects.toThrow("PDF export is not available for this caller.");
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("does not increment requests_total when enqueue fails", async () => {
    const queue = {
      enqueue: vi.fn().mockRejectedValue(new Error("Redis down")),
    };
    const service = createPdfExportService(
      createRepository(publishedReport),
      undefined,
      queue,
      new PdfExportInfrastructureTelemetry(null),
    );
    const before = await getCounterValue(weeklyreportPdfExportRequestsTotal, {
      role: "head",
    });

    await expect(
      service.requestPdfExport(reportId, requesterSession, "head"),
    ).rejects.toThrow("Redis down");

    expect(
      await getCounterValue(weeklyreportPdfExportRequestsTotal, {
        role: "head",
      }),
    ).toBe(before);
  });

  it("requires real logger and telemetry collaborators at the composition boundary", () => {
    // The constructor must demand a real logger and telemetry (no
    // `?? createNullLogger()` / NOOP default), so a miswired module fails to
    // compile instead of silently degrading.
    expectTypeOf<
      ConstructorParameters<typeof PdfExportService>
    >().toEqualTypeOf<
      [
        PdfExportRepository,
        AppLogger,
        PdfExportEnqueuer,
        PdfExportTelemetry,
        Pick<EnvConfig, "PDF_BASE_URL" | "PDF_EXPORT_JWT_SECRET">,
      ]
    >();
  });

  it("marks the queued row failed when enqueue throws (never a queued row without a job)", async () => {
    // A Redis command already issued with unknown outcome cannot be
    // cancelled when the row lock releases: a lost ack may still have added
    // the job. Failing the generation-1 row keeps the breakage visible, and
    // the worker's pending+generation gate contains a late-executing job.
    const capture: { lastCreatedJobId?: string } = {};
    const repository = createRepository(publishedReport, capture);
    const queue = {
      enqueue: vi.fn().mockRejectedValue(new Error("Redis down")),
    };
    const service = createPdfExportService(repository, undefined, queue);

    await expect(
      service.requestPdfExport(reportId, requesterSession),
    ).rejects.toThrow("Redis down");

    const jobId = expectDefined(capture.lastCreatedJobId);
    const job = await service.getPdfExportStatus(
      jobId,
      requesterSession.userId,
    );
    expect(job.status).toBe("failed");
  });

  // Role-labelled counter. Three labels exercised (head | viewer | system)
  // confirm the optional `requestedByRole` is threaded through and the
  // omission path defaults to 'system' (worker / cron callers).
  it("bumps weeklyreport_pdf_export_requests_total{role} per call", async () => {
    const service = createPdfExportService(
      createRepository(publishedReport),
      undefined,
      undefined,
      new PdfExportInfrastructureTelemetry(null),
    );
    const beforeHead = await getCounterValue(
      weeklyreportPdfExportRequestsTotal,
      {
        role: "head",
      },
    );
    const beforeViewer = await getCounterValue(
      weeklyreportPdfExportRequestsTotal,
      {
        role: "viewer",
      },
    );
    const beforeSystem = await getCounterValue(
      weeklyreportPdfExportRequestsTotal,
      {
        role: "system",
      },
    );

    await service.requestPdfExport(reportId, sessionFor("u-head"), "head");
    await service.requestPdfExport(
      reportId,
      sessionFor("u-viewer", "viewer"),
      "viewer",
    );
    await service.requestPdfExport(reportId, requesterSession);

    expect(
      await getCounterValue(weeklyreportPdfExportRequestsTotal, {
        role: "head",
      }),
    ).toBe(beforeHead + 1);
    expect(
      await getCounterValue(weeklyreportPdfExportRequestsTotal, {
        role: "viewer",
      }),
    ).toBe(beforeViewer + 1);
    expect(
      await getCounterValue(weeklyreportPdfExportRequestsTotal, {
        role: "system",
      }),
    ).toBe(beforeSystem + 1);
  });
});

async function getCounterValue(
  counter: {
    get(): Promise<{
      values: { value: number; labels: Record<string, unknown> }[];
    }>;
  },
  labels: Record<string, string>,
): Promise<number> {
  const snapshot = await counter.get();
  const match = snapshot.values.find((entry) =>
    Object.entries(labels).every(([k, v]) => String(entry.labels[k]) === v),
  );
  return match?.value ?? 0;
}

describe("PDF export JWT signing", () => {
  const PDF_SECRET = "integration-test-secret-32-chars-or-more";

  beforeEach(() => {
    vi.stubEnv("PDF_EXPORT_JWT_SECRET", PDF_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signPdfExportToken throws PdfExportDomainError when secret is missing", () => {
    vi.stubEnv("PDF_EXPORT_JWT_SECRET", "");
    const service = createPdfExportService(createRepository(publishedReport));

    expect(() =>
      service.signPdfExportToken(
        reportId,
        "00000000-0000-4000-8000-000000000001",
        "requester-1",
      ),
    ).toThrow(PdfExportDomainError);
  });

  it("signPdfExportToken throws PdfExportDomainError when secret is too short (<32 chars)", () => {
    // 17 chars: under the 32-char floor.
    vi.stubEnv("PDF_EXPORT_JWT_SECRET", "seventeen-chars-x");
    const service = createPdfExportService(createRepository(publishedReport));

    expect(() =>
      service.signPdfExportToken(
        reportId,
        "00000000-0000-4000-8000-000000000001",
        "requester-1",
      ),
    ).toThrow(PdfExportDomainError);
  });

  it("verifyPdfExportToken throws when secret is too short (<32 chars)", () => {
    // 17 chars: under the 32-char floor.
    vi.stubEnv("PDF_EXPORT_JWT_SECRET", "seventeen-chars-x");

    expect(() => verifyPdfExportToken("any.signed.token")).toThrow(
      />= 32 characters/,
    );
  });

  it("signPdfExportToken produces a JWT carrying claim {reportId} and exp ≤ 5min", () => {
    const service = createPdfExportService(createRepository(publishedReport));
    const before = Math.floor(Date.now() / 1000);
    const token = service.signPdfExportToken(
      reportId,
      "00000000-0000-4000-8000-000000000001",
      "requester-1",
    );
    const after = Math.floor(Date.now() / 1000);

    expect(token).toMatch(/^eyJ/); // JWT header prefix
    const decoded = jwt.verify(token, PDF_SECRET) as {
      reportId: string;
      iat: number;
      exp: number;
    };
    expect(decoded.reportId).toBe(reportId);
    expect(decoded.exp - decoded.iat).toBe(5 * 60);
    expect(decoded.exp).toBeGreaterThanOrEqual(before + 5 * 60);
    expect(decoded.exp).toBeLessThanOrEqual(after + 5 * 60 + 1);
  });

  it("requestPdfExport enqueues non-credential identifiers bound to the requester", async () => {
    interface EnqueuedJob {
      reportId: string;
      jobId: string;
      generation: number;
      requestedBy: string;
    }
    const enqueued: EnqueuedJob[] = [];
    const fakeQueue = {
      enqueue: (data: EnqueuedJob) => {
        enqueued.push(data);
        return Promise.resolve();
      },
    };

    const service = createPdfExportService(
      createRepository(publishedReport),
      undefined,
      fakeQueue,
    );
    await service.requestPdfExport(reportId, requesterSession);

    expect(enqueued).toHaveLength(1);
    expect(expectDefined(enqueued[0]).reportId).toBe(reportId);
    expect(expectDefined(enqueued[0]).jobId).toBeTypeOf("string");
    expect(expectDefined(enqueued[0]).generation).toBe(1);
    expect(expectDefined(enqueued[0]).requestedBy).toBe(
      requesterSession.userId,
    );
  });

  it("never persists a bearer credential in the serialized job payload", async () => {
    // The durable BullMQ payload must not carry the short-lived render JWT (or
    // any JWT-shaped credential); the worker mints one at execution time.
    const enqueued: unknown[] = [];
    const fakeQueue = {
      enqueue: (data: unknown) => {
        enqueued.push(data);
        return Promise.resolve();
      },
    };

    const service = createPdfExportService(
      createRepository(publishedReport),
      undefined,
      fakeQueue,
    );
    await service.requestPdfExport(reportId, requesterSession);

    const serialized = JSON.stringify(enqueued[0]);
    expect(serialized).not.toContain("authToken");
    expect(serialized).not.toMatch(/eyJ/);
  });
});

describe("markExportFailed", () => {
  it("updates job status to failed with error message", async () => {
    const repo = createRepository(publishedReport);
    const service = createPdfExportService(repo);

    const queued = await service.requestPdfExport(reportId, requesterSession);

    await service.markExportFailed(
      queued.jobId,
      queued.generation,
      "timeout error",
    );

    const job = await service.getPdfExportStatus(
      queued.jobId,
      requesterSession.userId,
    );
    expect(job.status).toBe("failed");
  });

  it("calls repository.markExportFailed with correct parameters", async () => {
    const repo = createRepository(publishedReport);
    const markExportFailedSpy = vi.spyOn(repo, "markExportFailed");

    const service = createPdfExportService(repo);
    const queued = await service.requestPdfExport(reportId, requesterSession);

    await service.markExportFailed(
      queued.jobId,
      queued.generation,
      "browser crashed",
    );

    expect(markExportFailedSpy).toHaveBeenCalledExactlyOnceWith(
      queued.jobId,
      queued.generation,
      "browser crashed",
    );
  });
});

describe("buildAuthCookies", () => {
  it("uses the canonical session cookie name", () => {
    const service = createPdfExportService(createRepository(publishedReport));
    const cookies = service.buildAuthCookies("test-jwt-token");

    expect(cookies).toHaveLength(1);
    expect(cookies[0]?.name).toBe(AUTH_COOKIE_NAME);
    expect(cookies[0]?.value).toBe("test-jwt-token");
  });

  it("sets httpOnly to true for security", () => {
    const service = createPdfExportService(createRepository(publishedReport));
    const cookies = service.buildAuthCookies("test-jwt-token");

    expect(cookies[0]?.httpOnly).toBe(true);
  });

  it("scopes the cookie to the PDF_BASE_URL hostname", () => {
    const originalEnv = process.env.PDF_BASE_URL;
    process.env.PDF_BASE_URL = "https://reports.company.com";

    try {
      const service = createPdfExportService(createRepository(publishedReport));
      const cookies = service.buildAuthCookies("test-jwt-token");

      expect(cookies[0]?.domain).toBe("reports.company.com");
      expect(cookies[0]?.path).toBe("/");
    } finally {
      if (originalEnv === undefined) {
        delete process.env.PDF_BASE_URL;
      } else {
        process.env.PDF_BASE_URL = originalEnv;
      }
    }
  });

  it("produces a domain-scoped cookie for localhost", () => {
    const originalEnv = process.env.PDF_BASE_URL;
    process.env.PDF_BASE_URL = "http://localhost:3000";

    try {
      const service = createPdfExportService(createRepository(publishedReport));
      const cookies = service.buildAuthCookies("test-jwt-token");

      expect(cookies[0]?.domain).toBe("localhost");
      expect(cookies[0]?.path).toBe("/");
      expect(cookies[0]).not.toHaveProperty("url");
      expect(cookies[0]).not.toHaveProperty("secure");
      expect(cookies[0]?.httpOnly).toBe(true);
      expect(cookies[0]?.sameSite).toBe("Lax");
    } finally {
      if (originalEnv === undefined) {
        delete process.env.PDF_BASE_URL;
      } else {
        process.env.PDF_BASE_URL = originalEnv;
      }
    }
  });

  it("produces a domain-scoped cookie for an IP-based PDF_BASE_URL", () => {
    const originalEnv = process.env.PDF_BASE_URL;
    process.env.PDF_BASE_URL = "http://10.0.0.5:3000";

    try {
      const service = createPdfExportService(createRepository(publishedReport));
      const cookies = service.buildAuthCookies("test-jwt-token");

      expect(cookies[0]?.domain).toBe("10.0.0.5");
    } finally {
      if (originalEnv === undefined) {
        delete process.env.PDF_BASE_URL;
      } else {
        process.env.PDF_BASE_URL = originalEnv;
      }
    }
  });

  it("produces a domain-scoped cookie for a behind-proxy internal hostname", () => {
    const originalEnv = process.env.PDF_BASE_URL;
    process.env.PDF_BASE_URL = "http://web-internal.cluster.local:3000";

    try {
      const service = createPdfExportService(createRepository(publishedReport));
      const cookies = service.buildAuthCookies("test-jwt-token");

      expect(cookies[0]?.domain).toBe("web-internal.cluster.local");
    } finally {
      if (originalEnv === undefined) {
        delete process.env.PDF_BASE_URL;
      } else {
        process.env.PDF_BASE_URL = originalEnv;
      }
    }
  });
});

describe("requestPdfExport + getPdfExportStatus round trip", () => {
  it("returns the latest async export status for an existing job", async () => {
    const service = createPdfExportService(createRepository(publishedReport));
    const queued = await service.requestPdfExport(reportId, requesterSession);
    const completed = await service.markExportCompleted(
      queued.jobId,
      queued.generation,
      "/exports/report.pdf",
      "phase-2-demo-checksum",
    );

    await expect(
      service.getPdfExportStatus(queued.jobId, requesterSession.userId),
    ).resolves.toMatchObject({
      jobId: completed.jobId,
      status: "completed",
      artifactUrl: completed.artifactUrl,
      checksum: completed.checksum,
    });
  });
});

const exportIdentity = (job: PdfExportJob): PdfExportJobIdentity => ({
  jobId: job.jobId,
  reportId: job.reportId,
  requestedBy: requesterSession.userId,
  generation: job.generation,
});

const terminalState = (
  job: PdfExportJob,
  state: Pick<PdfExportTerminalState, "status"> &
    Partial<PdfExportTerminalState>,
): PdfExportTerminalState => ({ ...exportIdentity(job), ...state });

describe("reconcileTerminalState", () => {
  it("marks a queued export failed from the queue state loaded inside the lock", async () => {
    const service = createPdfExportService(createRepository(publishedReport));
    const job = await service.requestPdfExport(reportId, requesterSession);

    const applied = await service.reconcileTerminalState(
      exportIdentity(job),
      () =>
        Promise.resolve(
          terminalState(job, { status: "failed", error: "browser crashed" }),
        ),
    );

    expect(applied).toBe(true);
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "failed" });
  });

  it("marks a queued export completed through the canonical artifact result", async () => {
    const service = createPdfExportService(createRepository(publishedReport));
    const job = await service.requestPdfExport(reportId, requesterSession);

    const applied = await service.reconcileTerminalState(
      exportIdentity(job),
      () =>
        Promise.resolve(
          terminalState(job, {
            status: "completed",
            artifactUrl: `/pdfs/${job.jobId}.pdf`,
            checksum: "sha-256",
          }),
        ),
    );

    expect(applied).toBe(true);
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({
      status: "completed",
      artifactUrl: `/pdfs/${job.jobId}.pdf`,
      checksum: "sha-256",
    });
  });

  it("skips the write when the job is no longer terminal inside the lock", async () => {
    // The captured "failed" is stale the moment an admin retry requeues the
    // job; the loader returning null is how a revived attempt stays alive.
    const service = createPdfExportService(createRepository(publishedReport));
    const job = await service.requestPdfExport(reportId, requesterSession);

    const applied = await service.reconcileTerminalState(
      exportIdentity(job),
      () => Promise.resolve(null),
    );

    expect(applied).toBe(false);
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "queued" });
  });

  it("never regresses a completed export and never consults the queue for it", async () => {
    const service = createPdfExportService(createRepository(publishedReport));
    const job = await service.requestPdfExport(reportId, requesterSession);
    await service.markExportCompleted(
      job.jobId,
      job.generation,
      `/pdfs/${job.jobId}.pdf`,
      "sha-256",
    );
    const loadCurrent = vi
      .fn()
      .mockResolvedValue(
        terminalState(job, { status: "failed", error: "late failure" }),
      );

    const applied = await service.reconcileTerminalState(
      exportIdentity(job),
      loadCurrent,
    );

    expect(applied).toBe(false);
    expect(loadCurrent).not.toHaveBeenCalled();
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "completed", checksum: "sha-256" });
  });

  it("returns false for a missing export row without consulting the queue", async () => {
    const service = createPdfExportService(createRepository(publishedReport));
    const loadCurrent = vi.fn();
    const missingId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    const applied = await service.reconcileTerminalState(
      {
        jobId: missingId,
        reportId,
        requestedBy: requesterSession.userId,
        generation: 1,
      },
      loadCurrent,
    );

    expect(applied).toBe(false);
    expect(loadCurrent).not.toHaveBeenCalled();
  });

  it("rejects a terminal state whose identity mismatches the durable row", async () => {
    const service = createPdfExportService(createRepository(publishedReport));
    const job = await service.requestPdfExport(reportId, requesterSession);

    const applied = await service.reconcileTerminalState(
      exportIdentity(job),
      () =>
        Promise.resolve(
          terminalState(job, {
            status: "failed",
            error: "browser crashed",
            reportId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          }),
        ),
    );

    expect(applied).toBe(false);
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "queued" });
  });

  it("performs no terminal write when a fresh payload mismatches the durable binding", async () => {
    // Composed delayed-callback regression: the failure event claims identity
    // A, but the queue job re-read under the row lock now carries payload B.
    // The state's own identity is checked against the claimed one, so the
    // write is declined before any lifecycle field changes.
    const service = createPdfExportService(createRepository(publishedReport));
    const job = await service.requestPdfExport(reportId, requesterSession);

    const applied = await service.reconcileTerminalState(
      exportIdentity(job),
      () =>
        Promise.resolve(
          terminalState(job, {
            status: "failed",
            error: "failure from the rebound payload",
            reportId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            requestedBy: "00000000-0000-4000-8000-00000000bbbb",
          }),
        ),
    );

    expect(applied).toBe(false);
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({
      status: "queued",
      artifactUrl: null,
      checksum: null,
    });
  });
});

describe("requestPdfExport initial dispatch", () => {
  it("creates the row pending at generation 1 and issues the queue add while holding the row lock", async () => {
    const events: string[] = [];
    const queue = {
      enqueue: vi.fn((_input: PdfExportEnqueueInput) => {
        events.push("queue:add");
        return Promise.resolve();
      }),
    };
    const service = createPdfExportService(
      createRepository(publishedReport, { events }),
      undefined,
      queue,
    );

    const job = await service.requestPdfExport(reportId, requesterSession);

    expect(job.status).toBe("queued");
    expect(job.generation).toBe(1);
    expect(queue.enqueue).toHaveBeenCalledExactlyOnceWith(
      {
        reportId,
        jobId: job.jobId,
        generation: 1,
        requestedBy: requesterSession.userId,
      },
      {},
    );
    // The generation-scoped add is issued inside the export row lock, so
    // dispatch serializes against quarantine on the same lane. An add issued
    // after the lock released would read [... "lock:release", "queue:add"].
    expect(events).toEqual(["lock:acquire", "queue:add", "lock:release"]);
  });

  it("performs no queue add when a concurrent quarantine commits before the dispatch lock", async () => {
    const events: string[] = [];
    const repository = createRepository(publishedReport, { events });
    const baseCreateExportJob = repository.createExportJob.bind(repository);
    vi.spyOn(repository, "createExportJob").mockImplementation(
      async (job, requestedBy, snapshot) => {
        const created = await baseCreateExportJob(job, requestedBy, snapshot);
        // A concurrent quarantine committed while the dispatcher was still on
        // its way to the row lock: pending(1) -> recovery_required(1).
        await repository.runLockedExportJob(job.jobId, (_row, writes) =>
          writes.markRecoveryRequired(job.generation),
        );
        return created;
      },
    );
    const queue = { enqueue: vi.fn() };
    const recordRequest = vi.fn();
    const service = createPdfExportService(repository, undefined, queue, {
      captureJobContext: () => ({}),
      recordRequest,
    });

    const job = await service.requestPdfExport(reportId, requesterSession);

    // The locked re-verification sees the quarantined row and the dispatch
    // aborts: no add, no request metric, no compensating write — the
    // committed recovery_required row is left for the recovery surface.
    expect(job.generation).toBe(1);
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(recordRequest).not.toHaveBeenCalled();
    expect(events).toEqual([
      "lock:acquire",
      "lock:release",
      "lock:acquire",
      "lock:release",
    ]);
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "recovery_required", generation: 1 });
  });

  it("keeps the row pending when a later lock holder observes the dispatched generation job", async () => {
    const enqueued: PdfExportEnqueueInput[] = [];
    const queue = {
      enqueue: (input: PdfExportEnqueueInput) => {
        enqueued.push(input);
        return Promise.resolve();
      },
    };
    const repository = createRepository(publishedReport);
    const service = createPdfExportService(repository, undefined, queue);

    const job = await service.requestPdfExport(reportId, requesterSession);

    // Dispatch committed first: a quarantine acquiring the row lock
    // afterwards probes the generation-scoped queue job — the real scan calls
    // queue.getJob(`${jobId}-g${generation}`) — and must observe it. Here the
    // captured payload is the queue state that probe reads.
    const probeSawJob = await repository.runLockedExportJob(
      job.jobId,
      async (row, writes) => {
        if (row?.status !== "queued" || row.generation !== 1) {
          return false;
        }
        const lockedRow = row;
        const dispatched = enqueued.some(
          (entry) =>
            entry.jobId === lockedRow.jobId &&
            entry.generation === lockedRow.generation,
        );
        if (!dispatched) {
          await writes.markRecoveryRequired(lockedRow.generation);
        }
        return dispatched;
      },
    );

    expect(probeSawJob).toBe(true);
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "queued", generation: 1 });
  });
});

// Orphan-scan fixtures are aged far beyond the 15-minute orphan threshold.
const AGED_REQUESTED_AT = new Date("2026-04-01T00:00:00.000Z");

function seedExportJob(
  repository: PdfExportRepository,
  overrides: Partial<PdfExportJob> = {},
): Promise<PdfExportJob> {
  return repository.createExportJob(
    pdfExportJobSchema.parse({
      jobId: crypto.randomUUID(),
      reportId,
      status: "queued",
      generation: 1,
      requestedAt: AGED_REQUESTED_AT,
      completedAt: null,
      checksum: null,
      templateVersion: "phase-2-pdf-v1",
      artifactUrl: null,
      ...overrides,
    }),
    requesterSession.userId,
    publishedReport,
  );
}

describe("retryExportGeneration", () => {
  it("advances a failed row exactly one generation and issues the generation add inside the dispatch lock", async () => {
    const events: string[] = [];
    const repository = createRepository(publishedReport, { events });
    const queue = {
      enqueue: vi.fn((_input: PdfExportEnqueueInput) => {
        events.push("queue:add");
        return Promise.resolve();
      }),
    };
    const service = createPdfExportService(repository, undefined, queue);
    const job = await service.requestPdfExport(reportId, requesterSession);
    await service.markExportFailed(job.jobId, job.generation, "render crashed");
    events.length = 0;
    queue.enqueue.mockClear();

    const outcome = await service.retryExportGeneration({
      jobId: job.jobId,
      expectedGeneration: 1,
    });

    expect(outcome).toBe("retried");
    expect(queue.enqueue).toHaveBeenCalledExactlyOnceWith(
      {
        reportId,
        jobId: job.jobId,
        generation: 2,
        requestedBy: requesterSession.userId,
      },
      {},
    );
    // Phase A commits pending(2), then phase B holds the row lock while the
    // generation-2 add is issued — the same lane quarantine serializes on.
    expect(events).toEqual([
      "lock:acquire",
      "lock:release",
      "lock:acquire",
      "queue:add",
      "lock:release",
    ]);
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "queued", generation: 2 });
  });

  it("advances a recovery_required row and clears the terminal artifact fields", async () => {
    const repository = createRepository(publishedReport);
    const queue = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const service = createPdfExportService(repository, undefined, queue);
    const jobId = crypto.randomUUID();
    await seedExportJob(repository, {
      jobId,
      status: "recovery_required",
      artifactUrl: `/pdfs/${jobId}.pdf`,
      checksum: "stale-sha",
    });

    const outcome = await service.retryExportGeneration({
      jobId,
      expectedGeneration: 1,
    });

    expect(outcome).toBe("retried");
    expect(queue.enqueue).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ jobId, generation: 2 }),
      {},
    );
    await expect(
      service.getPdfExportStatus(jobId, requesterSession.userId),
    ).resolves.toMatchObject({
      status: "queued",
      generation: 2,
      artifactUrl: null,
      checksum: null,
    });
  });

  it("returns already-advanced on a stale repeat without writing or enqueuing again", async () => {
    const repository = createRepository(publishedReport);
    const queue = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const service = createPdfExportService(repository, undefined, queue);
    const job = await seedExportJob(repository, { status: "failed" });
    await service.retryExportGeneration({
      jobId: job.jobId,
      expectedGeneration: 1,
    });
    expect(queue.enqueue).toHaveBeenCalledTimes(1);

    const repeat = await service.retryExportGeneration({
      jobId: job.jobId,
      expectedGeneration: 1,
    });

    expect(repeat).toBe("already-advanced");
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "queued", generation: 2 });
  });

  it("writes nothing for a pending row named by its own generation", async () => {
    const repository = createRepository(publishedReport);
    const queue = { enqueue: vi.fn() };
    const service = createPdfExportService(repository, undefined, queue);
    const job = await seedExportJob(repository);

    const outcome = await service.retryExportGeneration({
      jobId: job.jobId,
      expectedGeneration: 1,
    });

    expect(outcome).toBe("ineligible");
    expect(queue.enqueue).not.toHaveBeenCalled();
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "queued", generation: 1 });
  });

  it("writes nothing for a completed row", async () => {
    const repository = createRepository(publishedReport);
    const queue = { enqueue: vi.fn() };
    const service = createPdfExportService(repository, undefined, queue);
    const job = await seedExportJob(repository);
    await service.markExportCompleted(
      job.jobId,
      job.generation,
      `/pdfs/${job.jobId}.pdf`,
      "sha-256",
    );

    const outcome = await service.retryExportGeneration({
      jobId: job.jobId,
      expectedGeneration: 1,
    });

    expect(outcome).toBe("ineligible");
    expect(queue.enqueue).not.toHaveBeenCalled();
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "completed", generation: 1 });
  });

  it("never re-derives the generation: a retained g1 action cannot advance a row failed at g2", async () => {
    // The failed-job list retains the generation-1 queue entry while the row
    // already advanced to g2 and failed there — the bound expectedGeneration
    // fails the locked check and nothing is written.
    const repository = createRepository(publishedReport);
    const queue = { enqueue: vi.fn() };
    const service = createPdfExportService(repository, undefined, queue);
    const job = await seedExportJob(repository, {
      status: "failed",
      generation: 2,
    });

    const outcome = await service.retryExportGeneration({
      jobId: job.jobId,
      expectedGeneration: 1,
    });

    expect(outcome).toBe("ineligible");
    expect(queue.enqueue).not.toHaveBeenCalled();
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "failed", generation: 2 });
  });

  it("returns ineligible for a missing row and for a malformed expectedGeneration", async () => {
    const repository = createRepository(publishedReport);
    const queue = { enqueue: vi.fn() };
    const service = createPdfExportService(repository, undefined, queue);
    const job = await seedExportJob(repository, { status: "failed" });
    const runLocked = vi.spyOn(repository, "runLockedExportJob");

    await expect(
      service.retryExportGeneration({
        jobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        expectedGeneration: 1,
      }),
    ).resolves.toBe("ineligible");
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      await expect(
        service.retryExportGeneration({
          jobId: job.jobId,
          expectedGeneration: bad,
        }),
      ).resolves.toBe("ineligible");
    }

    expect(queue.enqueue).not.toHaveBeenCalled();
    // The malformed inputs never reach the row lock — fail closed cheaply.
    expect(runLocked).toHaveBeenCalledTimes(1);
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "failed", generation: 1 });
  });

  it("leaves the committed pending generation recoverable when the queue add throws", async () => {
    // A Redis error — including a lost ack where the command may have been
    // issued — can never be compensated once the lock releases. The row
    // stays pending(2): never failed, never rolled back, recoverable by the
    // orphan scan plus a later retry.
    const repository = createRepository(publishedReport);
    const queue = {
      enqueue: vi.fn().mockRejectedValue(new Error("Redis down")),
    };
    const service = createPdfExportService(repository, undefined, queue);
    const job = await seedExportJob(repository, { status: "failed" });

    await expect(
      service.retryExportGeneration({
        jobId: job.jobId,
        expectedGeneration: 1,
      }),
    ).rejects.toThrow("Redis down");

    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "queued", generation: 2 });

    await service.scanOrphanedPendingExports(() => Promise.resolve(false));
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({
      status: "recovery_required",
      generation: 2,
    });

    queue.enqueue.mockResolvedValue(undefined);
    const second = await service.retryExportGeneration({
      jobId: job.jobId,
      expectedGeneration: 2,
    });
    expect(second).toBe("retried");
    expect(queue.enqueue).toHaveBeenLastCalledWith(
      expect.objectContaining({ jobId: job.jobId, generation: 3 }),
      {},
    );
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "queued", generation: 3 });
  });

  it("keeps the committed generation live to the orphan scan when a recorded add loses its ack", async () => {
    // Accepted add, lost ack: the generation-2 job reached the queue — the
    // enqueue recorded it — but the reply was lost, so the dispatch leg
    // threw. The committed pending(2) row is not an orphan: a stale repeat
    // adds nothing, and the scan's probe observes the stored
    // generation-scoped job instead of quarantining the row.
    const enqueued: PdfExportEnqueueInput[] = [];
    const queue = {
      enqueue: vi.fn((input: PdfExportEnqueueInput) => {
        enqueued.push(input);
        return Promise.reject(new Error("Redis ack lost"));
      }),
    };
    const repository = createRepository(publishedReport);
    const service = createPdfExportService(repository, undefined, queue);
    const job = await seedExportJob(repository, { status: "failed" });

    await expect(
      service.retryExportGeneration({
        jobId: job.jobId,
        expectedGeneration: 1,
      }),
    ).rejects.toThrow("Redis ack lost");

    expect(enqueued).toEqual([
      expect.objectContaining({ jobId: job.jobId, generation: 2 }),
    ]);
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "queued", generation: 2 });

    // A stale repeat bound to the pre-retry generation adds nothing.
    await expect(
      service.retryExportGeneration({
        jobId: job.jobId,
        expectedGeneration: 1,
      }),
    ).resolves.toBe("already-advanced");
    expect(queue.enqueue).toHaveBeenCalledTimes(1);

    // The probe reads the same recorded queue state the real adapter scans
    // (`${jobId}-g${generation}`): the live generation-2 job is seen and the
    // row stays pending.
    const probe = vi
      .fn()
      .mockImplementation(
        (candidate: Pick<PdfExportPendingCandidate, "jobId" | "generation">) =>
          Promise.resolve(
            enqueued.some(
              (entry) =>
                entry.jobId === candidate.jobId &&
                entry.generation === candidate.generation,
            ),
          ),
      );

    const summary = await service.scanOrphanedPendingExports(probe);

    expect(probe).toHaveBeenCalledExactlyOnceWith({
      jobId: job.jobId,
      generation: 2,
    });
    expect(summary).toMatchObject({ inspected: 1, quarantined: 0, failed: 0 });
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "queued", generation: 2 });
  });

  it("performs no queue add when a quarantine commits between the advance and the dispatch leg", async () => {
    // Quarantine-first lock order for the retry dispatcher: the orphan scan
    // wins the row lock between phase A's commit and phase B's verify, so
    // the dispatcher observes recovery_required(2) and adds nothing.
    const repository = createRepository(publishedReport);
    const queue = { enqueue: vi.fn().mockResolvedValue(undefined) };
    const service = createPdfExportService(repository, undefined, queue);
    const job = await seedExportJob(repository, { status: "failed" });
    const baseRunLocked = repository.runLockedExportJob.bind(repository);
    let lock = 0;
    vi.spyOn(repository, "runLockedExportJob").mockImplementation(
      (jobId, run) => {
        lock += 1;
        if (lock === 2 && jobId === job.jobId) {
          return baseRunLocked(jobId, (_row, writes) =>
            writes.markRecoveryRequired(2),
          ).then(() => baseRunLocked(jobId, run));
        }
        return baseRunLocked(jobId, run);
      },
    );

    const outcome = await service.retryExportGeneration({
      jobId: job.jobId,
      expectedGeneration: 1,
    });

    // The generation still advanced — the dispatch leg alone was preempted.
    expect(outcome).toBe("retried");
    expect(queue.enqueue).not.toHaveBeenCalled();
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({
      status: "recovery_required",
      generation: 2,
    });
  });
});

describe("scanOrphanedPendingExports", () => {
  it("quarantines an aged pending row whose generation queue job is confirmed absent", async () => {
    const repository = createRepository(publishedReport);
    const service = createPdfExportService(repository);
    const job = await seedExportJob(repository);
    const probe = vi.fn().mockResolvedValue(false);

    const summary = await service.scanOrphanedPendingExports(probe);

    // The probe sees only the generation-scoped identity; the queue id
    // `${jobId}-g${generation}` is the caller's translation.
    expect(probe).toHaveBeenCalledExactlyOnceWith({
      jobId: job.jobId,
      generation: 1,
    });
    expect(summary).toMatchObject({ inspected: 1, quarantined: 1, failed: 0 });
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({
      status: "recovery_required",
      generation: 1,
    });
  });

  it("keeps the row pending when the probe observes the committed generation job", async () => {
    // Dispatch-first lock order: the committed add is what the quarantine
    // probe observes while holding the row lock.
    const repository = createRepository(publishedReport);
    const service = createPdfExportService(repository);
    const job = await seedExportJob(repository);
    const probe = vi.fn().mockResolvedValue(true);

    const summary = await service.scanOrphanedPendingExports(probe);

    expect(summary).toMatchObject({ inspected: 1, quarantined: 0, failed: 0 });
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "queued", generation: 1 });
  });

  it("never probes a pending row younger than the orphan threshold", async () => {
    const repository = createRepository(publishedReport);
    const service = createPdfExportService(repository);
    const job = await seedExportJob(repository, {
      requestedAt: new Date(),
    });
    const probe = vi.fn();

    const summary = await service.scanOrphanedPendingExports(probe);

    expect(probe).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ inspected: 0, quarantined: 0, failed: 0 });
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "queued", generation: 1 });
  });

  it("treats a Redis probe error as unknown — the row stays pending and the pass continues", async () => {
    const repository = createRepository(publishedReport);
    const logger: AppLogger = { ...createNullLogger(), error: vi.fn() };
    const service = createPdfExportService(repository, logger);
    const failing = await seedExportJob(repository);
    const later = await seedExportJob(repository, {
      requestedAt: new Date("2026-04-02T00:00:00.000Z"),
    });
    const probe = vi
      .fn()
      .mockImplementation(({ jobId }: { jobId: string }) =>
        jobId === failing.jobId
          ? Promise.reject(new Error("Redis timeout"))
          : Promise.resolve(false),
      );

    const summary = await service.scanOrphanedPendingExports(probe);

    expect(summary).toMatchObject({ inspected: 2, quarantined: 1, failed: 1 });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("orphan"),
      expect.objectContaining({ jobId: failing.jobId }),
    );
    await expect(
      service.getPdfExportStatus(failing.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "queued", generation: 1 });
    await expect(
      service.getPdfExportStatus(later.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "recovery_required", generation: 1 });
  });

  it("advances the keyset past every inspected row and terminates at the pass-start bound", async () => {
    // More aged rows than one scan page: live queue jobs still advance the
    // cursor, so a later-page orphan is reached instead of starving the pass.
    const repository = createRepository(publishedReport);
    const service = createPdfExportService(repository);
    for (let i = 0; i < 105; i += 1) {
      await seedExportJob(repository);
    }
    // The orphan sorts last in the (createdAt, id) keyset, landing on the
    // second page — unreachable if live rows did not advance the cursor.
    const orphan = await seedExportJob(repository, {
      requestedAt: new Date("2026-04-01T00:01:00.000Z"),
    });
    const probe = vi
      .fn()
      .mockImplementation(({ jobId }: { jobId: string }) =>
        Promise.resolve(jobId !== orphan.jobId),
      );
    const listSpy = vi.spyOn(repository, "listPendingExportCandidates");

    const summary = await service.scanOrphanedPendingExports(probe);

    expect(summary).toMatchObject({
      inspected: 106,
      quarantined: 1,
      failed: 0,
    });
    await expect(
      service.getPdfExportStatus(orphan.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "recovery_required" });
    // One fixed pass-start bound on every page — rows created during the
    // pass are never chased.
    const bounds = new Set(listSpy.mock.calls.map((call) => call[0].getTime()));
    expect(bounds.size).toBe(1);
  });

  it("skips a candidate whose row advanced between the listing and the lock", async () => {
    // A retry committed pending(2) after the page was listed: the locked
    // recheck declines the stale generation-1 candidate without probing.
    const repository = createRepository(publishedReport);
    const service = createPdfExportService(repository);
    const job = await seedExportJob(repository, { generation: 2 });
    vi.spyOn(repository, "listPendingExportCandidates")
      .mockResolvedValueOnce([
        {
          jobId: job.jobId,
          generation: 1,
          createdAt: job.requestedAt,
        },
      ])
      .mockResolvedValue([]);
    const probe = vi.fn();

    const summary = await service.scanOrphanedPendingExports(probe);

    expect(probe).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ inspected: 1, quarantined: 0 });
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "queued", generation: 2 });
  });

  it("skips a candidate whose row left pending before the lock", async () => {
    // A terminal write committed failed(1) after the listing snapshot.
    const repository = createRepository(publishedReport);
    const service = createPdfExportService(repository);
    const job = await seedExportJob(repository, { status: "failed" });
    vi.spyOn(repository, "listPendingExportCandidates")
      .mockResolvedValueOnce([
        {
          jobId: job.jobId,
          generation: 1,
          createdAt: job.requestedAt,
        },
      ])
      .mockResolvedValue([]);
    const probe = vi.fn();

    const summary = await service.scanOrphanedPendingExports(probe);

    expect(probe).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ inspected: 1, quarantined: 0 });
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "failed", generation: 1 });
  });
});

describe("assertPdfExportJobIdentity (pre-render gate)", () => {
  it("accepts the identity of a pending row at the dispatched generation", async () => {
    const service = createPdfExportService(createRepository(publishedReport));
    const job = await service.requestPdfExport(reportId, requesterSession);

    await expect(
      service.assertPdfExportJobIdentity(
        job.jobId,
        reportId,
        requesterSession.userId,
        job.generation,
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects a payload generation older than the row's pending generation", async () => {
    // A generation-1 queue job executing after the retry committed pending(2)
    // never renders and never writes.
    const repository = createRepository(publishedReport);
    const service = createPdfExportService(repository);
    const job = await seedExportJob(repository, { status: "failed" });
    await service.retryExportGeneration({
      jobId: job.jobId,
      expectedGeneration: 1,
    });

    await expect(
      service.assertPdfExportJobIdentity(
        job.jobId,
        reportId,
        requesterSession.userId,
        1,
      ),
    ).rejects.toBeInstanceOf(PdfExportDomainError);
  });

  it("rejects a terminal row even at the matching generation", async () => {
    const service = createPdfExportService(createRepository(publishedReport));
    const job = await service.requestPdfExport(reportId, requesterSession);
    await service.markExportFailed(job.jobId, job.generation, "crashed");

    await expect(
      service.assertPdfExportJobIdentity(
        job.jobId,
        reportId,
        requesterSession.userId,
        job.generation,
      ),
    ).rejects.toBeInstanceOf(PdfExportDomainError);
  });

  it("still rejects an identity that mismatches the durable row", async () => {
    const service = createPdfExportService(createRepository(publishedReport));
    const job = await service.requestPdfExport(reportId, requesterSession);

    await expect(
      service.assertPdfExportJobIdentity(
        job.jobId,
        reportId,
        "00000000-0000-4000-8000-00000000bbbb",
        job.generation,
      ),
    ).rejects.toBeInstanceOf(PdfExportDomainError);
  });
});

describe("generation-fenced terminal writes", () => {
  it("fences completion to the claimed generation — a stale worker cannot terminalize the current row", async () => {
    const repository = createRepository(publishedReport);
    const service = createPdfExportService(repository);
    const job = await seedExportJob(repository, { status: "failed" });
    await service.retryExportGeneration({
      jobId: job.jobId,
      expectedGeneration: 1,
    });

    // A generation-1 worker finishing late claims its own generation; the
    // pending(2) row rejects the write and stays queued.
    await expect(
      service.markExportCompleted(
        job.jobId,
        1,
        `/pdfs/${job.jobId}.pdf`,
        "stale-sha",
      ),
    ).rejects.toBeInstanceOf(PdfExportStateConflictError);
    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "queued", generation: 2 });
  });

  it("treats a stale-generation failure write as an idempotent no-op", async () => {
    const repository = createRepository(publishedReport);
    const service = createPdfExportService(repository);
    const job = await seedExportJob(repository, { status: "failed" });
    await service.retryExportGeneration({
      jobId: job.jobId,
      expectedGeneration: 1,
    });

    await service.markExportFailed(job.jobId, 1, "late g1 failure");

    await expect(
      service.getPdfExportStatus(job.jobId, requesterSession.userId),
    ).resolves.toMatchObject({ status: "queued", generation: 2 });
  });
});
