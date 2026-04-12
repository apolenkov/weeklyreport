import { Injectable } from '@nestjs/common';
import {
  reportSectionReadModelSchema,
  type ReportSectionReadModel,
} from '@customreport/shared';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { ReportSectionsRepository } from './report-sections.service';

/**
 * Shared Prisma include constant for the full ReportSection aggregate.
 * Loads all 6 nested relations: author, projectStatuses+project, items, risks, decisions, priorities.
 */
export const reportSectionFullInclude = {
  author: true,
  projectStatuses: { include: { project: true } },
  items: true,
  risks: true,
  decisions: true,
  priorities: { orderBy: { rank: 'asc' as const } },
} as const;

type PrismaReportSectionWithRelations = NonNullable<
  Awaited<ReturnType<PrismaService['reportSection']['findUnique']>>
> & {
  author: { name: string };
  projectStatuses: Array<{
    projectId: string;
    status: string;
    project: { id: string; name: string };
  }>;
  items: Array<{
    id: string;
    projectId: string;
    type: string;
    text: string;
    tag: string;
    workflowStatus: string;
    carriedOver: boolean;
    completed: boolean | null;
  }>;
  risks: Array<{
    id: string;
    projectId: string;
    risk: string;
    impact: string;
    mitigation: string;
  }>;
  decisions: Array<{
    id: string;
    text: string;
    owner: string;
    deadline: Date | null;
    impact: string;
    resolvedAt: Date | null;
  }>;
  priorities: Array<{
    id: string;
    rank: number;
    text: string;
  }>;
};

/**
 * Maps a Prisma ReportSection with all relations to the domain ReportSectionReadModel.
 * Field names are mapped from Prisma conventions to Zod schema conventions (REPO-09).
 */
export function mapPrismaToReportSection(
  row: PrismaReportSectionWithRelations,
): ReportSectionReadModel {
  return reportSectionReadModelSchema.parse({
    reportSectionId: row.id,
    reportId: row.reportId,
    authorId: row.authorId,
    authorName: row.author.name,
    status: row.status,
    submittedAt: row.submittedAt,
    projects: row.projectStatuses.map((ps) => ({
      projectId: ps.projectId,
      projectName: ps.project.name,
      trafficLight: ps.status,
    })),
    items: row.items.map((i) => ({
      id: i.id,
      projectId: i.projectId,
      type: i.type,
      text: i.text,
      tag: i.tag,
      workflowStatus: i.workflowStatus,
      carriedOver: i.carriedOver,
      completed: i.completed,
    })),
    risks: row.risks.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      risk: r.risk,
      impact: r.impact,
      mitigation: r.mitigation,
    })),
    decisions: row.decisions.map((d) => ({
      id: d.id,
      text: d.text,
      owner: d.owner,
      deadline: d.deadline,
      impact: d.impact,
      resolvedAt: d.resolvedAt,
    })),
    priorities: row.priorities.map((p) => ({
      id: p.id,
      rank: p.rank,
      text: p.text,
    })),
  });
}

@Injectable()
export class ReportSectionsPrismaRepository implements ReportSectionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getReportStatus(reportId: string): Promise<string | null> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { status: true },
    });

    return report?.status ?? null;
  }

  async getSectionById(reportSectionId: string): Promise<ReportSectionReadModel | null> {
    const row = await this.prisma.reportSection.findUnique({
      where: { id: reportSectionId },
      include: reportSectionFullInclude,
    });

    if (!row) {
      return null;
    }

    return mapPrismaToReportSection(row as unknown as PrismaReportSectionWithRelations);
  }

  async saveSection(section: ReportSectionReadModel): Promise<ReportSectionReadModel> {
    const sectionId = section.reportSectionId;

    await this.prisma.$transaction(
      async (tx) => {
        await tx.reportSection.update({
          where: { id: sectionId },
          data: {
            status: section.status,
            submittedAt: section.submittedAt,
          },
        });

        await tx.projectStatus.deleteMany({ where: { reportSectionId: sectionId } });
        await tx.item.deleteMany({ where: { reportSectionId: sectionId } });
        await tx.risk.deleteMany({ where: { reportSectionId: sectionId } });
        await tx.decision.deleteMany({ where: { reportSectionId: sectionId } });
        await tx.priority.deleteMany({ where: { reportSectionId: sectionId } });

        const projectData = section.projects
          .filter((p) => p.trafficLight !== null)
          .map((p) => ({
            reportSectionId: sectionId,
            projectId: p.projectId,
            status: p.trafficLight!,
          }));

        if (projectData.length > 0) {
          await tx.projectStatus.createMany({ data: projectData });
        }

        if (section.items.length > 0) {
          await tx.item.createMany({
            data: section.items.map((i) => ({
              ...(i.id ? { id: i.id } : {}),
              reportSectionId: sectionId,
              projectId: i.projectId,
              type: i.type,
              text: i.text,
              tag: i.tag,
              workflowStatus: i.workflowStatus,
              carriedOver: i.carriedOver,
              completed: i.completed ?? null,
            })),
          });
        }

        if (section.risks.length > 0) {
          await tx.risk.createMany({
            data: section.risks.map((r) => ({
              ...(r.id ? { id: r.id } : {}),
              reportSectionId: sectionId,
              projectId: r.projectId,
              risk: r.risk,
              impact: r.impact,
              mitigation: r.mitigation,
            })),
          });
        }

        if (section.decisions.length > 0) {
          await tx.decision.createMany({
            data: section.decisions.map((d) => ({
              ...(d.id ? { id: d.id } : {}),
              reportSectionId: sectionId,
              text: d.text,
              owner: d.owner,
              deadline: d.deadline ?? null,
              impact: d.impact,
              resolvedAt: d.resolvedAt ?? null,
            })),
          });
        }

        if (section.priorities.length > 0) {
          await tx.priority.createMany({
            data: section.priorities.map((p) => ({
              ...(p.id ? { id: p.id } : {}),
              reportSectionId: sectionId,
              rank: p.rank,
              text: p.text,
            })),
          });
        }
      },
      { timeout: 15000 },
    );

    const saved = await this.prisma.reportSection.findUnique({
      where: { id: sectionId },
      include: reportSectionFullInclude,
    });

    return mapPrismaToReportSection(saved as unknown as PrismaReportSectionWithRelations);
  }
}
