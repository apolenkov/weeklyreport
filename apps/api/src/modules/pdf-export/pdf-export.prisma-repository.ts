import {
  type AssembledReport,
  assembledReportSchema,
  type PdfExportJob,
  pdfExportJobSchema,
  type PortfolioOverview,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  mapPrismaToReportSection,
  type PrismaReportSectionWithRelations,
  reportSectionFullInclude,
} from "../report-sections/report-sections.prisma-repository.js";
import type {
  PdfExportJobRecord,
  PdfExportRepository,
} from "./pdf-export.service.js";

const pdfStatusToDb: Record<string, string> = {
  queued: "pending",
  completed: "completed",
  failed: "failed",
};

const dbStatusToDomain: Record<string, PdfExportJob["status"]> = {
  pending: "queued",
  completed: "completed",
  failed: "failed",
};

const reportFullInclude = {
  sections: { include: reportSectionFullInclude },
  publishedBy: true,
} as const;

@Injectable()
export class PdfExportPrismaRepository implements PdfExportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getPublishedReport(reportId: string): Promise<AssembledReport | null> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId, status: "published" },
      include: reportFullInclude,
    });

    if (!report) {
      return null;
    }

    return toAssembledReport(report);
  }

  async createExportJob(
    job: PdfExportJob,
    requestedBy?: string,
  ): Promise<PdfExportJob> {
    const created = await this.prisma.pdfExportJob.create({
      data: {
        id: job.jobId,
        reportId: job.reportId,
        status: (pdfStatusToDb[job.status] ?? "pending") as "pending",
        // Phase 23-01: thread session userId for audit; fall back to 'system'
        // for non-tRPC callers (workers, scripts) so the column stays NOT NULL.
        requestedBy: requestedBy ?? "system",
        filePath: job.artifactUrl,
        error: null,
      },
    });

    return toExportJob(created);
  }

  async getExportJob(jobId: string): Promise<PdfExportJobRecord | null> {
    const job = await this.prisma.pdfExportJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return null;
    }

    return toExportJob(job);
  }

  async saveExportJob(job: PdfExportJob): Promise<PdfExportJob> {
    const updated = await this.prisma.pdfExportJob.update({
      where: { id: job.jobId },
      data: {
        status: (pdfStatusToDb[job.status] ?? "pending") as "pending",
        filePath: job.artifactUrl,
        error: null,
      },
    });

    return toExportJob(updated);
  }

  /** Called by BullMQ onFailed event handler to mark a PDF export job as failed. */
  async markExportFailed(jobId: string, error: string): Promise<void> {
    await this.prisma.pdfExportJob.update({
      where: { id: jobId },
      data: { status: "failed", error },
    });
  }
}

function toExportJob(row: {
  id: string;
  reportId: string;
  status: string;
  filePath: string | null;
  error: string | null;
  requestedBy: string;
  createdAt: Date;
  updatedAt: Date;
}): PdfExportJobRecord {
  return {
    ...pdfExportJobSchema.parse({
      jobId: row.id,
      reportId: row.reportId,
      status: dbStatusToDomain[row.status] ?? "queued",
      requestedAt: row.createdAt,
      completedAt: row.status === "completed" ? row.updatedAt : null,
      checksum: null,
      templateVersion: "phase-2-pdf-v1",
      artifactUrl: row.filePath,
    }),
    requestedBy: row.requestedBy,
  };
}

function computePortfolioOverview(
  sections: { projectStatuses: { status: string | null }[] }[],
): PortfolioOverview {
  const totals = { green: 0, yellow: 0, red: 0 };

  for (const section of sections) {
    for (const ps of section.projectStatuses) {
      if (ps.status === null) {
        continue;
      }
      const status = ps.status as keyof typeof totals;

      if (status in totals) {
        totals[status]++;
      }
    }
  }

  const overallStatus: PortfolioOverview["status"] =
    totals.red > 0 ? "red" : totals.yellow > 0 ? "yellow" : "green";

  return { status: overallStatus, totals };
}

function toAssembledReport(
  report: Prisma.ReportGetPayload<{ include: typeof reportFullInclude }>,
): AssembledReport {
  const portfolio = computePortfolioOverview(report.sections);
  const sections = report.sections.map((section) =>
    mapPrismaToReportSection(
      section as unknown as PrismaReportSectionWithRelations,
    ),
  );

  return assembledReportSchema.parse({
    reportId: report.id,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    deadline: report.deadline,
    status: report.status,
    publishedAt: report.publishedAt,
    publishedById: report.publishedById,
    publishedByName: report.publishedBy?.name ?? null,
    portfolioOverview: portfolio,
    sections,
  });
}
