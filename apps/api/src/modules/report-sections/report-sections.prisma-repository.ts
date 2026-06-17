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

type TrafficLight = "green" | "yellow" | "red";

const TRAFFIC_SEVERITY: Record<TrafficLight, number> = {
  green: 0,
  yellow: 1,
  red: 2,
};

/**
 * fix-published-empty-stage-risk-floor (D5 option a): the API restatement of
 * the `riskCoversStage` covers-all rule. The web helper
 * (`apps/web/src/components/lead/stage-tags.ts`) lives behind the app boundary
 * and carries a `"use client"` React import, so it cannot be imported here.
 *
 * `stageIds` is a misnomer — it holds stage NAMES, not UUIDs. An empty/absent
 * array means "covers every stage the author owns on this product"; a populated
 * array covers only the named stages.
 */
function riskCoversStageName(
  risk: { stageIds?: readonly string[] },
  stageName: string,
): boolean {
  if (!risk.stageIds || risk.stageIds.length === 0) return true;
  return risk.stageIds.includes(stageName);
}

function severityToTraffic(severity: string | undefined): TrafficLight | null {
  if (severity === "blocked") return "red";
  if (severity === "at-risk") return "yellow";
  return null;
}

function asTraffic(status: string | null | undefined): TrafficLight | null {
  return status === "green" || status === "yellow" || status === "red"
    ? status
    : null;
}

function worseTraffic(
  a: TrafficLight | null,
  b: TrafficLight | null,
): TrafficLight | null {
  if (a === null) return b;
  if (b === null) return a;
  return TRAFFIC_SEVERITY[a] >= TRAFFIC_SEVERITY[b] ? a : b;
}

/**
 * fix-published-empty-stage-risk-floor: derives the risk-aware effective
 * product status at the READ layer. For each owned stage, the effective status
 * is the worse of the raw stage status and the highest-severity own risk that
 * covers it. The product status is the worst across owned stages, floored
 * against the raw `trafficLight` so the floor never lowers (a real red
 * ProjectStatus survives a milder risk) and double-application stays
 * idempotent.
 *
 * CRITICAL: risks MUST be scoped to the product (`risk.projectId === projectId`)
 * BEFORE the per-stage match. `riskCoversStageName` matches stage NAME only and
 * the 7 SDLC stage names are shared across every product, so an unscoped fold
 * would floor the wrong product (and a covers-all risk every product). This
 * mirrors the `buildStageGrid` call site, which pre-filters by `projectId`.
 *
 * Per D4 this is aggregation-only: it never writes back to the raw persisted
 * `StageStatus.status` nor to the read-model per-stage `status` field. A product
 * with no owned stages contributes nothing to floor (covers-all means "all
 * stages the author owns on THIS product"), so the raw `trafficLight` passes
 * through unchanged.
 */
export function deriveEffectiveProductStatus(project: {
  projectId: string;
  trafficLight: TrafficLight | null;
  ownedStages?: readonly {
    stageName: string;
    status?: string | null;
  }[];
  risks?: readonly {
    projectId: string;
    severity?: string;
    stageIds?: readonly string[];
  }[];
}): TrafficLight | null {
  const scopedRisks = (project.risks ?? []).filter(
    (risk) => risk.projectId === project.projectId,
  );

  let effective = project.trafficLight;
  for (const stage of project.ownedStages ?? []) {
    const coveringSeverity = scopedRisks
      .filter((risk) => riskCoversStageName(risk, stage.stageName))
      .reduce<TrafficLight | null>(
        (acc, risk) => worseTraffic(acc, severityToTraffic(risk.severity)),
        null,
      );
    const stageEffective = worseTraffic(
      asTraffic(stage.status),
      coveringSeverity,
    );
    effective = worseTraffic(effective, stageEffective);
  }
  return effective;
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

        const rawTrafficLight =
          aggregateStageTraffic(ownedStages) ??
          projectStatusByProjectId.get(project.id) ??
          null;

        return {
          projectId: project.id,
          projectName: project.name,
          // fix-published-empty-stage-risk-floor: floor the product status by
          // the author's own covering risks (scoped to this product) so an
          // owned stage with no submitted status covered by a blocked/at-risk
          // risk reads red/yellow. Raw `ownedStages[].status` is left untouched
          // (D4); only this derived product-level status is floored.
          trafficLight: deriveEffectiveProductStatus({
            projectId: project.id,
            trafficLight: asTraffic(rawTrafficLight),
            ownedStages,
            risks: row.risks.map((r) => ({
              projectId: r.projectId,
              severity: r.severity === "blocked" ? "blocked" : "at-risk",
              stageIds: r.stageNames.length > 0 ? r.stageNames : undefined,
            })),
          }),
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
