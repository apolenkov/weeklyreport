import {
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
  type RiskSeverity,
} from "@customreport/shared";

import {
  toDecisionViews,
  toItemViews,
  toReviewViews,
  toRiskViews,
} from "./mappers/report-sections.record-views.js";
import type { PrismaReportSectionWithRelations as SectionRow } from "./report-sections.include";
import {
  aggregateStageTraffic,
  asTraffic,
  deriveActivityStatus,
  deriveEffectiveProductStatus,
} from "./report-sections.status-derivation";

type StageAssignmentRow = SectionRow["author"]["stageAssignments"][number];
type SectionRisks = SectionRow["risks"];

interface AuthorProjectGroup {
  readonly project: StageAssignmentRow["project"];
  readonly assignments: readonly StageAssignmentRow[];
}
type OwnedProjects = ReadonlyMap<string, AuthorProjectGroup>;

// Lookups shared by every project view, resolved once per section.
interface ProjectViewContext {
  readonly stageStatusByKey: ReadonlyMap<string, string | null>;
  readonly projectStatusByProjectId: ReadonlyMap<string, string | null>;
  // The WHOLE section risk set: deriveEffectiveProductStatus scopes coverage by
  // projectId itself, so pre-filtering here would change the derived status.
  readonly sectionRisks: SectionRisks;
}

// Group author assignments by projectId; stageSet comes from full product set.
function groupAuthorAssignmentsByProject(
  stageAssignments: SectionRow["author"]["stageAssignments"],
): OwnedProjects {
  const active = stageAssignments.filter((a) => !a.project.archived);
  return new Map(
    [...Map.groupBy(active, (assignment) => assignment.projectId)].flatMap(
      ([projectId, assignments]) => {
        const [head] = assignments;
        // Map.groupBy never yields an empty group; the guard narrows the type
        // and the head's `project` relation is shared across the group.
        return head
          ? [[projectId, { project: head.project, assignments }] as const]
          : [];
      },
    ),
  );
}

// Name-only for referenced-but-unowned projects (incl. archived); no extra query.
function toReferencedProjects(row: SectionRow, owned: OwnedProjects) {
  const referencedRows = [
    ...row.items.map((i) => ({ projectId: i.projectId, project: i.project })),
    ...row.risks.map((r) => ({ projectId: r.projectId, project: r.project })),
    ...row.decisions.map((d) => ({
      projectId: d.productId,
      project: d.project,
    })),
  ];
  const namesById = new Map<string, string>(
    referencedRows.flatMap(({ projectId, project }) =>
      projectId && project?.name && !owned.has(projectId)
        ? ([[projectId, project.name]] as [string, string][])
        : [],
    ),
  );
  return [...namesById.entries()]
    .map(([projectId, projectName]) => ({ projectId, projectName }))
    .sort((a, b) => a.projectName.localeCompare(b.projectName, "ru"));
}

