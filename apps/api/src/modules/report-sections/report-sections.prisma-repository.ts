import {
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
} from "@customreport/shared";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  ReportSectionDomainError,
  type ReportSectionsRepository,
  SectionVersionConflictError,
} from "./report-sections.service";

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
          // unassigned-stage-reporting-exclusion: include the product's FULL
          // assignment set (across all leads, with each stage) so the read
          // model can expose the per-product `stageSet` — the union needed to
          // tell a vacant stage (excluded) from a foreign-owned one. Display
          // metadata only; the writable `ownedStages` stays the author's own
          // assignments.
          project: {
            include: {
              stageAssignments: {
                include: { stage: true },
              },
            },
          },
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
      // unassigned-stage-reporting-exclusion: `project.stageAssignments` is the
      // product's full assignment set across ALL leads (used to build the
      // per-product `stageSet`). The author's own assignments stay the outer
      // rows that drive `ownedStages`. Optional so legacy fixtures that pre-date
      // the include widening still map (stageSet falls back to empty).
      project: {
        id: string;
        name: string;
        archived: boolean;
        stageAssignments?: {
          stageId: string;
          stage: { id: string; name: string; sortOrder: number };
        }[];
      };
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
    // Durable lineage key. Optional on this hand-written row type so unit-test
    // fixtures predating the column still satisfy it; a real DB row (NOT NULL
    // column) always carries it, and the read model treats it as optional too.
    stableId?: string;
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
    stableId?: string;
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
    stableId?: string;
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
      // Carries `stageAssignments` (the product's full cross-lead set) so the
      // per-product `stageSet` can be derived below.
      project: (typeof row.author.stageAssignments)[number]["project"];
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
    // Optimistic-concurrency row revision the client echoes back on its next
    // save; every section read carries the current value.
    version: row.version,
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

        // unassigned-stage-reporting-exclusion: the product's assigned-stage
        // set — every stage with an assignment to ANY lead on the product,
        // deduped by stageId and ordered by pipeline sortOrder. READ-ONLY
        // display metadata; the lead-form grid renders only stages in this set
        // (a vacant stage is excluded). The writable `ownedStages` is untouched.
        const stageSet = [
          ...new Map(
            // `?? []` guards legacy fixtures / callers that predate the
            // `project.stageAssignments` include; real Prisma rows always carry
            // it. An empty set lets the web fall back to `ownedStages`.
            (project.stageAssignments ?? []).map(
              (sa) =>
                [
                  sa.stageId,
                  {
                    stageId: sa.stageId,
                    stageName: sa.stage.name,
                    sortOrder: sa.stage.sortOrder,
                  },
                ] as const,
            ),
          ).values(),
        ].sort((a, b) => a.sortOrder - b.sortOrder);

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
          stageSet,
        };
      })
      .sort((a, b) => a.projectName.localeCompare(b.projectName, "ru")),
    referencedProjects,
    items: row.items.map((i) => ({
      id: i.id,
      // Durable lineage key — surfaced so the client round-trips it back and
      // saveSection's recreate preserves it instead of re-minting.
      stableId: i.stableId,
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
      stableId: r.stableId,
      projectId: r.projectId,
      risk: r.risk,
      impact: r.impact,
      mitigation: r.mitigation,
      severity: r.severity === "blocked" ? "blocked" : "at-risk",
      stageIds: r.stageNames.length > 0 ? r.stageNames : undefined,
    })),
    decisions: row.decisions.map((d) => ({
      id: d.id,
      stableId: d.stableId,
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
    expectedVersion: number,
  ): Promise<ReportSectionReadModel> {
    const sectionId = section.reportSectionId;

    try {
      await this.prisma.$transaction(
        async (tx) => {
          // Optimistic-concurrency compare-and-set, FIRST so a conflict aborts
          // before any deleteMany runs (no child rows are touched on conflict).
          // `expectedVersion` is the client-loaded version threaded through the
          // payload — NOT the freshly-fetched row's — so a stale writer whose
          // row was advanced concurrently matches zero rows and 409s.
          const updated = await tx.reportSection.updateMany({
            where: { id: sectionId, version: expectedVersion },
            data: {
              status: section.status,
              submittedAt: section.submittedAt,
              // Persist the late flag computed by submitSection; saveDraft /
              // reopen paths carry the prior value through mergeSection.
              late: section.late,
              version: { increment: 1 },
            },
          });
          if (updated.count === 0) {
            throw new SectionVersionConflictError(
              "This section was changed by another save. Reload and try again.",
            );
          }

          await tx.projectStatus.deleteMany({
            where: { reportSectionId: sectionId },
          });
          await tx.stageStatus.deleteMany({
            where: { reportSectionId: sectionId },
          });
          await tx.item.deleteMany({ where: { reportSectionId: sectionId } });
          await tx.risk.deleteMany({ where: { reportSectionId: sectionId } });
          await tx.decision.deleteMany({
            where: { reportSectionId: sectionId },
          });

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
                // The DB mints the id — rows are recreated wholesale, so trusting
                // a client-supplied PK only risks a cross-section P2002 collision.
                reportSectionId: sectionId,
                // Preserve the durable lineage key through the recreate. Undefined
                // for a brand-new record → omitted so the `@default(uuid())` mints
                // one; never `?? null` (the column is NOT NULL).
                stableId: i.stableId,
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
                reportSectionId: sectionId,
                // Preserve the durable lineage key (see items above).
                stableId: r.stableId,
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
                reportSectionId: sectionId,
                // Preserve the durable lineage key (see items above).
                stableId: d.stableId,
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
    } catch (error) {
      if (error instanceof SectionVersionConflictError) {
        throw error;
      }
      // The DB mints child ids now, but a duplicate (reportSectionId, projectId)
      // ProjectStatus (or any other unique violation) in a malformed payload can
      // still trip P2002 — surface it as a clean 400, never an unhandled 500.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ReportSectionDomainError(
          "DUPLICATE_CHILD_ROW",
          "Could not save the section: a duplicate row was rejected.",
        );
      }
      throw error;
    }

    const saved = await this.prisma.reportSection.findUnique({
      where: { id: sectionId },
      include: reportSectionFullInclude,
    });

    return mapPrismaToReportSection(
      saved as unknown as PrismaReportSectionWithRelations,
    );
  }
}
