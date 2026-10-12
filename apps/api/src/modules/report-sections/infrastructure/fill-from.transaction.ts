import { Prisma } from "@prisma/client";
import {
  type PrismaReportSectionWithRelations,
  reportSectionFullInclude,
} from "@weeklyreport/report-persistence";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { isUniqueViolation } from "../../../lib/prisma-unique-violation.js";
import { lockCurrentEditableReport } from "../../../lib/report-lifecycle.js";
import {
  ReportSectionDomainError,
  SectionVersionConflictError,
} from "../application/report-sections.service";
import {
  LeadFormConstraintError,
  LeadFormDomainError,
} from "../domain/lead-form-shared";
import {
  isCarryable,
  toFilledDecisionRows,
  toFilledItemRows,
  toFilledRiskRows,
} from "./fill-from.derive.js";
import { querySectionPublishedLineageTx } from "./published-lineage.transaction.js";

interface CarryableChildRows {
  itemsToCopy: PrismaReportSectionWithRelations["items"];
  risksToCopy: PrismaReportSectionWithRelations["risks"];
  decisionsToCopy: PrismaReportSectionWithRelations["decisions"];
}

// Select the source's own past rows that carry forward. Fill From honours the
// XOR parent: an activity-parented record carries ONLY when its activity is
// still attached to the target (else the XOR CHECK aborts the whole fill).
async function selectCarryableChildRows(
  prisma: Prisma.TransactionClient,
  targetSectionId: string,
  source: PrismaReportSectionWithRelations,
): Promise<CarryableChildRows> {
  const targetActivityIds = new Set(
    (
      await prisma.activityStatus.findMany({
        where: { reportSectionId: targetSectionId },
        select: { activityId: true },
      })
    ).map((row) => row.activityId),
  );
  return {
    itemsToCopy: source.items.filter(
      (row) => row.resolution == null && isCarryable(row, targetActivityIds),
    ),
    risksToCopy: source.risks.filter((row) =>
      isCarryable(row, targetActivityIds),
    ),
    decisionsToCopy: source.decisions.filter((row) =>
      isCarryable(row, targetActivityIds),
    ),
  };
}

// FOR UPDATE gate on the target's Report. The archived + missing-row checks
// are load-bearing: archive leaves periodStatus untouched, and a section
// deleted mid-flight surfaces as NOT_FOUND, not a period constraint.
async function assertTargetSectionEditable(
  tx: Prisma.TransactionClient,
  targetSectionId: string,
): Promise<string> {
  const gate = await lockCurrentEditableReport(tx, {
    sectionId: targetSectionId,
  });
  // A missing row means the section was deleted between the precheck
  // and this transaction — that is a NOT_FOUND, not a period-state
  // constraint.
  if (gate.kind === "not-found") {
    throw new LeadFormDomainError("The target section no longer exists.");
  }
  if (gate.kind === "inconsistent") {
    // The lifecycle gate remains fail-closed; Fill From exposes its stable
    // caller contract for a period write rather than leaking infrastructure
    // integrity details through the repository boundary.
    throw new LeadFormConstraintError(
      "Cannot fill a section of a published report.",
    );
  }
  // The archive transition leaves periodStatus untouched, so the
  // in-tx gate must re-check `archived` too — same predicate as
  // isEditablePeriod on the authz path.
  if (gate.kind === "not-editable") {
    throw new LeadFormConstraintError(
      "Cannot fill a section of a published report.",
    );
  }
  return gate.reportId;
}

async function assertTargetHasNoPublishedLineage(
  tx: Prisma.TransactionClient,
  reportId: string,
  targetSectionId: string,
): Promise<void> {
  const published = await querySectionPublishedLineageTx(tx, {
    reportId,
    reportSectionId: targetSectionId,
  });
  if (
    published.itemStableIds.length > 0 ||
    published.decisionStableIds.length > 0
  ) {
    throw new ReportSectionDomainError(
      "PUBLISHED_RECORD_LOCKED",
      "Fill from previous cannot replace records that are part of the published report.",
    );
  }
}

