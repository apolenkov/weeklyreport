import {
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { ReportSectionsRepository } from "./report-sections.service";

/**
 * Shared Prisma include constant for the full ReportSection aggregate.
 * Loads 5 nested relations: author, projectStatuses+project, items, risks, decisions.
 *
 * 35-03/04: also loads `author.role` (so the read model can carry
 * `authorRole`) and the project's stage assignments scoped to the
 * section author (so each project's `ownedStages[]` can be derived
 * without a second round-trip).
 *
 * fix-lead-surface-name-resolution: items/risks/decisions also ride their
 * `project.name` so the read model can emit name-only `referencedProjects`
 * for rows referencing a project the author owns no stage on — without a
 * second query and without widening `projects` (which drives product
 * cards, ProjectStatus writes, and submit validation).
 */
export const reportSectionFullInclude = {
  author: {
    select: {
      name: true,
      role: true,
      id: true,
      stageAssignments: {
        include: {
          project: true,
          stage: true,
        },
      },
    },
  },
  projectStatuses: {
    include: {
      project: true,
    },
  },
  stageStatuses: {
    include: { stage: true },
  },
  items: { include: { project: { select: { name: true } } } },
  risks: { include: { project: { select: { name: true } } } },
  decisions: { include: { project: { select: { name: true } } } },
} as const;

export type PrismaReportSectionWithRelations = NonNullable<
  Awaited<ReturnType<PrismaService["reportSection"]["findUnique"]>>
> & {
  authorId: string;
  // UFB-049 / Phase 50-B: late column surfaced explicitly so the
  // mapPrismaToReportSection type narrows without an `unknown` cast.
  late: boolean;
  author: {
    name: string;
    role: string;
    id: string;
    stageAssignments: {
      userId: string;
      stageId: string;
      projectId: string;
      project: { id: string; name: string; archived: boolean };
      stage: { id: string; name: string; sortOrder: number };
    }[];
  };
  projectStatuses: {
    projectId: string;
    status: string;
    project: { id: string; name: string; archived: boolean };
  }[];
  stageStatuses: {
    projectId: string;
    stageId: string;
    status: string | null;
    stage: { id: string; name: string; sortOrder: number };
  }[];
  items: {
    id: string;
    projectId: string;
    type: string;
    text: string;
    tag: string;
    workflowStatus: string;
    carriedOver: boolean;
    completed: boolean | null;
    priorityRank: number | null;
    stageNames: string[];
    // fix-lead-surface-name-resolution: ridden along by
    // `reportSectionFullInclude`; optional so legacy fixtures that
    // pre-date the include widening still map (name then unresolvable).
    project?: { name: string };
  }[];
  risks: {
    id: string;
    projectId: string;
    risk: string;
    impact: string;
    mitigation: string;
    severity: string;
    stageNames: string[];
    project?: { name: string };
  }[];
  decisions: {
    id: string;
    text: string;
    owner: string;
    deadline: Date | null;
    impact: string;
    resolvedAt: Date | null;
    stageNames: string[];
    productId: string | null;
    project?: { name: string };
  }[];
};

function aggregateStageTraffic(
  stages: { status?: string | null }[],
): string | null {
  let severity = 0;
  for (const stage of stages) {
    if (stage.status === "red") {
      severity = 3;
      break;
    }
    if (stage.status === "yellow") severity = Math.max(severity, 2);
    if (stage.status === "green") severity = Math.max(severity, 1);
  }
  return severity === 3
    ? "red"
    : severity === 2
      ? "yellow"
      : severity === 1
        ? "green"
        : null;
}

/**
 * Maps a Prisma ReportSection with all relations to the domain ReportSectionReadModel.
 * Field names are mapped from Prisma conventions to Zod schema conventions (REPO-09).
 */
export function mapPrismaToReportSection(
  row: PrismaReportSectionWithRelations,
): ReportSectionReadModel {
  const projectStatusByProjectId = new Map(
    row.projectStatuses.map((ps) => [ps.projectId, ps.status] as const),
  );
  const stageStatusByKey = new Map(
    row.stageStatuses.map(
      (ss) => [`${ss.projectId}::${ss.stageId}`, ss.status] as const,
    ),
  );
  const assignmentsByProjectId = new Map<
    string,
    {
      project: { id: string; name: string; archived: boolean };
      assignments: typeof row.author.stageAssignments;
    }
  >();

  for (const assignment of row.author.stageAssignments) {
    if (assignment.project.archived) continue;
    const current = assignmentsByProjectId.get(assignment.projectId);
    if (current) {
      current.assignments.push(assignment);
    } else {
      assignmentsByProjectId.set(assignment.projectId, {
        project: assignment.project,
        assignments: [assignment],
      });
    }
  }

  // fix-lead-surface-name-resolution: name-only entries for projects that
  // items/risks/decisions reference but the author owns no stage on, so
  // the lead-surface mappers can resolve the real product name instead of
  // "Unknown"/"Group". Names ride the row's `project` relation (no extra
  // query). Stage-owned projects are excluded — they already carry their
  // name in `projects` and win on conflict (design Decision 3). Archived
  // referenced projects resolve too (design Open Question 2): the name is
  // not secret and a placeholder would misread as data loss.
  const referencedNamesById = new Map<string, string>();
  const referencedRows = [
    ...row.items.map((i) => ({ projectId: i.projectId, project: i.project })),
    ...row.risks.map((r) => ({ projectId: r.projectId, project: r.project })),
    ...row.decisions.map((d) => ({
      projectId: d.productId,
      project: d.project,
    })),
  ];
  for (const { projectId, project } of referencedRows) {
    if (!projectId || !project?.name) continue;
    if (assignmentsByProjectId.has(projectId)) continue;
    referencedNamesById.set(projectId, project.name);
  }
  const referencedProjects = [...referencedNamesById.entries()]
    .map(([projectId, projectName]) => ({ projectId, projectName }))
    .sort((a, b) => a.projectName.localeCompare(b.projectName, "ru"));

  return reportSectionReadModelSchema.parse({
    reportSectionId: row.id,
    reportId: row.reportId,
    authorId: row.authorId,
    authorName: row.author.name,
    // 35-03: surface the section author's system role end-to-end so the
    // /lead/report chrome can switch between Request Reopen (lead) and
    // Revoke (head/admin viewing this lead's section).
    authorRole: row.author.role,
    status: row.status,
    submittedAt: row.submittedAt,
    // UFB-049 / Phase 50-B: late flag stamped by submitSection when
    // `now > Report.deadline` at submit-time. Coerced to false when
    // Prisma row predates the migration (defensive — the column default
    // means this should never fire in practice).
    late: (row as { late?: boolean }).late ?? false,
    projects: [...assignmentsByProjectId.values()]
      .map(({ project, assignments }) => {
        const ownedStages = assignments
          .map((sa) => ({
            stageId: sa.stageId,
            stageName: sa.stage.name,
            sortOrder: sa.stage.sortOrder,
            status:
              stageStatusByKey.get(`${project.id}::${sa.stageId}`) ?? null,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder);

        return {
          projectId: project.id,
          projectName: project.name,
          trafficLight:
            aggregateStageTraffic(ownedStages) ??
            projectStatusByProjectId.get(project.id) ??
            null,
          ownedStages,
        };
      })
      .sort((a, b) => a.projectName.localeCompare(b.projectName, "ru")),
    referencedProjects,
    items: row.items.map((i) => ({
      id: i.id,
      projectId: i.projectId,
      type: i.type,
      text: i.text,
      tag: i.tag,
      workflowStatus: i.workflowStatus,
      carriedOver: i.carriedOver,
      completed: i.completed,
      priorityRank: i.priorityRank ?? null,
      stageIds: i.stageNames.length > 0 ? i.stageNames : undefined,
    })),
    risks: row.risks.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      risk: r.risk,
      impact: r.impact,
      mitigation: r.mitigation,
      severity: r.severity === "blocked" ? "blocked" : "at-risk",
      stageIds: r.stageNames.length > 0 ? r.stageNames : undefined,
    })),
    decisions: row.decisions.map((d) => ({
      id: d.id,
      text: d.text,
      owner: d.owner,
      deadline: d.deadline,
      impact: d.impact,
      resolvedAt: d.resolvedAt,
      stageIds: d.stageNames.length > 0 ? d.stageNames : undefined,
      productId: d.productId ?? undefined,
    })),
  });
}

