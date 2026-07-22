import {
  type AssembledReport,
  assembledReportSchema,
  type PdfExportJob,
  pdfExportJobSchema,
  type UserSession,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter } from "../../lib/group-scope.js";
import { computePortfolioOverviewFromReadSections } from "../published-report-snapshot.js";
import {
  mapPrismaToReportSection,
  reportSectionFullInclude,
} from "../report-sections/index.js";
import type {
  PdfExportJobRecord,
  PdfExportRepository,
} from "./pdf-export.service.js";

const pdfStatusToDb: Record<
  PdfExportJob["status"],
  "pending" | "completed" | "failed"
> = {
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
      where: {
        id: reportId,
        status: "published",
        periodStatus: "published",
      },
      include: reportFullInclude,
    });

    if (!report) {
      return null;
    }

    return toAssembledReport(report);
  }

  async canReadReport(
    session: UserSession,
    reportId: string,
  ): Promise<boolean> {
    if (session.role === "admin") {
      const report = await this.prisma.report.findUnique({
        where: { id: reportId },
        select: { id: true },
      });
      return report !== null;
    }

    const report = await this.prisma.report.findFirst({
      where: {
        id: reportId,
        sections: { some: groupScopeFilter(session, "reportSection") },
      },
      select: { id: true },
    });
    return report !== null;
  }

  async createExportJob(
    job: PdfExportJob,
    requestedBy?: string,
  ): Promise<PdfExportJob> {
    const created = await this.prisma.pdfExportJob.create({
      data: {
        id: job.jobId,
        reportId: job.reportId,
        status: pdfStatusToDb[job.status],
        // Thread session userId for audit; fall back to 'system' for non-tRPC
        // callers (workers, scripts) so the column stays NOT NULL.
        requestedBy: requestedBy ?? "system",
        filePath: job.artifactUrl,
        checksum: job.checksum,
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
        status: pdfStatusToDb[job.status],
        filePath: job.artifactUrl,
        checksum: job.checksum,
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
  checksum: string | null;
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
      checksum: row.checksum,
      templateVersion: "phase-2-pdf-v1",
      artifactUrl: row.filePath,
    }),
    requestedBy: row.requestedBy,
  };
}

export function toAssembledReport(
  report: Prisma.ReportGetPayload<{ include: typeof reportFullInclude }>,
): AssembledReport {
  const sections = report.sections.map((section) =>
    mapPrismaToReportSection(section),
  );
  // Compute the PDF top-line totals from the floored `trafficLight` of the
  // mapped sections, NOT from raw `projectStatuses`, so the per-product cards
  // and the top-line totals agree inside the same PDF.
  // `computePortfolioOverviewFromReadSections` re-applies the same own-risk
  // floor the mapper baked into each card.
  const portfolio = computePortfolioOverviewFromReadSections(sections);

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
