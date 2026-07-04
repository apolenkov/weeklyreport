import type { ReportSectionReadModel } from "@customreport/shared";
import type { Prisma } from "@prisma/client";

/**
 * Persists one target section's carried rows inside the caller's transaction
 * (extracted from carry-over.prisma-repository.ts saveCarryOver). Both inserts
 * ride `skipDuplicates`: a carried lineage the target section already holds
 * (the `@@unique([reportSectionId, stableId])` index) is skipped, not a P2002
 * misread as a dedupe-key race — the service also filters such lineages
 * upstream; this is defense-in-depth against a race.
 */
export async function persistCarriedRowsForSection(
  tx: Prisma.TransactionClient,
  targetSection: ReportSectionReadModel,
): Promise<void> {
  const carriedItems = targetSection.items.filter((i) => i.carriedOver);
  if (carriedItems.length > 0) {
    await tx.item.createMany({
      data: carriedItems.map((i) => ({
        id: i.id ?? undefined,
        // Carry the source record's durable lineage key onto the clone
        // (it rides the `...item` spread in cloneCarriedItem) so the
        // carried позиция shares one identity with its origin. A fresh
        // PK `id` still comes from the clone above.
        stableId: i.stableId,
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
        completed: i.completed ?? null,
        priorityRank: i.priorityRank ?? null,
        stageNames: i.stageIds ?? [],
      })),
      skipDuplicates: true,
    });
  }

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

  // activity-first-class (Decision 6): a carried decision now persists
  // when parented by EITHER a product OR an activity (the XOR
  // guarantees exactly one). A record with neither is malformed and
  // filtered out here (defense-in-depth against the CHECK).
  const decisionsWithParent = newDecisions.filter(
    (d) => d.productId != null || d.activityId != null,
  );
  if (decisionsWithParent.length > 0) {
    await tx.decision.createMany({
      data: decisionsWithParent.map((d) => ({
        id: d.id ?? undefined,
        // Carry the source decision's durable lineage key onto the
        // clone (rides the `...decision` spread in
        // cloneUnresolvedDecision).
        stableId: d.stableId,
        reportSectionId: targetSection.reportSectionId,
        text: d.text,
        owner: d.owner,
        deadline: d.deadline ?? null,
        impact: d.impact,
        resolvedAt: d.resolvedAt ?? null,
        stageNames: d.stageIds ?? [],
        // XOR parent preserved (product FK null for the activity case).
        productId: d.productId ?? null,
        activityId: d.activityId ?? null,
      })),
      skipDuplicates: true,
    });
  }
}
