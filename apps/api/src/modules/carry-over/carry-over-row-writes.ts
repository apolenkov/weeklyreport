import type { ReportSectionReadModel } from "@customreport/shared";
import type { Prisma } from "@prisma/client";

// Empty list is a broken caller invariant — fail loud (service pre-validates).
export function requirePrimaryTargetSection(
  targetSections: readonly ReportSectionReadModel[],
): ReportSectionReadModel {
  const [primary] = targetSections;
  if (primary === undefined) {
    throw new Error(
      "Carry-over requires at least one target section — the service validates this before writing.",
    );
  }
  return primary;
}

export function mergePlannedCarriedRows(
  current: ReportSectionReadModel,
  planned: ReportSectionReadModel | undefined,
): ReportSectionReadModel {
  if (planned === undefined) return current;

  const existingItemKeys = new Set(
    current.items.flatMap((item) =>
      item.stableId === undefined ? [item.id] : [item.stableId],
    ),
  );
  const carriedItems = planned.items.filter((item) => {
    if (!item.carriedOver) return false;
    const key = item.stableId ?? item.id;
    if (existingItemKeys.has(key)) return false;
    existingItemKeys.add(key);
    return true;
  });

  const existingDecisionIds = new Set(
    current.decisions.map((decision) => decision.id),
  );
  const carriedDecisions = planned.decisions.filter((decision) => {
    if (decision.resolvedAt !== null && decision.resolvedAt !== undefined) {
      return false;
    }
    if (decision.id === undefined || existingDecisionIds.has(decision.id)) {
      return false;
    }
    existingDecisionIds.add(decision.id);
    return true;
  });

  return {
    ...current,
    items: [...current.items, ...carriedItems],
    decisions: [...current.decisions, ...carriedDecisions],
  };
}

// skipDuplicates on stableId unique — defense-in-depth if lineage filter races.
// Items land before decisions: the decision pass reads back existing rows, so
// the two writes must stay sequential in this order.
export async function persistCarriedRowsForSection(
  tx: Prisma.TransactionClient,
  targetSection: ReportSectionReadModel,
): Promise<void> {
  await insertCarriedItems(tx, targetSection);
  await insertCarriedDecisions(tx, targetSection);
}

async function insertCarriedItems(
  tx: Prisma.TransactionClient,
  targetSection: ReportSectionReadModel,
): Promise<void> {
  const carriedItems = targetSection.items.filter((i) => i.carriedOver);
  if (carriedItems.length === 0) return;

  await tx.item.createMany({
    data: carriedItems.map((i) => ({
      ...(i.id === undefined ? {} : { id: i.id }),
      // Item replay defense relies on the non-null stableId unique index;
      // decisions also have explicit id-based dedupe below.
      stableId: requireStableItemId(i.stableId),
      reportSectionId: targetSection.reportSectionId,
      // XOR parent preserved onto the clone (product FK null for an
      // activity-parented carried item).
      projectId: i.projectId ?? null,
      activityId: i.activityId ?? null,
      type: i.type,
      text: i.text,
      tag: i.tag,
      workflowStatus: i.workflowStatus,
      carriedOver: true,
      priorityRank: i.priorityRank ?? null,
      stageNames: [...i.stageNames],
    })),
    skipDuplicates: true,
  });
}

async function insertCarriedDecisions(
  tx: Prisma.TransactionClient,
  targetSection: ReportSectionReadModel,
): Promise<void> {
  const carriedDecisions = targetSection.decisions.filter((d) => !d.resolvedAt);
  const existingDecisionIds = new Set(
    (
      await tx.decision.findMany({
        where: { reportSectionId: targetSection.reportSectionId },
        select: { id: true },
      })
    ).map((d) => d.id),
  );

  const newDecisions = carriedDecisions.filter(
    (d) => d.id && !existingDecisionIds.has(d.id),
  );
  if (newDecisions.length === 0) return;

  // The DB CHECK guarantees exactly one parent (product XOR activity); a
  // decision with neither cannot persist — fail loud, never drop it silently.
  const malformedDecision = newDecisions.find(
    (d) => d.productId == null && d.activityId == null,
  );
  if (malformedDecision !== undefined) {
    throw new Error(
      "Cannot persist a carried decision without a product or activity parent.",
    );
  }

  await tx.decision.createMany({
    data: newDecisions.map((d) => ({
      ...(d.id === undefined ? {} : { id: d.id }),
      // Carry the source decision's durable lineage key onto the
      // clone (rides the `...decision` spread in
      // cloneUnresolvedDecision).
      ...(d.stableId === undefined ? {} : { stableId: d.stableId }),
      reportSectionId: targetSection.reportSectionId,
      text: d.text,
      owner: d.owner,
      deadline: d.deadline ?? null,
      impact: d.impact,
      resolvedAt: d.resolvedAt ?? null,
      stageNames: [...d.stageNames],
      // XOR parent preserved (product FK null for the activity case).
      productId: d.productId ?? null,
      activityId: d.activityId ?? null,
    })),
    skipDuplicates: true,
  });
}

function requireStableItemId(stableId: string | undefined): string {
  if (stableId === undefined) {
    throw new Error(
      "Cannot persist a carried item without its stable lineage id.",
    );
  }
  return stableId;
}