function toOwnedStages(group: AuthorProjectGroup, ctx: ProjectViewContext) {
  return group.assignments
    .map((sa) => ({
      stageId: sa.stageId,
      stageName: sa.stage.name,
      sortOrder: sa.stage.sortOrder,
      status:
        ctx.stageStatusByKey.get(`${group.project.id}::${sa.stageId}`) ?? null,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// Cross-lead stageSet is display-only; vacant stages stay excluded.
function toStageSet(project: StageAssignmentRow["project"]) {
  const byStageId = new Map(
    project.stageAssignments.map(
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
  );
  return [...byStageId.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

function requireSingleOwnerGroupId(
  project: StageAssignmentRow["project"],
): string {
  const ownerGroupIds = project.groupProducts.map((edge) => edge.groupId);
  if (ownerGroupIds.length !== 1) {
    throw new Error(
      `Project ${project.id} must have exactly one GroupProduct owner, found ${ownerGroupIds.length}`,
    );
  }
  const [ownerGroupId] = ownerGroupIds;
  if (ownerGroupId === undefined) {
    throw new Error(`Project ${project.id} has no GroupProduct owner`);
  }
  return ownerGroupId;
}

function toProjectView(group: AuthorProjectGroup, ctx: ProjectViewContext) {
  const { project } = group;
  const ownedStages = toOwnedStages(group, ctx);
  const rawTrafficLight =
    aggregateStageTraffic(ownedStages) ??
    ctx.projectStatusByProjectId.get(project.id) ??
    null;
  return {
    projectId: project.id,
    projectName: project.name,
    // Own covering risks floor empty owned stages (not raw trafficLight).
    trafficLight: deriveEffectiveProductStatus({
      projectId: project.id,
      trafficLight: asTraffic(rawTrafficLight),
      ownedStages,
      // The DB column is a plain String (Risk_severity_check CHECK backs
      // the two-value vocabulary); narrow the Prisma-typed string here.
      risks: ctx.sectionRisks.map((r) => ({
        projectId: r.projectId,
        severity: r.severity as RiskSeverity,
        // An empty list is meaningful: it covers every owned stage. Keep the
        // current persisted shape explicit so the derivation cannot confuse a
        // product risk with an activity risk that has no stage list.
        stageNames: r.stageNames,
      })),
    }),
    ownedStages,
    stageSet: toStageSet(project),
    // Freeze the explicit product owner so a published-snapshot read can
    // detect cross-group access without a live project re-query.
    ownerGroupId: requireSingleOwnerGroupId(project),
  };
}

function toProjectViews(row: SectionRow, owned: OwnedProjects) {
  const ctx: ProjectViewContext = {
    stageStatusByKey: new Map(
      row.stageStatuses.map(
        (ss) => [`${ss.projectId}::${ss.stageId}`, ss.status] as const,
      ),
    ),
    projectStatusByProjectId: new Map(
      row.projectStatuses.map((ps) => [ps.projectId, ps.status] as const),
    ),
    sectionRisks: row.risks,
  };
  return [...owned.values()]
    .map((group) => toProjectView(group, ctx))
    .sort((a, b) => a.projectName.localeCompare(b.projectName, "ru"));
}

// Keep mid-period archived activity rows listed (history); name-sorted.
function toActivityViews(
  rows: SectionRow["activityStatuses"],
  sectionRisks: SectionRisks,
) {
  return rows
    .map((status) => ({
      activityId: status.activityId,
      activityName: status.activity.name,
      status: asTraffic(status.status),
      note: status.note,
      linkedProducts: status.activity.activityProducts
        .map((link) => ({
          productId: link.product.id,
          productName: link.product.name,
        }))
        .sort((a, b) => a.productName.localeCompare(b.productName, "ru")),
      ...deriveActivityStatus(
        asTraffic(status.status),
        sectionRisks
          .filter((risk) => risk.activityId === status.activityId)
          .map((risk) => ({ severity: risk.severity as RiskSeverity })),
      ),
    }))
    .sort((a, b) => a.activityName.localeCompare(b.activityName, "ru"));
}

function assertProductRelationsLoaded(row: SectionRow): void {
  const missingRelation = [
    ...row.items.map((item) => ({
      id: item.id,
      parentId: item.projectId,
      project: item.project,
    })),
    ...row.risks.map((risk) => ({
      id: risk.id,
      parentId: risk.projectId,
      project: risk.project,
    })),
    ...row.decisions.map((decision) => ({
      id: decision.id,
      parentId: decision.productId,
      project: decision.project,
    })),
  ].find(
    (
      candidate,
    ): candidate is typeof candidate & {
      parentId: string;
      project: null;
    } => candidate.parentId !== null && candidate.project === null,
  );

  if (missingRelation !== undefined) {
    throw new Error(
      `Report section record ${missingRelation.id} references product ${missingRelation.parentId}, but its product relation was not loaded`,
    );
  }
}

export function mapPrismaToReportSection(
  row: SectionRow,
): ReportSectionReadModel {
  assertProductRelationsLoaded(row);
  const owned = groupAuthorAssignmentsByProject(row.author.stageAssignments);
  return reportSectionReadModelSchema.parse({
    reportSectionId: row.id,
    reportId: row.reportId,
    authorId: row.authorId,
    authorName: row.author.name,
    authorRole: row.author.role,
    version: row.version,
    status: row.status,
    submittedAt: row.submittedAt,
    late: row.late,
    projects: toProjectViews(row, owned),
    referencedProjects: toReferencedProjects(row, owned),
    items: toItemViews(row.items),
    risks: toRiskViews(row.risks),
    decisions: toDecisionViews(row.decisions),
    activities: toActivityViews(row.activityStatuses, row.risks),
    reviews: toReviewViews(row.sectionReviews, row.version),
  });
}
