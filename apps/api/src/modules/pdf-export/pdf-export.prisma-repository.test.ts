import {
  type PdfExportJob,
  publishedReportSnapshotSchema,
  type UserSession,
} from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  PdfExportPrismaRepository,
  PdfExportStateConflictError,
  UnsupportedPdfExportStatusError,
} from "./pdf-export.prisma-repository";
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
