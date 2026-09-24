import {
  type PdfExportJob,
  publishedReportSnapshotSchema,
  type UserSession,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  PdfExportStateConflictError,
  UnsupportedPdfExportStatusError,
} from "./pdf-export.job-state.js";
import { PdfExportPrismaRepository } from "./pdf-export.prisma-repository";
import { PdfExportDomainError } from "./pdf-export.service";

const REPORT_ID = "659b2767-0f86-41e2-b025-49730ca010e4";
const AUTHOR_ID = "6f99661a-cac6-4d06-bf08-2a14cced554d";
const EXPORT_JOB_ID = "759b2767-0f86-41e2-b025-49730ca010e4";
const EXPORT_CREATED_AT = new Date("2026-06-09T00:00:00Z");
const EXPORT_ARTIFACT_URL = `/pdfs/${EXPORT_JOB_ID}.pdf`;

const publishedSnapshot = {
  reportId: REPORT_ID,
  periodStart: "2026-06-01",
  periodEnd: "2026-06-07",
  deadline: "2026-06-08",
  status: "published",
  publishedAt: "2026-06-09T00:00:00.000Z",
  publishedById: AUTHOR_ID,
  publishedByName: "Head",
  portfolioOverview: {
    status: "green",
    totals: { green: 0, yellow: 0, red: 0 },
  },
  sections: [],
} as const;

interface PdfExportRow {
  id: string;
  reportId: string;
  status: string;
  templateVersion: string;
  filePath: string | null;
  checksum: string | null;
  error: string | null;
  requestedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

function exportRow(overrides: Partial<PdfExportRow> = {}): PdfExportRow {
  return {
    id: EXPORT_JOB_ID,
    reportId: REPORT_ID,
    status: "pending",
    templateVersion: "phase-2-pdf-v1",
    filePath: null,
    checksum: null,
    error: null,
    requestedBy: AUTHOR_ID,
    createdAt: EXPORT_CREATED_AT,
    updatedAt: EXPORT_CREATED_AT,
    ...overrides,
  };
}

function completedExportJob(
  overrides: Partial<PdfExportJob> = {},
): PdfExportJob {
  return {
    jobId: EXPORT_JOB_ID,
    reportId: REPORT_ID,
    status: "completed",
    requestedAt: EXPORT_CREATED_AT,
    completedAt: EXPORT_CREATED_AT,
    checksum: "checksum-a",
    templateVersion: "phase-2-pdf-v1",
    artifactUrl: EXPORT_ARTIFACT_URL,
    ...overrides,
  };
}

function createAtomicPdfExportPrisma(initial: PdfExportRow) {
  let current = structuredClone(initial);
  const updateMany = vi.fn(
    (input: {
      where: { id: string; status: string };
      data: Partial<PdfExportRow>;
    }) => {
      if (
        current.id !== input.where.id ||
        current.status !== input.where.status
      ) {
        return { count: 0 };
      }
      current = {
        ...current,
        ...input.data,
        updatedAt: new Date("2026-06-09T00:00:01Z"),
      };
      return { count: 1 };
    },
  );
  const findUnique = vi.fn(() => current);

  return {
    pdfExportJob: { updateMany, findUnique },
    readCurrent: () => current,
  };
}

describe("PdfExportPrismaRepository", () => {
  const viewerSession: UserSession = {
    userId: AUTHOR_ID,
    email: "viewer@example.test",
    name: "Viewer",
    role: "viewer",
    viewerGroupAccess: ["a1111111-1111-4111-8111-111111111111"],
  };

  function createPublishedReportPrisma(result: unknown) {
    const reportFindFirst = vi.fn().mockResolvedValue(result);
    const transaction = {
      report: { findFirst: reportFindFirst },
    } as unknown as PrismaService;
    const prisma = {
      $transaction: vi.fn((callback: (tx: PrismaService) => unknown) =>
        callback(transaction),
      ),
    } as unknown as PrismaService;
    return { prisma };
  }

  it("fails closed when an admitted PDF report has no scoped snapshot sections", async () => {
    const { prisma } = createPublishedReportPrisma({
      id: REPORT_ID,
      publishedSnapshot: publishedReportSnapshotSchema.parse(publishedSnapshot),
    });
    const repository = new PdfExportPrismaRepository(prisma);

    await expect(
      repository.getPublishedReportForExport(REPORT_ID, viewerSession),
    ).rejects.toThrow("Published snapshot integrity failure");
  });

  it("keeps an unauthorized PDF report as null when DB admission returns no row", async () => {
    const { prisma } = createPublishedReportPrisma(null);
    const repository = new PdfExportPrismaRepository(prisma);

    await expect(
      repository.getPublishedReportForExport(REPORT_ID, viewerSession),
    ).resolves.toBeNull();
  });

  it("allows an admin PDF read of a valid sectionless snapshot", async () => {
    const { prisma } = createPublishedReportPrisma({
      id: REPORT_ID,
      publishedSnapshot: publishedReportSnapshotSchema.parse(publishedSnapshot),
    });
    const repository = new PdfExportPrismaRepository(prisma);

    await expect(
      repository.getPublishedReportForExport(REPORT_ID, {
        ...viewerSession,
        role: "admin",
      }),
    ).resolves.toMatchObject({ reportId: REPORT_ID, sections: [] });
  });

  it("fails loud when the database returns an unknown export status", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "759b2767-0f86-41e2-b025-49730ca010e4",
      reportId: REPORT_ID,
      status: "paused",
      templateVersion: "phase-2-pdf-v1",
      filePath: null,
      checksum: null,
      error: null,
      requestedBy: AUTHOR_ID,
      createdAt: new Date("2026-06-09T00:00:00Z"),
      updatedAt: new Date("2026-06-09T00:00:00Z"),
    });
    const prisma = {
      pdfExportJob: { findUnique },
    } as unknown as PrismaService;
    const repo = new PdfExportPrismaRepository(prisma);

    await expect(repo.getExportJob("job-1")).rejects.toEqual(
      expect.objectContaining({
        name: UnsupportedPdfExportStatusError.name,
        message: "Unsupported PDF export database status: paused",
      }),
    );
  });
});

