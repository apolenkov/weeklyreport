import type {
  AssembledReport,
  PdfExportJob,
  UserSession,
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

import { customreportPdfExportRequestsTotal } from "../../infrastructure/metrics/metrics.registry.js";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  PdfExportDomainError,
  type PdfExportJobRecord,
  type PdfExportRepository,
  PdfExportService,
  verifyPdfExportToken,
} from "./pdf-export.service";
import { PdfExportInfrastructureTelemetry } from "./pdf-export-telemetry.adapter.js";

const reportId = "22222222-2222-4222-8222-222222222222";
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
  report: AssembledReport,
  capture?: { lastRequestedBy?: string },
  canRead = true,
): PdfExportRepository {
  const jobs = new Map<string, PdfExportJobRecord>();

  return {
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async PdfExportRepository contract (no awaitable work in this in-memory stub)
    async canReadReport() {
      return canRead;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async PdfExportRepository contract (no awaitable work in this in-memory stub)
    async createExportJob(job: PdfExportJob, requestedBy?: string) {
      if (capture) {
        capture.lastRequestedBy = requestedBy;
      }
      jobs.set(job.jobId, {
        ...structuredClone(job),
        requestedBy: requestedBy ?? "system",
      });
      return structuredClone(job);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async PdfExportRepository contract (no awaitable work in this in-memory stub)
    async getExportJob(jobId: string) {
      const job = jobs.get(jobId);
      return job ? structuredClone(job) : null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async PdfExportRepository contract (no awaitable work in this in-memory stub)
    async getPublishedReport(activeReportId: string) {
      return activeReportId === reportId ? structuredClone(report) : null;
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async PdfExportRepository contract (no awaitable work in this in-memory stub)
    async saveExportJob(job: PdfExportJob) {
      jobs.set(job.jobId, {
        ...structuredClone(job),
        requestedBy: jobs.get(job.jobId)?.requestedBy ?? "system",
      });
      return structuredClone(job);
    },
    // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async PdfExportRepository contract (no awaitable work in this in-memory stub)
    async markExportFailed(jobId: string, _error: string) {
      const job = jobs.get(jobId);
      if (job) {
        jobs.set(jobId, { ...job, status: "failed" as const });
      }
    },
  };
}

describe("PdfExportService", () => {
  it("rejects export requests for unpublished reports", async () => {
    const service = new PdfExportService(createRepository(draftReport));

    await expect(
      service.requestPdfExport(reportId, requesterSession),
    ).rejects.toBeInstanceOf(PdfExportDomainError);
  });

  it("creates an async queued export job for a published report", async () => {
    const service = new PdfExportService(createRepository(publishedReport));
    const job = await service.requestPdfExport(reportId, requesterSession);

    expect(job.reportId).toBe(reportId);
    expect(job.status).toBe("queued");
    expect(job.templateVersion).toBe("phase-2-pdf-v1");
  });

  it("marks export jobs complete with deterministic metadata", async () => {
    const service = new PdfExportService(createRepository(publishedReport));
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

  // requestedBy session threading
  it("threads requestedBy from the session userId into createExportJob", async () => {
    const capture: { lastRequestedBy?: string } = {};
    const service = new PdfExportService(
      createRepository(publishedReport, capture),
    );
    const sessionUserId = "00000000-0000-4000-8000-00000000abcd";

    await service.requestPdfExport(reportId, sessionFor(sessionUserId));

    expect(capture.lastRequestedBy).toBe(sessionUserId);
  });

  it("always attributes the job to the required session", async () => {
    const capture: { lastRequestedBy?: string } = {};
    const service = new PdfExportService(
      createRepository(publishedReport, capture),
    );

    await service.requestPdfExport(reportId, requesterSession);

    expect(capture.lastRequestedBy).toBe(requesterSession.userId);
  });

  it("still rejects unpublished reports even when a requestedBy is supplied", async () => {
    const service = new PdfExportService(createRepository(draftReport));

    await expect(
      service.requestPdfExport(
        reportId,
        sessionFor("00000000-0000-4000-8000-00000000abcd"),
      ),
    ).rejects.toBeInstanceOf(PdfExportDomainError);
  });

  it("hides export status from a different requester", async () => {
    const service = new PdfExportService(createRepository(publishedReport));
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
    const service = new PdfExportService(
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
    const service = new PdfExportService(
      createRepository(publishedReport),
      undefined,
      queue,
      new PdfExportInfrastructureTelemetry(undefined),
    );
    const before = await getCounterValue(customreportPdfExportRequestsTotal, {
      role: "head",
    });

    await expect(
      service.requestPdfExport(
        reportId,
        requesterSession,
        "pre-signed-token",
        "head",
      ),
    ).rejects.toThrow("Redis down");

    expect(
      await getCounterValue(customreportPdfExportRequestsTotal, {
        role: "head",
      }),
    ).toBe(before);
  });

  // Role-labelled counter. Three labels exercised (head | viewer | system)
  // confirm the optional `requestedByRole` is threaded through and the
  // omission path defaults to 'system' (worker / cron callers).
  it("bumps customreport_pdf_export_requests_total{role} per call", async () => {
    const service = new PdfExportService(
      createRepository(publishedReport),
      undefined,
      undefined,
      new PdfExportInfrastructureTelemetry(undefined),
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

    await service.requestPdfExport(
      reportId,
      sessionFor("u-head"),
      undefined,
      "head",
    );
    await service.requestPdfExport(
      reportId,
      sessionFor("u-viewer", "viewer"),
      undefined,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- prom-client label record shape
      values: { value: number; labels: Record<string, any> }[];
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

// ---------------------------------------------------------------------------
// The 5-min PDF export JWT cookie seam.
// ---------------------------------------------------------------------------

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
    const service = new PdfExportService(createRepository(publishedReport));

    expect(() => service.signPdfExportToken(reportId)).toThrow(
      PdfExportDomainError,
    );
  });

  it("signPdfExportToken throws PdfExportDomainError when secret is too short (<32 chars)", () => {
    // 17 chars: clears the old 16-char floor, fails the raised 32-char one.
    vi.stubEnv("PDF_EXPORT_JWT_SECRET", "seventeen-chars-x");
    const service = new PdfExportService(createRepository(publishedReport));

    expect(() => service.signPdfExportToken(reportId)).toThrow(
      PdfExportDomainError,
    );
  });

  it("verifyPdfExportToken throws when secret is too short (<32 chars)", () => {
    // 17 chars: clears the old 16-char floor, fails the raised 32-char one.
    vi.stubEnv("PDF_EXPORT_JWT_SECRET", "seventeen-chars-x");

    expect(() => verifyPdfExportToken("any.signed.token")).toThrow(
      />= 32 chars/,
    );
  });

  it("signPdfExportToken produces a JWT carrying claim {reportId} and exp ≤ 5min", () => {
    const service = new PdfExportService(createRepository(publishedReport));
    const before = Math.floor(Date.now() / 1000);
    const token = service.signPdfExportToken(reportId);
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

  it("requestPdfExport enqueues a JWT-shaped authToken bound to the reportId", async () => {
    interface EnqueuedJob {
      reportId: string;
      jobId: string;
      authToken: string;
    }
    const enqueued: EnqueuedJob[] = [];
    const fakeQueue = {
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async enqueue port (no awaitable work in this stub)
      enqueue: async (data: EnqueuedJob) => {
        enqueued.push(data);
      },
    };

    const service = new PdfExportService(
      createRepository(publishedReport),
      undefined,
      fakeQueue,
    );
    await service.requestPdfExport(reportId, requesterSession);

    expect(enqueued).toHaveLength(1);
    expect(expectDefined(enqueued[0]).reportId).toBe(reportId);
    expect(expectDefined(enqueued[0]).authToken).toMatch(/^eyJ/);

    const decoded = jwt.verify(
      expectDefined(enqueued[0]).authToken,
      PDF_SECRET,
    ) as {
      reportId: string;
    };
    expect(decoded.reportId).toBe(reportId);
  });

  it("requestPdfExport allows pre-signed authToken pass-through (does not re-sign)", async () => {
    interface EnqueuedJob {
      reportId: string;
      jobId: string;
      authToken: string;
    }
    const enqueued: EnqueuedJob[] = [];
    const fakeQueue = {
      // eslint-disable-next-line @typescript-eslint/require-await -- mock implements the async enqueue port (no awaitable work in this stub)
      enqueue: async (data: EnqueuedJob) => {
        enqueued.push(data);
      },
    };

    const presigned = jwt.sign({ reportId, custom: "override" }, PDF_SECRET, {
      expiresIn: "1m",
    });
    const service = new PdfExportService(
      createRepository(publishedReport),
      undefined,
      fakeQueue,
    );
    await service.requestPdfExport(reportId, requesterSession, presigned);

    expect(expectDefined(enqueued[0]).authToken).toBe(presigned);
  });
});

describe("markExportFailed", () => {
  it("updates job status to failed with error message", async () => {
    const repo = createRepository(publishedReport);
    const service = new PdfExportService(repo);

    // Create a job first
    const queued = await service.requestPdfExport(reportId, requesterSession);

    // Mark it as failed
    await service.markExportFailed(queued.jobId, "timeout error");

    // Verify the job status was updated
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

    const service = new PdfExportService(repo);
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
  it("uses AUTH_JWT_COOKIE_NAME env for cookie name", () => {
    const originalEnv = process.env.AUTH_JWT_COOKIE_NAME;
    process.env.AUTH_JWT_COOKIE_NAME = "my_custom_session";

    try {
      const service = new PdfExportService(createRepository(publishedReport));
      const cookies = service.buildAuthCookies("test-jwt-token");

      expect(cookies).toHaveLength(1);
      expect(cookies[0]?.name).toBe("my_custom_session");
      expect(cookies[0]?.value).toBe("test-jwt-token");
    } finally {
      if (originalEnv === undefined) {
        delete process.env.AUTH_JWT_COOKIE_NAME;
      } else {
        process.env.AUTH_JWT_COOKIE_NAME = originalEnv;
      }
    }
  });

  it("falls back to default cookie name when env is not set", () => {
    const originalEnv = process.env.AUTH_JWT_COOKIE_NAME;
    delete process.env.AUTH_JWT_COOKIE_NAME;

    try {
      const service = new PdfExportService(createRepository(publishedReport));
      const cookies = service.buildAuthCookies("test-jwt-token");

      expect(cookies[0]?.name).toBe("customreport_session");
    } finally {
      if (originalEnv !== undefined) {
        process.env.AUTH_JWT_COOKIE_NAME = originalEnv;
      }
    }
  });

  it("sets httpOnly to true for security", () => {
    const service = new PdfExportService(createRepository(publishedReport));
    const cookies = service.buildAuthCookies("test-jwt-token");

    expect(cookies[0]?.httpOnly).toBe(true);
  });

  // The cookie is scoped via Playwright's `url` field instead of
  // `domain`+`secure` inference. The url-based form works regardless of
  // hostname shape (localhost, IP, behind-proxy).
  it("uses PDF_BASE_URL as the cookie url verbatim (https hostname)", () => {
    const originalEnv = process.env.PDF_BASE_URL;
    process.env.PDF_BASE_URL = "https://reports.company.com";

    try {
      const service = new PdfExportService(createRepository(publishedReport));
      const cookies = service.buildAuthCookies("test-jwt-token");

      expect(cookies[0]?.url).toBe("https://reports.company.com");
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
      const service = new PdfExportService(createRepository(publishedReport));
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
    // Defense against M-01: Playwright's addCookies() rejects entries
    // whose `domain` field would resolve to an IP — using `url` sidesteps
    // that branch entirely.
    const originalEnv = process.env.PDF_BASE_URL;
    process.env.PDF_BASE_URL = "http://10.0.0.5:3000";

    try {
      const service = new PdfExportService(createRepository(publishedReport));
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
      const service = new PdfExportService(createRepository(publishedReport));
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
    const service = new PdfExportService(createRepository(publishedReport));
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