@Injectable()
export class ReportSectionsPrismaRepository
  implements ReportSectionsRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async getReportStatus(reportId: string): Promise<string | null> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { status: true },
    });

    return report?.status ?? null;
  }

  /**
   * UFB-049 / Phase 50-B: deadline-aware report lookup used by the
   * submitSection grace-period gate. Returns null when the report does
   * not exist so the service can no-op the gate without ad-hoc
   * try/catch.
   */
  async getReportMeta(
    reportId: string,
  ): Promise<{ status: string; deadline: Date } | null> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { status: true, deadline: true },
    });

    return report ?? null;
  }

  async getSectionById(
    reportSectionId: string,
  ): Promise<ReportSectionReadModel | null> {
    const row = await this.prisma.reportSection.findUnique({
      where: { id: reportSectionId },
      include: reportSectionFullInclude,
    });

    if (!row) {
      return null;
    }

    return mapPrismaToReportSection(
      row as unknown as PrismaReportSectionWithRelations,
    );
  }

  async saveSection(
    section: ReportSectionReadModel,
  ): Promise<ReportSectionReadModel> {
    const sectionId = section.reportSectionId;

    await this.prisma.$transaction(
      async (tx) => {
        await tx.reportSection.update({
          where: { id: sectionId },
          data: {
            status: section.status,
            submittedAt: section.submittedAt,
            // UFB-049 / Phase 50-B: persist the late flag computed by
            // ReportSectionsService.submitSection. Default of false in
            // the schema means existing call sites that don't set it
            // (e.g. saveDraft, reopen) leave the column unchanged via
            // the prior value flowing through mergeSection.
            late: section.late,
          },
        });

        await tx.projectStatus.deleteMany({
          where: { reportSectionId: sectionId },
        });
        await tx.stageStatus.deleteMany({
          where: { reportSectionId: sectionId },
        });
        await tx.item.deleteMany({ where: { reportSectionId: sectionId } });
        await tx.risk.deleteMany({ where: { reportSectionId: sectionId } });
        await tx.decision.deleteMany({ where: { reportSectionId: sectionId } });

        const projectData = section.projects.map((p) => ({
          reportSectionId: sectionId,
          projectId: p.projectId,
          status: p.trafficLight,
        }));

        if (projectData.length > 0) {
          await tx.projectStatus.createMany({ data: projectData });
        }

        const stageStatusData = section.projects.flatMap((project) =>
          (project.ownedStages ?? []).map((stage) => ({
            reportSectionId: sectionId,
            projectId: project.projectId,
            stageId: stage.stageId,
            status: stage.status ?? null,
          })),
        );

        if (stageStatusData.length > 0) {
          await tx.stageStatus.createMany({ data: stageStatusData });
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
              priorityRank: i.priorityRank ?? null,
              stageNames: i.stageIds ?? [],
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
              severity: r.severity ?? "at-risk",
              stageNames: r.stageIds ?? [],
            })),
          });
        }

        const decisionsToSave = section.decisions.filter(
          (d): d is typeof d & { productId: string } => Boolean(d.productId),
        );
        if (decisionsToSave.length > 0) {
          await tx.decision.createMany({
            data: decisionsToSave.map((d) => ({
              ...(d.id ? { id: d.id } : {}),
              reportSectionId: sectionId,
              text: d.text,
              owner: d.owner,
              deadline: d.deadline ?? null,
              impact: d.impact,
              resolvedAt: d.resolvedAt ?? null,
              stageNames: d.stageIds ?? [],
              productId: d.productId,
            })),
          });
        }
      },
      { timeout: 15_000 },
    );

    const saved = await this.prisma.reportSection.findUnique({
      where: { id: sectionId },
      include: reportSectionFullInclude,
    });

    return mapPrismaToReportSection(
      saved as unknown as PrismaReportSectionWithRelations,
    );
  }
}