// Optimistic-concurrency compare-and-set on the TARGET, first so a conflict
// aborts before any deleteMany — the delete-then-recreate must not clobber a
// target a second writer just advanced.
async function bumpTargetSectionVersion(
  tx: Prisma.TransactionClient,
  targetSectionId: string,
  expectedVersion: number,
): Promise<void> {
  const updated = await tx.reportSection.updateMany({
    where: { id: targetSectionId, version: expectedVersion },
    data: { version: { increment: 1 } },
  });
  if (updated.count === 0) {
    throw new SectionVersionConflictError(
      "This section was changed by another save. Reload and try again.",
    );
  }
}

// Delete-then-recreate the child rows Fill From owns. Priorities stay fresh
// for the current week and are not copied or cleared here.
async function rebuildOwnedChildRows(
  tx: Prisma.TransactionClient,
  targetSectionId: string,
  { itemsToCopy, risksToCopy, decisionsToCopy }: CarryableChildRows,
): Promise<void> {
  await tx.item.deleteMany({
    where: { reportSectionId: targetSectionId },
  });
  await tx.risk.deleteMany({
    where: { reportSectionId: targetSectionId },
  });
  await tx.decision.deleteMany({
    where: { reportSectionId: targetSectionId },
  });

  // Copy items from source. Next Week source items become Current Week
  // suggestions in the target period. Activity-parented items ride the
  // XOR parent — carry activityId (product FK null) only when re-attached.
  if (itemsToCopy.length > 0) {
    await tx.item.createMany({
      data: toFilledItemRows(itemsToCopy, targetSectionId),
    });
  }

  // Copy risks from source (same XOR-parent carry rule as items).
  if (risksToCopy.length > 0) {
    await tx.risk.createMany({
      data: toFilledRiskRows(risksToCopy, targetSectionId),
    });
  }

  // Copy decisions from source. A decision is product- OR activity-
  // parented (XOR); carry the activity case only when re-attached, the
  // product case always. isCarryable(null activityId) == true handles both.
  if (decisionsToCopy.length > 0) {
    await tx.decision.createMany({
      data: toFilledDecisionRows(decisionsToCopy, targetSectionId),
    });
  }
}

// Copy a lead's own past content forward into the target section under a FOR
// UPDATE gate. The archived + missing-row checks inside the gate are load-
// bearing (archive leaves periodStatus untouched; mid-flight deletion → NOT_FOUND).
export async function fillFromSectionTx(
  prisma: PrismaService,
  targetSectionId: string,
  sourceSectionId: string,
  expectedVersion: number,
): Promise<number> {
  const source = await prisma.reportSection.findUnique({
    where: { id: sourceSectionId },
    include: reportSectionFullInclude,
  });

  if (!source) {
    // TOCTOU: the service prechecks the source, but it can be deleted before
    // this copy re-read. Keep NOT_FOUND (not a false 500) on that race.
    throw new LeadFormDomainError(
      `Source section ${sourceSectionId} not found.`,
    );
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const reportId = await assertTargetSectionEditable(tx, targetSectionId);
        const carryable = await selectCarryableChildRows(
          tx,
          targetSectionId,
          source,
        );
        const copiedItems =
          carryable.itemsToCopy.length +
          carryable.risksToCopy.length +
          carryable.decisionsToCopy.length;
        await assertTargetHasNoPublishedLineage(tx, reportId, targetSectionId);
        await bumpTargetSectionVersion(tx, targetSectionId, expectedVersion);
        const cancelledItem = await tx.item.findFirst({
          where: {
            reportSectionId: targetSectionId,
            NOT: { resolution: { equals: Prisma.DbNull } },
          },
          select: { id: true },
        });
        if (cancelledItem) {
          throw new LeadFormConstraintError(
            "Restore cancelled plans before replacing this section.",
          );
        }
        await rebuildOwnedChildRows(tx, targetSectionId, carryable);
        return copiedItems;
      },
      { timeout: 15_000 },
    );
  } catch (error) {
    if (error instanceof SectionVersionConflictError) {
      throw error;
    }
    // Any P2002 in the fill copy means a duplicate child row — surface it as a
    // clean domain error, never a raw 500. Unscoped: duck-typed `.code` via
    // the shared guard, so no `instanceof` narrowing is needed.
    if (isUniqueViolation(error)) {
      throw new ReportSectionDomainError(
        "DUPLICATE_CHILD_ROW",
        "Could not fill the section: a duplicate row was rejected.",
      );
    }
    throw error;
  }
}
