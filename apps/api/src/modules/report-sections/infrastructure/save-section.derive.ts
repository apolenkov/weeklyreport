// Pure row-builders + the child-row clear helper behind
// ReportSectionsPrismaRepository.saveSection. The builders produce the
// delete-recreate createMany payloads EXACTLY; the load-bearing orchestration
// (FOR UPDATE gate, version compare-and-set, comment capture/reinsert, in-tx
// re-read, conflict/P2002 handling) stays in the method.
import type { ReportSectionReadModel } from "@customreport/shared";
import type { Prisma } from "@prisma/client";

export function toProjectStatusRows(
  section: ReportSectionReadModel,
  sectionId: string,
) {
  return section.projects.map((p) => ({
    reportSectionId: sectionId,
    projectId: p.projectId,
    status: p.trafficLight,
  }));
}

export function toStageStatusRows(
  section: ReportSectionReadModel,
  sectionId: string,
) {
  return section.projects.flatMap((project) =>
    (project.ownedStages ?? []).map((stage) => ({
      reportSectionId: sectionId,
      projectId: project.projectId,
      stageId: stage.stageId,
      status: stage.status ?? null,
    })),
  );
}

export function toActivityStatusRows(
  section: ReportSectionReadModel,
  sectionId: string,
) {
  return section.activities.map((activity) => ({
    reportSectionId: sectionId,
    activityId: activity.activityId,
    status: activity.status,
    note: activity.note ?? null,
  }));
}

export function toItemRows(section: ReportSectionReadModel, sectionId: string) {
  return section.items.map((i) => ({
    // The DB mints the id — rows are recreated wholesale, so trusting a
    // client-supplied PK only risks a cross-section P2002 collision.
    reportSectionId: sectionId,
    // Preserve the durable lineage key through the recreate. Undefined for a
    // brand-new record → omitted so the `@default(uuid())` mints one; never
    // `?? null` (the column is NOT NULL).
    stableId: i.stableId,
    // XOR parent: product-parented rows write projectId; activity-parented rows
    // write activityId (product FK null). The hand-written CHECK is the
    // backstop; the write schema already enforced XOR.
    projectId: i.projectId ?? null,
    activityId: i.activityId ?? null,
    type: i.type,
    text: i.text,
    tag: i.tag,
    workflowStatus: i.workflowStatus,
    carriedOver: i.carriedOver,
    priorityRank: i.priorityRank ?? null,
    pausedReason: i.pausedReason ?? null,
    stageNames: i.stageIds ?? [],
  }));
}

export function toRiskRows(section: ReportSectionReadModel, sectionId: string) {
  return section.risks.map((r) => ({
    reportSectionId: sectionId,
    // Preserve the durable lineage key (see items above).
    stableId: r.stableId,
    // XOR parent (see items above).
    projectId: r.projectId ?? null,
    activityId: r.activityId ?? null,
    risk: r.risk,
    impact: r.impact,
    mitigation: r.mitigation,
    severity: r.severity,
    stageNames: r.stageIds ?? [],
  }));
}

/**
 * A decision is persisted only when parented by EITHER a product OR an activity
 * (the write schema's XOR guarantees exactly one).
 */
export function isPersistableDecision(
  decision: ReportSectionReadModel["decisions"][number],
): boolean {
  return decision.productId != null || decision.activityId != null;
}

export function toDecisionRows(
  decisions: readonly ReportSectionReadModel["decisions"][number][],
  sectionId: string,
) {
  return decisions.map((d) => ({
    reportSectionId: sectionId,
    // Preserve the durable lineage key (see items above).
    stableId: d.stableId,
    text: d.text,
    owner: d.owner,
    deadline: d.deadline ?? null,
    impact: d.impact,
    resolvedAt: d.resolvedAt ?? null,
    stageNames: d.stageIds ?? [],
    // XOR parent (product FK null for the activity case).
    productId: d.productId ?? null,
    activityId: d.activityId ?? null,
  }));
}

/**
 * Deletes the six child-row collections the delete-recreate save owns, in the
 * original order. Runs inside the caller's still-open transaction so the clear
 * and the subsequent createMany fan-out commit atomically.
 */
export async function clearSectionChildRows(
  tx: Prisma.TransactionClient,
  sectionId: string,
): Promise<void> {
  await tx.projectStatus.deleteMany({ where: { reportSectionId: sectionId } });
  await tx.stageStatus.deleteMany({ where: { reportSectionId: sectionId } });
  await tx.activityStatus.deleteMany({ where: { reportSectionId: sectionId } });
  await tx.item.deleteMany({ where: { reportSectionId: sectionId } });
  await tx.risk.deleteMany({ where: { reportSectionId: sectionId } });
  await tx.decision.deleteMany({ where: { reportSectionId: sectionId } });
}
