import { Injectable } from '@nestjs/common';
import {
  pdfExportJobSchema,
  assembledReportSchema,
  type PdfExportJob,
  type AssembledReport,
  type PortfolioOverview,
} from '@customreport/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { PdfExportRepository } from './pdf-export.service.js';
import {
  reportSectionFullInclude,
  mapPrismaToReportSection,
} from '../report-sections/report-sections.prisma-repository.js';

const pdfStatusToDb: Record<string, string> = {
  queued: 'pending',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed',
};

const dbStatusToDomain: Record<string, PdfExportJob['status']> = {
  pending: 'queued',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed',
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
      where: { id: reportId, status: 'published' },
      include: reportFullInclude,
    });

    if (!report) {
      return null;
    }

    return toAssembledReport(report);
  }

  async createExportJob(job: PdfExportJob): Promise<PdfExportJob> {
    const created = await this.prisma.pdfExportJob.create({
      data: {
        id: job.jobId,
        reportId: job.reportId,
        status: (pdfStatusToDb[job.status] ?? 'pending') as 'pending',
        requestedBy: 'system',
        filePath: job.artifactUrl,
        error: null,
      },
    });

    return toExportJob(created);
  }

  async getExportJob(jobId: string): Promise<PdfExportJob | null> {
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
        status: (pdfStatusToDb[job.status] ?? 'pending') as 'pending',
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
      data: { status: 'failed', error },
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
}): PdfExportJob {
  return pdfExportJobSchema.parse({
    jobId: row.id,
    reportId: row.reportId,
    status: dbStatusToDomain[row.status] ?? 'queued',
    requestedAt: row.createdAt,
    completedAt: row.status === 'completed' ? row.updatedAt : null,
    checksum: null,
    templateVersion: 'phase-2-pdf-v1',
    artifactUrl: row.filePath,
  });
}

function computePortfolioOverview(
  sections: Array<{ projectStatuses: Array<{ status: string }> }>,
): PortfolioOverview {
  const totals = { green: 0, yellow: 0, red: 0 };

  for (const section of sections) {
    for (const ps of section.projectStatuses) {
      const status = ps.status as keyof typeof totals;

      if (status in totals) {
        totals[status]++;
      }
    }
  }

  const overallStatus: PortfolioOverview['status'] =
    totals.red > 0 ? 'red' : totals.yellow > 0 ? 'yellow' : 'green';

  return { status: overallStatus, totals };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAssembledReport(report: any): AssembledReport {
  const portfolio = computePortfolioOverview(report.sections);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sections = (report.sections as any[]).map(mapPrismaToReportSection);

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
