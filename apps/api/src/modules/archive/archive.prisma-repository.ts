import { Injectable } from '@nestjs/common';
import type {
  ArchiveReportSummary,
  ArchiveReportDetail,
  AssembledReport,
  ReportSectionReadModel,
  PortfolioOverview,
} from '@customreport/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { ArchiveRepository } from './archive.service.js';

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
      include: fullReportInclude,
    });

    if (!report) {
      return null;
    }

    const assembled = toAssembledReport(report);
    const summary = toArchiveSummary(report);

    return { summary, report: assembled };
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

  return {
    reportId: report.id,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    publishedAt: report.publishedAt!,
    publishedByName: report.publishedBy?.name ?? 'Unknown',
    portfolioStatus: portfolio.status,
  };
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
