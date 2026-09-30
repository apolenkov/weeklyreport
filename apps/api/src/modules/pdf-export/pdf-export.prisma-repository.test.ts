import {
  type PdfExportJob,
  publishedReportSnapshotSchema,
  type UserSession,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { expectDefined } from "../../test-utils/expect-defined.js";
import {
  PdfExportDomainError,
  PdfExportStateConflictError,
  UnsupportedPdfExportStatusError,
} from "./pdf-export.job-state.js";
import { PdfExportPrismaRepository } from "./pdf-export.prisma-repository";

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
  generation: number;
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
    generation: 1,
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
    generation: 1,
    requestedAt: EXPORT_CREATED_AT,
    completedAt: EXPORT_CREATED_AT,
    checksum: "checksum-a",
    templateVersion: "phase-2-pdf-v1",
    artifactUrl: EXPORT_ARTIFACT_URL,
    ...overrides,
  };
}

// Mirrors the repository's CAS where-clauses: `status` is either a single
// value or an `{ in: [...] }` set, and `generation` is an optional conjunct.
function matchesCasWhere(
  current: PdfExportRow,
  where: {
    id: string;
    status: string | { in: string[] };
    generation?: number;
  },
): boolean {
  if (current.id !== where.id) return false;
  if (
    where.generation !== undefined &&
    current.generation !== where.generation
  ) {
    return false;
  }
  return typeof where.status === "string"
    ? current.status === where.status
    : where.status.in.includes(current.status);
}

