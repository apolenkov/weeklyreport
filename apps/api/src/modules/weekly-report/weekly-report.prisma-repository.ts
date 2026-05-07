import { Injectable } from '@nestjs/common';
import {
  weeklyReportReadModelSchema,
  type WeeklyReportReadModel,
  type PortfolioProductOverview,
  type Escalation,
} from '@customreport/shared';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { WeeklyReportRepository } from './weekly-report.service.js';
import {
  reportSectionFullInclude,
  mapPrismaToReportSection,
} from '../report-sections/report-sections.prisma-repository.js';

const reportFullInclude = {
  sections: { include: reportSectionFullInclude },
} as const;

@Injectable()
export class WeeklyReportPrismaRepository implements WeeklyReportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveReportId(): Promise<string | null> {
    const report = await this.prisma.report.findFirst({
      where: { periodStatus: 'open' },
      orderBy: { periodStart: 'desc' },
      select: { id: true },
    });

    return report?.id ?? null;
  }

  async getWeeklyReport(reportId: string): Promise<WeeklyReportReadModel | null> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: reportFullInclude,
    });

    if (!report) {
      return null;
    }

    const leadUsers = await this.prisma.user.findMany({
      where: { role: 'lead' },
      select: { id: true },
    });

    const projects = await this.prisma.project.findMany({
      where: { archived: false },
      include: {
        stageAssignments: true,
      },
    });

    const submissionCount = report.sections.filter(
      (s) => s.status === 'submitted',
    ).length;

    const totalLeads = leadUsers.length;
    const settings = await this.prisma.appSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton' },
      update: {},
      select: { departmentName: true },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const leadSections = (report.sections as any[]).map(mapPrismaToReportSection);

    const portfolioOverview = buildPortfolioOverview(projects, report.sections);

    const escalations = buildEscalations(report.sections, projects);

    return weeklyReportReadModelSchema.parse({
      reportId: report.id,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      periodStatus: report.periodStatus,
      weekLabel: report.weekLabel,
      departmentName: settings.departmentName,
      submissionCount,
      totalLeads,
      portfolioOverview,
      leadSections,
      escalations,
    });
  }
}

// ---------------------------------------------------------------------------
//  Portfolio overview: one entry per (non-archived) project
// ---------------------------------------------------------------------------

function buildPortfolioOverview(
  projects: Array<{
    id: string;
    name: string;
    stageAssignments: Array<{ id: string }>;
  }>,
  sections: Array<{
    // Prisma returns `status: TrafficLightStatus | null`; null statuses
    // skip the totals.
    projectStatuses: Array<{ projectId: string; status: string | null }>;
    authorId: string;
    author: { name: string };
  }>,
): PortfolioProductOverview[] {
  return projects.map((project) => {
    const statuses: string[] = [];
    const leadNameSet = new Set<string>();

    for (const section of sections) {
      for (const ps of section.projectStatuses) {
        // null status = lead hasn't filled the traffic light for this
        // project yet; skip it so the worst-of computation isn't muddied
        // by missing data.
        if (ps.projectId === project.id && ps.status !== null) {
          statuses.push(ps.status);
          leadNameSet.add(section.author.name);
        }
      }
    }

    const worstStatus = computeWorstStatus(statuses);

    return {
      productId: project.id,
      productName: project.name,
      worstStatus,
      stageCount: project.stageAssignments.length,
      leadNames: [...leadNameSet].sort((a, b) => a.localeCompare(b, 'ru')),
    };
  });
}

const statusSeverity: Record<string, number> = {
  green: 0,
  yellow: 1,
  red: 2,
};

function computeWorstStatus(
  statuses: string[],
): 'green' | 'yellow' | 'red' | null {
  if (statuses.length === 0) {
    return null;
  }

  let worst = 'green';

  for (const s of statuses) {
    if ((statusSeverity[s] ?? 0) > (statusSeverity[worst] ?? 0)) {
      worst = s;
    }
  }

  return worst as 'green' | 'yellow' | 'red';
}

// ---------------------------------------------------------------------------
//  Escalations: blocked items, at-risk (red) projects, unresolved risks
// ---------------------------------------------------------------------------

function buildEscalations(
  sections: Array<{
    authorId: string;
    author: { name: string };
    // Prisma yields `status: TrafficLightStatus | null`; null skips the row.
    projectStatuses: Array<{
      projectId: string;
      status: string | null;
      project: { id: string; name: string };
    }>;
    items: Array<{
      projectId: string;
      workflowStatus: string;
      text: string;
    }>;
    risks: Array<{
      projectId: string;
      risk: string;
    }>;
  }>,
  projects: Array<{ id: string; name: string }>,
): Escalation[] {
  const projectNameMap = new Map(projects.map((p) => [p.id, p.name]));
  const escalations: Escalation[] = [];

  for (const section of sections) {
    // Blocked items
    for (const item of section.items) {
      if (item.workflowStatus === 'blocked') {
        escalations.push({
          type: 'blocked',
          productName: projectNameMap.get(item.projectId) ?? 'Unknown',
          stageName: null,
          leadName: section.author.name,
          description: item.text,
        });
      }
    }

    // At-risk projects (red traffic light)
    for (const ps of section.projectStatuses) {
      if (ps.status === 'red') {
        escalations.push({
          type: 'at_risk',
          productName: ps.project.name,
          stageName: null,
          leadName: section.author.name,
          description: `Project ${ps.project.name} is flagged red.`,
        });
      }
    }

    // Unresolved risks
    for (const risk of section.risks) {
      escalations.push({
        type: 'unresolved_risk',
        productName: projectNameMap.get(risk.projectId) ?? 'Unknown',
        stageName: null,
        leadName: section.author.name,
        description: risk.risk,
      });
    }
  }

  return escalations;
}