describe("PdfExportPrismaRepository template provenance", () => {
  it("persists the template version at creation instead of stamping it at read time", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "759b2767-0f86-41e2-b025-49730ca010e4",
      reportId: REPORT_ID,
      status: "pending",
      templateVersion: "phase-2-pdf-v1",
      filePath: null,
      checksum: null,
      error: null,
      requestedBy: AUTHOR_ID,
      createdAt: new Date("2026-06-09T00:00:00Z"),
      updatedAt: new Date("2026-06-09T00:00:00Z"),
    });
    const prisma = {
      pdfExportJob: { create },
    } as unknown as PrismaService;
    const repo = new PdfExportPrismaRepository(prisma);
    const parsedSnapshot =
      publishedReportSnapshotSchema.parse(publishedSnapshot);

    await repo.createExportJob(
      {
        jobId: "759b2767-0f86-41e2-b025-49730ca010e4",
        reportId: REPORT_ID,
        status: "queued",
        requestedAt: new Date("2026-06-09T00:00:00Z"),
        completedAt: null,
        checksum: null,
        templateVersion: "phase-2-pdf-v1",
        artifactUrl: null,
      },
      AUTHOR_ID,
      parsedSnapshot,
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          id: "759b2767-0f86-41e2-b025-49730ca010e4",
          reportId: REPORT_ID,
          status: "pending",
          requestedBy: AUTHOR_ID,
          templateVersion: "phase-2-pdf-v1",
          filePath: null,
          checksum: null,
          error: null,
          publicationAt: parsedSnapshot.publishedAt,
          publicationSnapshot: parsedSnapshot,
          publicationGroupIds: [],
        },
      }),
    );
  });

  it("fails loud when job creation omits the requester (no system fallback)", async () => {
    const create = vi.fn();
    const prisma = {
      pdfExportJob: { create },
    } as unknown as PrismaService;
    const repo = new PdfExportPrismaRepository(prisma);

    await expect(
      repo.createExportJob(
        {
          jobId: "759b2767-0f86-41e2-b025-49730ca010e4",
          reportId: REPORT_ID,
          status: "queued",
          requestedAt: new Date("2026-06-09T00:00:00Z"),
          completedAt: null,
          checksum: null,
          templateVersion: "phase-2-pdf-v1",
          artifactUrl: null,
        },
        "",
        publishedReportSnapshotSchema.parse(publishedSnapshot),
      ),
    ).rejects.toBeInstanceOf(PdfExportDomainError);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("PdfExportPrismaRepository terminal-state CAS", () => {
  it.each([
    ["queued", { status: "queued" }],
    ["failed", { status: "failed" }],
    ["null artifact URL", { artifactUrl: null }],
    ["wrong artifact URL", { artifactUrl: "/exports/other.pdf" }],
    ["null checksum", { checksum: null }],
  ])(
    "rejects %s completion before any database write",
    async (_label, overrides) => {
      const updateMany = vi.fn();
      const prisma = {
        pdfExportJob: { updateMany },
      } as unknown as PrismaService;
      const repo = new PdfExportPrismaRepository(prisma);

      await expect(
        repo.saveExportJob(
          completedExportJob(overrides as Partial<PdfExportJob>),
        ),
      ).rejects.toBeInstanceOf(PdfExportDomainError);
      expect(updateMany).not.toHaveBeenCalled();
    },
  );

  it("moves a pending job to completed with one guarded update", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const findUnique = vi.fn().mockResolvedValue(
      exportRow({
        status: "completed",
        filePath: EXPORT_ARTIFACT_URL,
        checksum: "checksum-a",
        updatedAt: new Date("2026-06-09T00:00:01Z"),
      }),
    );
    const prisma = {
      pdfExportJob: { updateMany, findUnique },
    } as unknown as PrismaService;
    const repo = new PdfExportPrismaRepository(prisma);

    await expect(
      repo.saveExportJob(completedExportJob()),
    ).resolves.toMatchObject({
      status: "completed",
      artifactUrl: EXPORT_ARTIFACT_URL,
      checksum: "checksum-a",
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: EXPORT_JOB_ID, status: "pending" },
      data: {
        status: "completed",
        filePath: EXPORT_ARTIFACT_URL,
        checksum: "checksum-a",
        error: null,
      },
    });
  });

  it("moves a pending job to failed while clearing artifact fields", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const prisma = {
      pdfExportJob: { updateMany },
    } as unknown as PrismaService;
    const repo = new PdfExportPrismaRepository(prisma);

    await repo.markExportFailed(EXPORT_JOB_ID, "browser crashed");

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: EXPORT_JOB_ID, status: "pending" },
      data: {
        status: "failed",
        filePath: null,
        checksum: null,
        error: "browser crashed",
      },
    });
  });

  it.each(["completed", "failed"] as const)(
    "treats a failure after %s as an idempotent no-op",
    async (status) => {
      const updateMany = vi.fn().mockResolvedValue({ count: 0 });
      const findUnique = vi.fn().mockResolvedValue(
        exportRow({
          status,
          ...(status === "completed"
            ? {
                filePath: EXPORT_ARTIFACT_URL,
                checksum: "checksum-a",
              }
            : { error: "browser crashed" }),
        }),
      );
      const prisma = {
        pdfExportJob: { updateMany, findUnique },
      } as unknown as PrismaService;
      const repo = new PdfExportPrismaRepository(prisma);

      await expect(
        repo.markExportFailed(EXPORT_JOB_ID, "late failure"),
      ).resolves.toBeUndefined();
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: EXPORT_JOB_ID },
      });
    },
  );

  it("rejects a failure for a missing job after the guarded update misses", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const findUnique = vi.fn().mockResolvedValue(null);
    const prisma = {
      pdfExportJob: { updateMany, findUnique },
    } as unknown as PrismaService;
    const repo = new PdfExportPrismaRepository(prisma);

    await expect(
      repo.markExportFailed(EXPORT_JOB_ID, "browser crashed"),
    ).rejects.toBeInstanceOf(PdfExportDomainError);
  });

  it("does not overwrite a completed job when failure loses the terminal race", async () => {
    const prisma = createAtomicPdfExportPrisma(exportRow());
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await repo.saveExportJob(completedExportJob());
    await repo.markExportFailed(EXPORT_JOB_ID, "late failure");

    expect(prisma.readCurrent()).toMatchObject({
      status: "completed",
      filePath: EXPORT_ARTIFACT_URL,
      checksum: "checksum-a",
      error: null,
    });
  });

  it("treats an identical completed artifact as an idempotent completion", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const findUnique = vi.fn().mockResolvedValue(
      exportRow({
        status: "completed",
        filePath: EXPORT_ARTIFACT_URL,
        checksum: "checksum-a",
      }),
    );
    const prisma = {
      pdfExportJob: { updateMany, findUnique },
    } as unknown as PrismaService;
    const repo = new PdfExportPrismaRepository(prisma);

    await expect(
      repo.saveExportJob(completedExportJob()),
    ).resolves.toMatchObject({
      status: "completed",
      artifactUrl: EXPORT_ARTIFACT_URL,
      checksum: "checksum-a",
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: EXPORT_JOB_ID },
    });
  });

  it("rejects completion when failure won the terminal race", async () => {
    const prisma = createAtomicPdfExportPrisma(
      exportRow({
        status: "failed",
        error: "browser crashed",
      }),
    );
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(
      repo.saveExportJob(completedExportJob()),
    ).rejects.toBeInstanceOf(PdfExportStateConflictError);
    expect(prisma.readCurrent()).toMatchObject({
      status: "failed",
      filePath: null,
      checksum: null,
      error: "browser crashed",
    });
  });

  it("rejects a different completion after another artifact won", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const findUnique = vi.fn().mockResolvedValue(
      exportRow({
        status: "completed",
        filePath: `/pdfs/${EXPORT_JOB_ID}-other.pdf`,
        checksum: "checksum-b",
      }),
    );
    const prisma = {
      pdfExportJob: { updateMany, findUnique },
    } as unknown as PrismaService;
    const repo = new PdfExportPrismaRepository(prisma);

    await expect(
      repo.saveExportJob(completedExportJob()),
    ).rejects.toBeInstanceOf(PdfExportStateConflictError);
  });

  it("does not accept an incoherent completed row as an idempotent retry", async () => {
    const prisma = createAtomicPdfExportPrisma(
      exportRow({
        status: "completed",
        filePath: EXPORT_ARTIFACT_URL,
        checksum: "checksum-a",
        error: "stale failure",
      }),
    );
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(
      repo.saveExportJob(completedExportJob()),
    ).rejects.toBeInstanceOf(PdfExportStateConflictError);
    expect(prisma.readCurrent()).toMatchObject({
      status: "completed",
      filePath: EXPORT_ARTIFACT_URL,
      checksum: "checksum-a",
      error: "stale failure",
    });
  });
});