function createAtomicPdfExportPrisma(initial: PdfExportRow) {
  let current = structuredClone(initial);
  const updateMany = vi.fn(
    (input: {
      where: {
        id: string;
        status: string | { in: string[] };
        generation?: number;
      };
      data: Partial<PdfExportRow>;
    }) => {
      if (!matchesCasWhere(current, input.where)) {
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
      generation: 1,
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

  it("maps a recovery_required row and carries its generation", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValue(
        exportRow({ status: "recovery_required", generation: 3 }),
      );
    const prisma = {
      pdfExportJob: { findUnique },
    } as unknown as PrismaService;
    const repo = new PdfExportPrismaRepository(prisma);

    await expect(repo.getExportJob(EXPORT_JOB_ID)).resolves.toMatchObject({
      jobId: EXPORT_JOB_ID,
      status: "recovery_required",
      generation: 3,
      requestedBy: AUTHOR_ID,
    });
  });
});

describe("PdfExportPrismaRepository template provenance", () => {
  it("persists the template version at creation instead of stamping it at read time", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "759b2767-0f86-41e2-b025-49730ca010e4",
      reportId: REPORT_ID,
      status: "pending",
      generation: 1,
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
        generation: 1,
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
          generation: 1,
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
          generation: 1,
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
      where: { id: EXPORT_JOB_ID, status: "pending", generation: 1 },
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

    await repo.markExportFailed(EXPORT_JOB_ID, 1, "browser crashed");

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: EXPORT_JOB_ID, status: "pending", generation: 1 },
      data: {
        status: "failed",
        filePath: null,
        checksum: null,
        error: "browser crashed",
      },
    });
  });

  it.each(["completed", "failed", "recovery_required"] as const)(
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
        repo.markExportFailed(EXPORT_JOB_ID, 1, "late failure"),
      ).resolves.toBeUndefined();
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: EXPORT_JOB_ID },
      });
    },
  );

  it("treats a stale-generation failure on a pending row as an idempotent no-op", async () => {
    const prisma = createAtomicPdfExportPrisma(exportRow({ generation: 2 }));
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(
      repo.markExportFailed(EXPORT_JOB_ID, 1, "stale failure"),
    ).resolves.toBeUndefined();
    expect(prisma.readCurrent()).toMatchObject({
      status: "pending",
      generation: 2,
      error: null,
    });
  });

  it("rejects a completion for another generation without touching the row", async () => {
    const prisma = createAtomicPdfExportPrisma(exportRow({ generation: 2 }));
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(
      repo.saveExportJob(completedExportJob({ generation: 1 })),
    ).rejects.toBeInstanceOf(PdfExportStateConflictError);
    expect(prisma.readCurrent()).toMatchObject({
      status: "pending",
      generation: 2,
      filePath: null,
      checksum: null,
    });
  });

  it("rejects a failure for a missing job after the guarded update misses", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const findUnique = vi.fn().mockResolvedValue(null);
    const prisma = {
      pdfExportJob: { updateMany, findUnique },
    } as unknown as PrismaService;
    const repo = new PdfExportPrismaRepository(prisma);

    await expect(
      repo.markExportFailed(EXPORT_JOB_ID, 1, "browser crashed"),
    ).rejects.toBeInstanceOf(PdfExportDomainError);
  });

  it("does not overwrite a completed job when failure loses the terminal race", async () => {
    const prisma = createAtomicPdfExportPrisma(exportRow());
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await repo.saveExportJob(completedExportJob());
    await repo.markExportFailed(EXPORT_JOB_ID, 1, "late failure");

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
        where: {
          id: string;
          status: string | { in: string[] };
          generation?: number;
        };
        data: Partial<PdfExportRow>;
      }) => {
        if (current === null || !matchesCasWhere(current, input.where)) {
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
        generation: 1,
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
    expect(strings.join("")).toContain('"generation"');
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

  it.each(["failed", "recovery_required"] as const)(
    "advances a %s row to pending at generation+1, clearing terminal fields, on the tx client",
    async (status) => {
      const { prisma, tx, readCurrent } = createLockedPrisma(
        exportRow({
          status,
          filePath: EXPORT_ARTIFACT_URL,
          checksum: "checksum-a",
          error: "browser crashed",
        }),
      );
      const repo = new PdfExportPrismaRepository(
        prisma as unknown as PrismaService,
      );

      await repo.runLockedExportJob(EXPORT_JOB_ID, async (_job, writes) => {
        await writes.advanceGeneration(1);
      });

      expect(tx.pdfExportJob.updateMany).toHaveBeenCalledWith({
        where: {
          id: EXPORT_JOB_ID,
          status: { in: ["failed", "recovery_required"] },
          generation: 1,
        },
        data: {
          status: "pending",
          generation: 2,
          filePath: null,
          checksum: null,
          error: null,
        },
      });
      expect(readCurrent()).toMatchObject({
        status: "pending",
        generation: 2,
        filePath: null,
        checksum: null,
        error: null,
        // Immutable identity columns are untouched by the advance.
        reportId: REPORT_ID,
        requestedBy: AUTHOR_ID,
        templateVersion: "phase-2-pdf-v1",
      });
    },
  );

  it("fails loud when the locked row is not at the expected generation", async () => {
    const { prisma, readCurrent } = createLockedPrisma(
      exportRow({ status: "failed", generation: 2, error: "crashed" }),
    );
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(
      repo.runLockedExportJob(EXPORT_JOB_ID, async (_job, writes) => {
        await writes.advanceGeneration(1);
      }),
    ).rejects.toBeInstanceOf(PdfExportDomainError);
    expect(readCurrent()).toMatchObject({ status: "failed", generation: 2 });
  });

  it("fails loud when the locked row is not retryable", async () => {
    const { prisma, readCurrent } = createLockedPrisma(exportRow());
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(
      repo.runLockedExportJob(EXPORT_JOB_ID, async (_job, writes) => {
        await writes.advanceGeneration(1);
      }),
    ).rejects.toBeInstanceOf(PdfExportDomainError);
    expect(readCurrent()).toMatchObject({ status: "pending", generation: 1 });
  });

  it("rolls the generation advance back when the locked callback rejects", async () => {
    const { prisma, readCurrent } = createLockedPrisma(
      exportRow({ status: "failed", error: "browser crashed" }),
    );
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(
      repo.runLockedExportJob(EXPORT_JOB_ID, async (_job, writes) => {
        await writes.advanceGeneration(1);
        throw new Error("queue.add acknowledgement lost");
      }),
    ).rejects.toThrow("queue.add acknowledgement lost");

    expect(readCurrent()).toMatchObject({
      status: "failed",
      generation: 1,
      error: "browser crashed",
    });
  });

  it("quarantines a pending row as recovery_required at its generation", async () => {
    const { prisma, tx, readCurrent } = createLockedPrisma(
      exportRow({ generation: 2 }),
    );
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await repo.runLockedExportJob(EXPORT_JOB_ID, async (_job, writes) => {
      await writes.markRecoveryRequired(2);
    });

    expect(tx.pdfExportJob.updateMany).toHaveBeenCalledWith({
      where: { id: EXPORT_JOB_ID, status: "pending", generation: 2 },
      data: { status: "recovery_required" },
    });
    expect(readCurrent()).toMatchObject({
      status: "recovery_required",
      generation: 2,
    });
  });

  it("refuses to quarantine a row at another generation", async () => {
    const { prisma, readCurrent } = createLockedPrisma(exportRow());
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(
      repo.runLockedExportJob(EXPORT_JOB_ID, async (_job, writes) => {
        await writes.markRecoveryRequired(2);
      }),
    ).rejects.toBeInstanceOf(PdfExportDomainError);
    expect(readCurrent()).toMatchObject({ status: "pending", generation: 1 });
  });

  it.each(["completed", "failed", "recovery_required"] as const)(
    "refuses to quarantine a %s row",
    async (status) => {
      const { prisma, readCurrent } = createLockedPrisma(exportRow({ status }));
      const repo = new PdfExportPrismaRepository(
        prisma as unknown as PrismaService,
      );

      await expect(
        repo.runLockedExportJob(EXPORT_JOB_ID, async (_job, writes) => {
          await writes.markRecoveryRequired(1);
        }),
      ).rejects.toBeInstanceOf(PdfExportDomainError);
      expect(readCurrent()).toMatchObject({ status });
    },
  );

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
      await writes.markFailed(1, "late failure");
    });

    expect(readCurrent()).toMatchObject({
      status: "completed",
      filePath: EXPORT_ARTIFACT_URL,
      checksum: "checksum-a",
      error: null,
    });
  });

  it("leaves a pending row unchanged when the locked failure names another generation", async () => {
    const { prisma, readCurrent } = createLockedPrisma(
      exportRow({ generation: 2 }),
    );
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await repo.runLockedExportJob(EXPORT_JOB_ID, async (_job, writes) => {
      await writes.markFailed(1, "stale failure");
    });

    expect(readCurrent()).toMatchObject({
      status: "pending",
      generation: 2,
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
        writes.markCompleted(1, "/exports/other.pdf", "sha-foreign"),
      ).rejects.toBeInstanceOf(PdfExportDomainError);
      const completed = await writes.markCompleted(
        1,
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

  it("rejects a locked completion that names another generation", async () => {
    const { prisma, readCurrent } = createLockedPrisma(
      exportRow({ generation: 2 }),
    );
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    await expect(
      repo.runLockedExportJob(EXPORT_JOB_ID, async (_job, writes) => {
        await writes.markCompleted(1, EXPORT_ARTIFACT_URL, "checksum-a");
      }),
    ).rejects.toBeInstanceOf(PdfExportStateConflictError);

    expect(readCurrent()).toMatchObject({
      status: "pending",
      generation: 2,
      filePath: null,
      checksum: null,
    });
  });
});

describe("PdfExportPrismaRepository listPendingExportCandidates", () => {
  // Applies the real where/orderBy/take semantics to an in-memory row set so
  // the tests exercise keyset behavior, not just emitted argument shapes.
  function createListingPrisma(rows: PdfExportRow[]) {
    const findMany = vi.fn(
      (args: {
        where: {
          status: string;
          createdAt: { lte: Date };
          OR?: [
            { createdAt: { gt: Date } },
            { createdAt: Date; id: { gt: string } },
          ];
        };
        orderBy: [{ createdAt: "asc" }, { id: "asc" }];
        take: number;
        select: Record<string, true>;
      }) => {
        const matched = rows
          .filter((row) => {
            if (row.status !== args.where.status) return false;
            if (row.createdAt > args.where.createdAt.lte) return false;
            if (args.where.OR !== undefined) {
              const [afterCreatedAt, tieBreak] = args.where.OR;
              const past = row.createdAt > afterCreatedAt.createdAt.gt;
              const tied =
                row.createdAt.getTime() ===
                  new Date(tieBreak.createdAt).getTime() &&
                row.id > tieBreak.id.gt;
              if (!past && !tied) return false;
            }
            return true;
          })
          .sort(
            (a, b) =>
              a.createdAt.getTime() - b.createdAt.getTime() ||
              a.id.localeCompare(b.id),
          )
          .slice(0, args.take);
        return Promise.resolve(
          matched.map((row) => ({
            id: row.id,
            generation: row.generation,
            createdAt: row.createdAt,
          })),
        );
      },
    );
    return {
      prisma: { pdfExportJob: { findMany } },
      findMany,
    };
  }

  const BOUND = new Date("2026-06-09T01:00:00Z");

  function listingRows(): PdfExportRow[] {
    return [
      exportRow({
        id: "aaaaaaaa-0000-4000-8000-000000000002",
        createdAt: new Date("2026-06-09T00:10:00Z"),
        generation: 2,
      }),
      exportRow({
        id: "aaaaaaaa-0000-4000-8000-000000000001",
        createdAt: new Date("2026-06-09T00:10:00Z"),
      }),
      exportRow({
        id: "bbbbbbbb-0000-4000-8000-000000000001",
        status: "failed",
        createdAt: new Date("2026-06-09T00:05:00Z"),
      }),
      exportRow({
        id: "bbbbbbbb-0000-4000-8000-000000000002",
        status: "recovery_required",
        createdAt: new Date("2026-06-09T00:05:00Z"),
      }),
      exportRow({
        id: "cccccccc-0000-4000-8000-000000000001",
        createdAt: new Date("2026-06-09T00:20:00Z"),
      }),
      // Created after the bound: a pass must never chase it.
      exportRow({
        id: "dddddddd-0000-4000-8000-000000000001",
        createdAt: new Date("2026-06-09T01:05:00Z"),
      }),
    ];
  }

  it("returns pending rows at or below the bound in (createdAt, id) order", async () => {
    const { prisma, findMany } = createListingPrisma(listingRows());
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    const page = await repo.listPendingExportCandidates(BOUND, null, 10);

    expect(page.map((row) => row.jobId)).toEqual([
      "aaaaaaaa-0000-4000-8000-000000000001",
      "aaaaaaaa-0000-4000-8000-000000000002",
      "cccccccc-0000-4000-8000-000000000001",
    ]);
    expect(page[0]).toMatchObject({ generation: 1 });
    expect(page[1]).toMatchObject({ generation: 2 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "pending", createdAt: { lte: BOUND } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 10,
      }),
    );
  });

  it("advances the (createdAt, id) keyset past every inspected row", async () => {
    const { prisma } = createListingPrisma(listingRows());
    const repo = new PdfExportPrismaRepository(
      prisma as unknown as PrismaService,
    );

    const first = await repo.listPendingExportCandidates(BOUND, null, 2);
    expect(first.map((row) => row.jobId)).toEqual([
      "aaaaaaaa-0000-4000-8000-000000000001",
      "aaaaaaaa-0000-4000-8000-000000000002",
    ]);

    const second = await repo.listPendingExportCandidates(
      BOUND,
      {
        createdAt: expectDefined(first[1]).createdAt,
        jobId: expectDefined(first[1]).jobId,
      },
      2,
    );
    expect(second.map((row) => row.jobId)).toEqual([
      "cccccccc-0000-4000-8000-000000000001",
    ]);

    const third = await repo.listPendingExportCandidates(
      BOUND,
      {
        createdAt: expectDefined(second[0]).createdAt,
        jobId: expectDefined(second[0]).jobId,
      },
      2,
    );
    expect(third).toEqual([]);
  });
});
