import {
  type ReportSectionReadModel,
  reportSectionReadModelSchema,
  type RiskSeverity,
} from "@customreport/shared";

import type {
  PrismaReportSectionWithRelations,
  RecordCommentRow,
  SectionReviewRow,
} from "./report-sections.include";
import {
  aggregateStageTraffic,
  asTraffic,
  deriveActivityStatus,
  deriveEffectiveProductStatus,
} from "./report-sections.status-derivation";

// Group author assignments by projectId; stageSet comes from full product set.
function groupAuthorAssignmentsByProject(
  stageAssignments: PrismaReportSectionWithRelations["author"]["stageAssignments"],
) {
  const active = stageAssignments.filter(
    (assignment) => !assignment.project.archived,
  );
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

// Project the joined RecordComment rows onto the read-model comment view
// (flat; reviewer display name rides along).
function toCommentViews(comments: readonly RecordCommentRow[]) {
  return comments.map((comment) => ({
    id: comment.id,
    reviewerId: comment.reviewerId,
    reviewerName: comment.reviewer.name,
    text: comment.text,
    createdAt: comment.createdAt,
  }));
}

// Project section verdicts onto the read-model view. A verdict is CURRENT only
// while it judged the section's current version — a re-submission bumps
// `version` and auto-stales any prior verdict, no clearing.
function toReviewViews(
  reviews: readonly SectionReviewRow[],
  sectionVersion: number,
) {
  return reviews.map((review) => ({
    reviewerId: review.reviewerId,
    reviewerName: review.reviewer.name,
    verdict: review.verdict === "approved" ? "approved" : "changes_requested",
    judgedVersion: review.judgedVersion,
    isCurrent: review.judgedVersion === sectionVersion,
    createdAt: review.createdAt,
  }));
}

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
  const assignmentsByProjectId = groupAuthorAssignmentsByProject(
    row.author.stageAssignments,
  );

  // Name-only for referenced-but-unowned projects (incl. archived); no extra query.
  const referencedRows = [
    ...row.items.map((i) => ({ projectId: i.projectId, project: i.project })),
    ...row.risks.map((r) => ({ projectId: r.projectId, project: r.project })),
    ...row.decisions.map((d) => ({
      projectId: d.productId,
      project: d.project,
    })),
  ];
  const referencedNamesById = new Map<string, string>(
    referencedRows.flatMap(({ projectId, project }) =>
      projectId && project?.name && !assignmentsByProjectId.has(projectId)
        ? ([[projectId, project.name]] as [string, string][])
        : [],
    ),
  );
  const referencedProjects = [...referencedNamesById.entries()]
    .map(([projectId, projectName]) => ({ projectId, projectName }))
    .sort((a, b) => a.projectName.localeCompare(b.projectName, "ru"));

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

        // Cross-lead stageSet is display-only; vacant stages stay excluded.
        const stageSet = [
          ...new Map(
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
          ).values(),
        ].sort((a, b) => a.sortOrder - b.sortOrder);

        const rawTrafficLight =
          aggregateStageTraffic(ownedStages) ??
          projectStatusByProjectId.get(project.id) ??
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
            risks: row.risks.map((r) => ({
              projectId: r.projectId,
              severity: r.severity as RiskSeverity,
              stageIds: r.stageNames.length > 0 ? r.stageNames : undefined,
            })),
          }),
          ownedStages,
          stageSet,
          // Freeze the product's owner group so a published-snapshot read can
          // detect cross-group access without a live project re-query.
          ownerGroupId: project.lead.reportingGroupId ?? null,
        };
      })
      .sort((a, b) => a.projectName.localeCompare(b.projectName, "ru")),
    referencedProjects,
    items: row.items.map((i) => ({
      id: i.id,
      // Durable lineage key — surfaced so the client round-trips it back and
      // saveSection's recreate preserves it instead of re-minting.
      stableId: i.stableId,
      // XOR parent — exactly one is non-null; both flat on the top-level array,
      // discriminated by which FK is set (activity rows carry `activityId`).
      projectId: i.projectId,
      activityId: i.activityId,
      type: i.type,
      text: i.text,
      tag: i.tag,
      workflowStatus: i.workflowStatus,
      carriedOver: i.carriedOver,
      priorityRank: i.priorityRank ?? null,
      pausedReason: i.pausedReason ?? null,
      stageIds: i.stageNames.length > 0 ? i.stageNames : undefined,
      comments: toCommentViews(i.recordComments),
    })),
    risks: row.risks.map((r) => ({
      id: r.id,
      stableId: r.stableId,
      // XOR parent (see items above).
      projectId: r.projectId,
      activityId: r.activityId,
      risk: r.risk,
      impact: r.impact,
      mitigation: r.mitigation,
      // Validated by reportSectionReadModelSchema.parse below (Zod enforces the
      // two-value vocabulary at runtime; the DB CHECK is the write-side backstop).
      severity: r.severity,
      stageIds: r.stageNames.length > 0 ? r.stageNames : undefined,
      comments: toCommentViews(r.recordComments),
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
      // XOR parent (full parity — an activity owns decisions too).
      productId: d.productId ?? undefined,
      activityId: d.activityId ?? undefined,
      comments: toCommentViews(d.recordComments),
    })),
    // Keep mid-period archived activity rows listed (history); name-sorted.
    activities: row.activityStatuses
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
          row.risks
            .filter((r) => r.activityId === status.activityId)
            .map((r) => ({ severity: r.severity as RiskSeverity })),
        ),
      }))
      .sort((a, b) => a.activityName.localeCompare(b.activityName, "ru")),
    reviews: toReviewViews(row.sectionReviews, row.version),
  });
}