// The fake transaction models the two properties the row lock relies on:
// every write runs on the tx client, and a rejected callback restores the
// pre-transaction row (the mock stands in for PostgreSQL's rollback; the real
// FOR UPDATE wait is covered by the integration suite).
describe("PdfExportPrismaRepository runLockedExportJob", () => {
  function createLockedPrisma(initial: PdfExportRow | null) {
    let current = initial ? structuredClone(initial) : null;
    const updateMany = vi.fn(
      (input: {
        where: { id: string; status: string };
        data: Partial<PdfExportRow>;
      }) => {
        if (
          current?.id !== input.where.id ||
          current.status !== input.where.status
        ) {
          return Promise.resolve({ count: 0 });
        }
        current = {
          ...current,
          ...input.data,
          updatedAt: new Date("2026-06-09T00:00:01Z"),
        };
        return Promise.resolve({ count: 1 });
      },
    );
    const findUnique = vi.fn(() =>
      Promise.resolve(current ? structuredClone(current) : null),
    );
    const queryRaw = vi.fn(() =>
      Promise.resolve(current ? [structuredClone(current)] : []),
    );
    const tx = {
      $queryRaw: queryRaw,
      pdfExportJob: { updateMany, findUnique },
    };
    const transaction = vi.fn(async (run: (tx: unknown) => unknown) => {
      const before = current ? structuredClone(current) : null;
      try {
        return await run(tx);
      } catch (error) {
        current = before;
        throw error;
      }
    });
    return {
      prisma: { $transaction: transaction },
      tx,
      readCurrent: () => current,
    };
  }

  it("locks the export row FOR UPDATE inside one transaction before the callback", async () => {
    const { prisma, tx } = createLockedPrisma(
      exportRow({ status: "failed", error: "browser crashed" }),
    );
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    const seen: string[] = [];
    await repo.runLockedExportJob(EXPORT_JOB_ID, (job) => {
      expect(job).toMatchObject({
        jobId: EXPORT_JOB_ID,
        reportId: REPORT_ID,
        status: "failed",
        requestedBy: AUTHOR_ID,
      });
      seen.push("callback");
      return Promise.resolve();
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    const [strings] = expectDefined(tx.$queryRaw.mock.calls[0]) as unknown as [
      readonly string[],
    ];
    expect(strings.join("")).toContain('FROM "PdfExportJob"');
    expect(strings.join("")).toContain("FOR UPDATE");
    expect(seen).toEqual(["callback"]);
  });

  it("hands a null job to the callback when no export row exists", async () => {
    const { prisma } = createLockedPrisma(null);
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await repo.runLockedExportJob(EXPORT_JOB_ID, (job) => {
      expect(job).toBeNull();
      return Promise.resolve();
    });
  });

  it("revives a failed row to pending, clearing artifact and error fields, on the tx client", async () => {
    const { prisma, tx, readCurrent } = createLockedPrisma(
      exportRow({ status: "failed", error: "browser crashed" }),
    );
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await repo.runLockedExportJob(EXPORT_JOB_ID, async (_job, writes) => {
      await writes.reviveFailed();
    });

    expect(tx.pdfExportJob.updateMany).toHaveBeenCalledWith({
      where: { id: EXPORT_JOB_ID, status: "failed" },
      data: {
        status: "pending",
        filePath: null,
        checksum: null,
        error: null,
      },
    });
    expect(readCurrent()).toMatchObject({
      status: "pending",
      filePath: null,
      checksum: null,
      error: null,
      // Immutable identity columns are untouched by the revival.
      reportId: REPORT_ID,
      requestedBy: AUTHOR_ID,
      templateVersion: "phase-2-pdf-v1",
    });
  });

  it("fails loud when the locked row is no longer failed", async () => {
    const { prisma, readCurrent } = createLockedPrisma(exportRow());
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(
      repo.runLockedExportJob(EXPORT_JOB_ID, async (_job, writes) => {
        await writes.reviveFailed();
      }),
    ).rejects.toBeInstanceOf(PdfExportDomainError);
    expect(readCurrent()).toMatchObject({ status: "pending" });
  });

  it("rolls the revival back when the locked callback rejects", async () => {
    const { prisma, readCurrent } = createLockedPrisma(
      exportRow({ status: "failed", error: "browser crashed" }),
    );
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(
      repo.runLockedExportJob(EXPORT_JOB_ID, async (_job, writes) => {
        await writes.reviveFailed();
        throw new Error("queue.retry acknowledgement lost");
      }),
    ).rejects.toThrow("queue.retry acknowledgement lost");

    expect(readCurrent()).toMatchObject({
      status: "failed",
      error: "browser crashed",
    });
  });

  it("keeps failure-after-completion a no-op inside the lock", async () => {
    const { prisma, readCurrent } = createLockedPrisma(
      exportRow({
        status: "completed",
        filePath: EXPORT_ARTIFACT_URL,
        checksum: "checksum-a",
      }),
    );
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await repo.runLockedExportJob(EXPORT_JOB_ID, async (_job, writes) => {
      await writes.markFailed("late failure");
    });

    expect(readCurrent()).toMatchObject({
      status: "completed",
      filePath: EXPORT_ARTIFACT_URL,
      checksum: "checksum-a",
      error: null,
    });
  });

  it("adopts only the canonical artifact through the locked completion CAS", async () => {
    const { prisma, readCurrent } = createLockedPrisma(exportRow());
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await repo.runLockedExportJob(EXPORT_JOB_ID, async (_job, writes) => {
      await expect(
        writes.markCompleted("/exports/other.pdf", "sha-foreign"),
      ).rejects.toBeInstanceOf(PdfExportDomainError);
      const completed = await writes.markCompleted(
        EXPORT_ARTIFACT_URL,
        "checksum-a",
      );
      expect(completed).toMatchObject({ status: "completed" });
    });

    expect(readCurrent()).toMatchObject({
      status: "completed",
      filePath: EXPORT_ARTIFACT_URL,
      checksum: "checksum-a",
    });
  });
});
