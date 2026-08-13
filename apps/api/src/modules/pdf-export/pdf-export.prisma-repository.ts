import {
  type AssembledReport,
  assembledReportSchema,
  type PdfExportJob,
  pdfExportJobSchema,
  type UserSession,
} from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { canReadReport } from "../../lib/report-read-access.js";
import {
  computePortfolioOverviewFromReadSections,
  mapPrismaToReportSection,
  reportSectionFullInclude,
} from "../report-sections/index.js";
import {
  PdfExportDomainError,
  type PdfExportJobRecord,
  type PdfExportRepository,
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

export class UnsupportedPdfExportStatusError extends Error {
  constructor(status: string) {
    super(`Unsupported PDF export database status: ${status}`);
    this.name = "UnsupportedPdfExportStatusError";
  }
}

export class PdfExportStateConflictError extends Error {
  constructor(jobId: string, status: string) {
    super(
      `PDF export job ${jobId} is already in terminal state ${status}; completion was not applied.`,
    );
    this.name = "PdfExportStateConflictError";
  }
}

interface PdfExportJobRow {
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

function toDomainStatus(status: string): PdfExportJob["status"] {
  const domainStatus = dbStatusToDomain[status];
  if (domainStatus === undefined) {
    throw new UnsupportedPdfExportStatusError(status);
  }
  return domainStatus;
}

const reportFullInclude = {
  sections: { include: reportSectionFullInclude },
  publishedBy: true,
} as const;

@Injectable()
export class PdfExportPrismaRepository implements PdfExportRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
    return canReadReport(session, reportId, this.prisma);
  }

  async createExportJob(
    job: PdfExportJob,
    requestedBy: string,
  ): Promise<PdfExportJob> {
    if (requestedBy === "") {
      throw new PdfExportDomainError(
        "PDF export job creation requires a requester.",
      );
    }
    const created = await this.prisma.pdfExportJob.create({
      data: {
        id: job.jobId,
        reportId: job.reportId,
        status: pdfStatusToDb[job.status],
        requestedBy,
        templateVersion: job.templateVersion,
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
    const { count } = await this.prisma.pdfExportJob.updateMany({
      where: { id: job.jobId, status: "pending" },
      data: {
        status: "completed",
        filePath: job.artifactUrl,
        checksum: job.checksum,
        error: null,
      },
    });

    const current = await this.readExportJobRow(job.jobId);
    if (count === 0) {
      if (isIdenticalCompletedArtifact(current, job)) {
        return toExportJob(current);
      }
      throw new PdfExportStateConflictError(job.jobId, current.status);
    }

    return toExportJob(current);
  }

  async markExportFailed(jobId: string, error: string): Promise<void> {
    await this.prisma.pdfExportJob.updateMany({
      where: { id: jobId, status: "pending" },
      data: {
        status: "failed",
        filePath: null,
        checksum: null,
        error,
      },
    });
  }

  private async readExportJobRow(jobId: string): Promise<PdfExportJobRow> {
    const row = await this.prisma.pdfExportJob.findUnique({
      where: { id: jobId },
    });

    if (!row) {
      throw new PdfExportDomainError(`PDF export job ${jobId} was not found.`);
    }

    return row;
  }
}

function isIdenticalCompletedArtifact(
  row: PdfExportJobRow,
  job: PdfExportJob,
): boolean {
  return (
    row.status === "completed" &&
    row.error === null &&
    row.filePath === job.artifactUrl &&
    row.checksum === job.checksum
  );
}

function toExportJob(row: PdfExportJobRow): PdfExportJobRecord {
  return {
    ...pdfExportJobSchema.parse({
      jobId: row.id,
      reportId: row.reportId,
      status: toDomainStatus(row.status),
      requestedAt: row.createdAt,
      completedAt: row.status === "completed" ? row.updatedAt : null,
      checksum: row.checksum,
      // The template stamped at creation round-trips; a later code release
      // must never relabel a persisted export with its own running version.
      templateVersion: row.templateVersion,
      artifactUrl: row.filePath,
    }),
    requestedBy: row.requestedBy,
  };
}

export function toAssembledReport(
  report: Prisma.ReportGetPayload<{ include: typeof reportFullInclude }>,
): AssembledReport {
  const sections = report.sections.map(mapPrismaToReportSection);
  // Top-line totals from floored trafficLight (not raw projectStatuses) so
  // cards and totals agree; re-applies the mapper's own-risk floor.
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
