import type {
  CarryOverRecord,
  ReportSectionReadModel,
} from "@customreport/shared";
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
  records: readonly CarryOverRecord[],
): ReportSectionReadModel {
  if (planned === undefined) return current;

  // The plan also contains its pre-transaction target snapshot. Record target
  // ids identify the clones this execution may add after the locked re-read.
  const plannedTargetItemIds = new Set(
    records.flatMap((record) =>
      record.targetItemId === null ? [] : [record.targetItemId],
    ),
  );
  const plannedTargetDecisionIds = new Set(
    records.flatMap((record) =>
      record.targetDecisionId === null ? [] : [record.targetDecisionId],
    ),
  );

  const existingItemKeys = new Set(
    current.items.flatMap((item) => {
      const key = item.stableId ?? item.id;
      return key === undefined ? [] : [key];
    }),
  );
  const carriedItems = planned.items.filter((item) => {
    if (
      !item.carriedOver ||
      item.id === undefined ||
      !plannedTargetItemIds.has(item.id)
    ) {
      return false;
    }
    const key = item.stableId ?? item.id;
    if (existingItemKeys.has(key)) return false;
    existingItemKeys.add(key);
    return true;
  });

  const existingDecisionKeys = new Set(
    current.decisions.flatMap((decision) => {
      const key = decision.stableId ?? decision.id;
      return key === undefined ? [] : [key];
    }),
  );
  const carriedDecisions = planned.decisions.filter((decision) => {
    if (
      decision.id === undefined ||
      !plannedTargetDecisionIds.has(decision.id) ||
      (decision.resolvedAt !== null && decision.resolvedAt !== undefined)
    ) {
      return false;
    }
    const key = decision.stableId ?? decision.id;
    if (existingDecisionKeys.has(key)) {
      return false;
    }
    existingDecisionKeys.add(key);
    return true;
  });

  return {
    ...current,
    items: [...current.items, ...carriedItems],
    decisions: [...current.decisions, ...carriedDecisions],
  };
}

// skipDuplicates on stableId unique — defense-in-depth if lineage filter races.
// Keep the established deterministic item-then-decision write order; both
// passes report the database's actual inserted-row count.
export async function persistCarriedRowsForSection(
  tx: Prisma.TransactionClient,
  targetSection: ReportSectionReadModel,
): Promise<{ insertedItems: number; insertedDecisions: number }> {
  const insertedItems = await insertCarriedItems(tx, targetSection);
  const insertedDecisions = await insertCarriedDecisions(tx, targetSection);
  return { insertedItems, insertedDecisions };
}

async function insertCarriedItems(
  tx: Prisma.TransactionClient,
  targetSection: ReportSectionReadModel,
): Promise<number> {
  const carriedItems = targetSection.items.filter((i) => i.carriedOver);
  if (carriedItems.length === 0) return 0;

  const result = await tx.item.createMany({
    data: carriedItems.map((i) => ({
      ...(i.id === undefined ? {} : { id: i.id }),
      // Item replay defense relies on the non-null stableId unique index;
      // decisions use the same durable lineage key below.
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
      pausedReason: i.pausedReason ?? null,
      nextStepText: i.nextStepText ?? null,
      stageNames: [...i.stageNames],
    })),
    skipDuplicates: true,
  });
  return result.count;
}

async function insertCarriedDecisions(
  tx: Prisma.TransactionClient,
  targetSection: ReportSectionReadModel,
): Promise<number> {
  const carriedDecisions = targetSection.decisions.filter((d) => !d.resolvedAt);
  const existingDecisionKeys = new Set(
    (
      await tx.decision.findMany({
        where: { reportSectionId: targetSection.reportSectionId },
        select: { id: true, stableId: true },
      })
    ).map((d) => d.stableId),
  );

  const newDecisions = carriedDecisions.filter((d) => {
    const key = d.stableId ?? d.id;
    return key !== undefined && !existingDecisionKeys.has(key);
  });
  if (newDecisions.length === 0) return 0;

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

  const result = await tx.decision.createMany({
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
  return result.count;
}

function requireStableItemId(stableId: string | undefined): string {
  if (stableId === undefined) {
    throw new Error(
      "Cannot persist a carried item without its stable lineage id.",
    );
  }
  return stableId;
}
