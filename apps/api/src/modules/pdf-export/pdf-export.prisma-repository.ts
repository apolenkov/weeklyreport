import { Injectable } from '@nestjs/common';
import type {
  PdfExportJob,
  AssembledReport,
  ReportSectionReadModel,
  PortfolioOverview,
} from '@customreport/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { PdfExportRepository } from './pdf-export.service.js';

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

const fullReportInclude = {
  publishedBy: true,
  sections: {
    include: {
      author: true,
      projectStatuses: { include: { project: true } },
      items: true,
      risks: true,
      decisions: true,
      priorities: { orderBy: { rank: 'asc' as const } },
    },
  },
} as const;

@Injectable()
export class PdfExportPrismaRepository implements PdfExportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getPublishedReport(reportId: string): Promise<AssembledReport | null> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId, status: 'published' },
      include: fullReportInclude,
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
  return {
    jobId: row.id,
    reportId: row.reportId,
    status: dbStatusToDomain[row.status] ?? 'queued',
    requestedAt: row.createdAt,
    completedAt: row.status === 'completed' ? row.updatedAt : null,
    checksum: null,
    templateVersion: 'phase-2-pdf-v1',
    artifactUrl: row.filePath,
  };
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

/* eslint-disable @typescript-eslint/no-explicit-any */
function toSectionReadModel(section: any): ReportSectionReadModel {
  return {
    reportSectionId: section.id,
    reportId: section.reportId,
    authorId: section.authorId,
    authorName: section.author.name,
    status: section.status,
    submittedAt: section.submittedAt,
    projects: section.projectStatuses.map((ps: any) => ({
      projectId: ps.projectId,
      projectName: ps.project.name,
      trafficLight: ps.status,
    })),
    items: section.items.map((item: any) => ({
      id: item.id,
      projectId: item.projectId,
      type: item.type,
      text: item.text,
      tag: item.tag,
      workflowStatus: item.workflowStatus,
      carriedOver: item.carriedOver,
      completed: item.completed,
    })),
    risks: section.risks.map((risk: any) => ({
      id: risk.id,
      projectId: risk.projectId,
      risk: risk.risk,
      impact: risk.impact,
      mitigation: risk.mitigation,
    })),
    decisions: section.decisions.map((dec: any) => ({
      id: dec.id,
      text: dec.text,
      owner: dec.owner,
      deadline: dec.deadline,
      impact: dec.impact,
      resolvedAt: dec.resolvedAt,
    })),
    priorities: section.priorities.map((pri: any) => ({
      id: pri.id,
      rank: pri.rank,
      text: pri.text,
    })),
  };
}

function toAssembledReport(report: any): AssembledReport {
  const portfolio = computePortfolioOverview(report.sections);

  return {
    reportId: report.id,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    deadline: report.deadline,
    status: report.status,
    publishedAt: report.publishedAt,
    publishedById: report.publishedById,
    publishedByName: report.publishedBy?.name ?? null,
    portfolioOverview: portfolio,
    sections: report.sections.map(toSectionReadModel),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
