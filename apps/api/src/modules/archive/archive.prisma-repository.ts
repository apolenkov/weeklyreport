import { Injectable } from '@nestjs/common';
import {
  archiveReportSummarySchema,
  archiveReportDetailSchema,
  assembledReportSchema,
  type ArchiveReportSummary,
  type ArchiveReportDetail,
  type AssembledReport,
  type PortfolioOverview,
} from '@customreport/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { ArchiveRepository } from './archive.service.js';
import {
  reportSectionFullInclude,
  mapPrismaToReportSection,
} from '../report-sections/report-sections.prisma-repository.js';

const reportFullInclude = {
  sections: { include: reportSectionFullInclude },
  publishedBy: true,
} as const;

@Injectable()
export class ArchivePrismaRepository implements ArchiveRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listArchiveReports(): Promise<ArchiveReportSummary[]> {
    const reports = await this.prisma.report.findMany({
      where: { status: 'published' },
      include: {
        publishedBy: true,
        sections: {
          include: {
            projectStatuses: true,
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });

    return reports.map((report) => toArchiveSummary(report));
  }

  async getArchiveReport(reportId: string): Promise<ArchiveReportDetail | null> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId, status: 'published' },
      include: reportFullInclude,
    });

    if (!report) {
      return null;
    }

    const assembled = toAssembledReport(report);
    const summary = toArchiveSummary(report);

    return archiveReportDetailSchema.parse({ summary, report: assembled });
  }
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

function toArchiveSummary(report: {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  publishedAt: Date | null;
  publishedBy: { name: string } | null;
  sections: Array<{ projectStatuses: Array<{ status: string }> }>;
}): ArchiveReportSummary {
  const portfolio = computePortfolioOverview(report.sections);

  return archiveReportSummarySchema.parse({
    reportId: report.id,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    publishedAt: report.publishedAt!,
    publishedByName: report.publishedBy?.name ?? 'Unknown',
    portfolioStatus: portfolio.status,
  });
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
