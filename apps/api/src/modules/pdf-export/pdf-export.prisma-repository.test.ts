// PDF top-line totals must count floored trafficLight (not raw projectStatuses)
// so cards and totals agree inside the same document.
import type { PdfExportJob } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  PdfExportPrismaRepository,
  PdfExportStateConflictError,
  toAssembledReport,
  UnsupportedPdfExportStatusError,
} from "./pdf-export.prisma-repository";
import { PdfExportDomainError } from "./pdf-export.service";

const REPORT_ID = "659b2767-0f86-41e2-b025-49730ca010e4";
const SECTION_ID = "2a223d8b-c4b2-473c-8a7b-15ecc52195c7";
const AUTHOR_ID = "6f99661a-cac6-4d06-bf08-2a14cced554d";
const OWNER_GROUP_ID = "e0000000-0000-4000-a000-000000000001";
const OWNED_PRODUCT = "4ff69d14-ec8c-4f1c-b62b-73bee530fc7d";
const OWNED_STAGE_ID = "6366e7ef-e694-454f-863a-7e112ebbc48f";
const RISK_ID = "e421b0e4-caac-4218-9f40-d062f523b86b";
const STAGE_NAME = "Development";
const EXPORT_JOB_ID = "759b2767-0f86-41e2-b025-49730ca010e4";
const EXPORT_CREATED_AT = new Date("2026-06-09T00:00:00Z");
const EXPORT_ARTIFACT_URL = `/pdfs/${EXPORT_JOB_ID}.pdf`;

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

function reportRow(severity: "blocked" | "at-risk") {
  return {
    id: REPORT_ID,
    periodStart: new Date("2026-06-01T00:00:00Z"),
    periodEnd: new Date("2026-06-07T00:00:00Z"),
    deadline: new Date("2026-06-08T00:00:00Z"),
    status: "published",
    publishedAt: new Date("2026-06-09T00:00:00Z"),
    publishedById: AUTHOR_ID,
    publishedBy: { name: "Head" },
    sections: [
      {
        id: SECTION_ID,
        reportId: REPORT_ID,
        authorId: AUTHOR_ID,
        status: "submitted",
        submittedAt: null,
        late: false,
        version: 1,
        author: {
          name: "Alice Lead",
          role: "lead",
          id: AUTHOR_ID,
          stageAssignments: [
            {
              userId: AUTHOR_ID,
              stageId: OWNED_STAGE_ID,
              projectId: OWNED_PRODUCT,
              project: {
                id: OWNED_PRODUCT,
                name: "CRM Portal",
                archived: false,
                stageAssignments: [],
                groupProducts: [{ groupId: OWNER_GROUP_ID }],
                lead: { reportingGroupId: null },
              },
              stage: { id: OWNED_STAGE_ID, name: STAGE_NAME, sortOrder: 4 },
            },
          ],
        },
        // Stale green ProjectStatus, no StageStatus row (the owned stage has no
        // submitted status), one covers-all own risk.
        projectStatuses: [
          {
            projectId: OWNED_PRODUCT,
            status: "green",
            project: { id: OWNED_PRODUCT, name: "CRM Portal", archived: false },
          },
        ],
        stageStatuses: [],
        items: [],
        risks: [
          {
            id: RISK_ID,
            projectId: OWNED_PRODUCT,
            risk: "Vendor outage",
            impact: "High",
            mitigation: "Failover",
            severity,
            stageNames: [STAGE_NAME],
            project: { name: "CRM Portal" },
            recordComments: [],
          },
        ],
        decisions: [],
        activityStatuses: [],
        sectionReviews: [],
      },
    ],
  };
}

describe("toAssembledReport — PDF portfolio totals floor", () => {
  it("counts the product red (not green) for a covers-all blocked own risk", () => {
    const report = toAssembledReport(
      reportRow("blocked") as unknown as Parameters<
        typeof toAssembledReport
      >[0],
    );

    expect(report.portfolioOverview.status).toBe("red");
    expect(report.portfolioOverview.totals).toMatchObject({ red: 1, green: 0 });
  });

  it("counts the product yellow for a covers-all at-risk own risk", () => {
    const report = toAssembledReport(
      reportRow("at-risk") as unknown as Parameters<
        typeof toAssembledReport
      >[0],
    );

    expect(report.portfolioOverview.status).toBe("yellow");
    expect(report.portfolioOverview.totals).toMatchObject({
      yellow: 1,
      green: 0,
    });
  });
});

describe("PdfExportPrismaRepository published floor", () => {
  it("returns null when the report is not currently published", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const prisma = { report: { findUnique } } as unknown as PrismaService;
    const repo = new PdfExportPrismaRepository(prisma);

    await expect(repo.getPublishedReport(REPORT_ID)).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: REPORT_ID,
          status: "published",
          periodStatus: "published",
        },
      }),
    );
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
