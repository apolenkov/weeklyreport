import {
  type AssembledReport,
  AUTH_COOKIE_NAME,
  type PdfExportJob,
  type PublishedReportSnapshot,
  type UserSession,
} from "@customreport/shared";
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
import { customreportPdfExportRequestsTotal } from "../../infrastructure/metrics/metrics.registry.js";
import { type AppLogger, createNullLogger } from "../../lib/logger.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import { NOOP_PDF_EXPORT_TELEMETRY } from "../../test-utils/pdf-export.js";
import {
  type PdfExportEnqueuer,
  type PdfExportTelemetry,
} from "./pdf-export.ports.js";
import {
  PdfExportDomainError,
  type PdfExportJobRecord,
  type PdfExportRepository,
  PdfExportService,
} from "./pdf-export.service";
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
  capture?: { lastRequestedBy?: string; lastCreatedJobId?: string },
  canRead = true,
): PdfExportRepository {
  const jobs = new Map<string, PdfExportJobRecord>();

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
      jobs.set(job.jobId, {
        ...structuredClone(job),
        requestedBy: expectDefined(jobs.get(job.jobId)).requestedBy,
      });
      return Promise.resolve(structuredClone(job));
    },
    markExportFailed(jobId: string, _error: string) {
      const job = jobs.get(jobId);
      if (job) {
        jobs.set(jobId, { ...job, status: "failed" as const });
      }
      return Promise.resolve();
    },
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
    const before = await getCounterValue(customreportPdfExportRequestsTotal, {
      role: "head",
    });

    await expect(
      service.requestPdfExport(reportId, requesterSession, "head"),
    ).rejects.toThrow("Redis down");

    expect(
      await getCounterValue(customreportPdfExportRequestsTotal, {
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
  it("bumps customreport_pdf_export_requests_total{role} per call", async () => {
    const service = createPdfExportService(
      createRepository(publishedReport),
      undefined,
      undefined,
      new PdfExportInfrastructureTelemetry(null),
    );
    const beforeHead = await getCounterValue(
      customreportPdfExportRequestsTotal,
      {
        role: "head",
      },
    );
    const beforeViewer = await getCounterValue(
      customreportPdfExportRequestsTotal,
      {
        role: "viewer",
      },
    );
    const beforeSystem = await getCounterValue(
      customreportPdfExportRequestsTotal,
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
      await getCounterValue(customreportPdfExportRequestsTotal, {
        role: "head",
      }),
    ).toBe(beforeHead + 1);
    expect(
      await getCounterValue(customreportPdfExportRequestsTotal, {
        role: "viewer",
      }),
    ).toBe(beforeViewer + 1);
    expect(
      await getCounterValue(customreportPdfExportRequestsTotal, {
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
      />= 32 chars/,
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

    await service.markExportFailed(queued.jobId, "timeout error");

    const job = await service.getPdfExportStatus(
      queued.jobId,
      requesterSession.userId,
    );
    expect(job.status).toBe("failed");
  });

  it("calls repository.markExportFailed with correct parameters", async () => {
    const repo = createRepository(publishedReport);
    const markExportFailedCalls: { jobId: string; error: string }[] = [];
    const originalMarkExportFailed = repo.markExportFailed.bind(repo);
    repo.markExportFailed = async (jobId: string, error: string) => {
      markExportFailedCalls.push({ jobId, error });
      return originalMarkExportFailed(jobId, error);
    };

    const service = createPdfExportService(repo);
    const queued = await service.requestPdfExport(reportId, requesterSession);

    await service.markExportFailed(queued.jobId, "browser crashed");

    expect(markExportFailedCalls).toHaveLength(1);
    expect(markExportFailedCalls[0]).toEqual({
      jobId: queued.jobId,
      error: "browser crashed",
    });
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

  // The cookie is scoped via Playwright's `url` field instead of
  // `domain`+`secure` inference. The url-based form works regardless of
  // hostname shape (localhost, IP, behind-proxy).
  it("uses PDF_BASE_URL as the cookie url verbatim (https hostname)", () => {
    const originalEnv = process.env.PDF_BASE_URL;
    process.env.PDF_BASE_URL = "https://reports.example.com";

    try {
      const service = createPdfExportService(createRepository(publishedReport));
      const cookies = service.buildAuthCookies("test-jwt-token");

      expect(cookies[0]?.url).toBe("https://reports.example.com");
    } finally {
      if (originalEnv === undefined) {
        delete process.env.PDF_BASE_URL;
      } else {
        process.env.PDF_BASE_URL = originalEnv;
      }
    }
  });

  it("produces a url-based cookie for localhost (no domain leak, no secure inference)", () => {
    const originalEnv = process.env.PDF_BASE_URL;
    process.env.PDF_BASE_URL = "http://localhost:3000";

    try {
      const service = createPdfExportService(createRepository(publishedReport));
      const cookies = service.buildAuthCookies("test-jwt-token");

      expect(cookies[0]?.url).toBe("http://localhost:3000");
      // The `domain` and `secure` fields must not appear — Playwright
      // chooses between url-based and domain-based scoping by which
      // fields are present in the entry.
      expect(cookies[0]).not.toHaveProperty("domain");
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

  it("produces a url-based cookie for an IP-based PDF_BASE_URL (no domain rejection)", () => {
    // Playwright's addCookies() rejects entries whose `domain` field would
    // resolve to an IP — using `url` sidesteps that branch entirely.
    const originalEnv = process.env.PDF_BASE_URL;
    process.env.PDF_BASE_URL = "http://10.0.0.5:3000";

    try {
      const service = createPdfExportService(createRepository(publishedReport));
      const cookies = service.buildAuthCookies("test-jwt-token");

      expect(cookies[0]?.url).toBe("http://10.0.0.5:3000");
      expect(cookies[0]).not.toHaveProperty("domain");
    } finally {
      if (originalEnv === undefined) {
        delete process.env.PDF_BASE_URL;
      } else {
        process.env.PDF_BASE_URL = originalEnv;
      }
    }
  });

  it("produces a url-based cookie for a behind-proxy internal hostname", () => {
    const originalEnv = process.env.PDF_BASE_URL;
    process.env.PDF_BASE_URL = "http://web-internal.cluster.local:3000";

    try {
      const service = createPdfExportService(createRepository(publishedReport));
      const cookies = service.buildAuthCookies("test-jwt-token");

      expect(cookies[0]?.url).toBe("http://web-internal.cluster.local:3000");
      expect(cookies[0]).not.toHaveProperty("domain");
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
      "/exports/report.pdf",
      "phase-2-demo-checksum",
    );

    await expect(
      service.getPdfExportStatus(queued.jobId, requesterSession.userId),
    ).resolves.toMatchObject(completed);
  });
});
