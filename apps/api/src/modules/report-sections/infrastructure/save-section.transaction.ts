import type { ReportSectionReadModel } from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import {
  ReportSectionDomainError,
  ReportSectionNotFoundError,
  SectionVersionConflictError,
} from "../application/report-sections.service";
import { reportSectionFullInclude } from "./report-sections.include";
import { mapPrismaToReportSection } from "./report-sections.mappers";
import {
  captureRecordComments,
  reinsertRecordComments,
} from "./report-sections.save-lineage";
import {
  clearSectionChildRows,
  isPersistableDecision,
  toActivityStatusRows,
  toDecisionRows,
  toItemRows,
  toProjectStatusRows,
  toRiskRows,
  toStageStatusRows,
} from "./save-section.derive";

// Publish/save mutual exclusion: lock the parent report row FIRST (same lock
// order as the publish transaction, which updates Report before reading
// sections — consistent ordering, no deadlock). A concurrent publish either
// committed already (this locking read then sees periodStatus="published" and
// the save fails closed before any child delete runs) or blocks on this row
// lock until the save commits — so a snapshot freeze can never interleave a
// half-saved section, and a published report's live rows can never be
// rewritten by a save whose service-level gate read a stale status.
async function lockReportForSave(
  tx: Prisma.TransactionClient,
  reportId: string,
): Promise<void> {
  const gate = await tx.$queryRaw<
    { periodStatus: string; archived: boolean }[]
  >`SELECT "periodStatus", "archived" FROM "Report" WHERE "id" = ${reportId} FOR UPDATE`;
  const gateRow = gate[0];
  // No row means the report was deleted between the precheck and this
  // transaction — the resource is gone, not period-locked, so it must surface
  // as NOT_FOUND rather than a period-state constraint.
  if (gateRow === undefined) {
    throw new ReportSectionNotFoundError("The report no longer exists.");
  }
  // Archiving leaves periodStatus untouched, so a gate reading only that lets
  // an archive committing inside the precheck→tx window through. Same
  // predicate as isEditablePeriod on the authz path.
  if (
    gateRow.archived ||
    (gateRow.periodStatus !== "open" && gateRow.periodStatus !== "reopened")
  ) {
    throw new ReportSectionDomainError(
      "SECTION_ALREADY_SUBMITTED",
      "Cannot edit sections of a published report.",
    );
  }
}

// Optimistic-concurrency compare-and-set, run BEFORE any deleteMany so a
// conflict aborts with no child rows touched. `expectedVersion` is the
// client-loaded version threaded through the payload — NOT the freshly-fetched
// row's — so a stale writer whose row was advanced concurrently 409s.
async function bumpSectionVersion(
  tx: Prisma.TransactionClient,
  section: ReportSectionReadModel,
  sectionId: string,
  expectedVersion: number,
): Promise<void> {
  const updated = await tx.reportSection.updateMany({
    where: { id: sectionId, version: expectedVersion },
    data: {
      status: section.status,
      submittedAt: section.submittedAt,
      // Persist the late flag computed by submitSection; saveDraft / reopen
      // paths carry the prior value through mergeSection.
      late: section.late,
      version: { increment: 1 },
    },
  });
  if (updated.count === 0) {
    throw new SectionVersionConflictError(
      "This section was changed by another save. Reload and try again.",
    );
  }
}

async function recreateChildRows(
  tx: Prisma.TransactionClient,
  section: ReportSectionReadModel,
  sectionId: string,
): Promise<void> {
  const projectData = toProjectStatusRows(section, sectionId);
  if (projectData.length > 0) {
    await tx.projectStatus.createMany({ data: projectData });
  }

  const stageStatusData = toStageStatusRows(section, sectionId);
  if (stageStatusData.length > 0) {
    await tx.stageStatus.createMany({ data: stageStatusData });
  }

  // Mirror ProjectStatus: recreate the activity slice from the merged read
  // model. Every id here came from the seeded server-side set — mergeSection
  // folds client statuses onto section.activities and the service rejects any
  // unattached activityId before this runs.
  const activityStatusData = toActivityStatusRows(section, sectionId);
  if (activityStatusData.length > 0) {
    await tx.activityStatus.createMany({ data: activityStatusData });
  }

  if (section.items.length > 0) {
    await tx.item.createMany({ data: toItemRows(section, sectionId) });
  }

  if (section.risks.length > 0) {
    await tx.risk.createMany({ data: toRiskRows(section, sectionId) });
  }

  const decisionsToSave = section.decisions.filter(isPersistableDecision);
  if (decisionsToSave.length > 0) {
    await tx.decision.createMany({
      data: toDecisionRows(decisionsToSave, sectionId),
    });
  }
}

// Re-read INSIDE the still-open transaction (read-your-own-writes), not after
// it commits: the compare-and-set holds this transaction's row lock on THIS
// ReportSection, which a concurrent report delete's cascade also needs, so
// there is no post-commit gap for a delete to land in.
async function readBackSavedSection(
  tx: Prisma.TransactionClient,
  sectionId: string,
): Promise<ReportSectionReadModel> {
  const saved = await tx.reportSection.findUnique({
    where: { id: sectionId },
    include: reportSectionFullInclude,
  });

  if (!saved) {
    // Defensive only: this transaction holds the row lock it just used for the
    // compare-and-set, so a real DB should never reach this branch.
    throw new SectionVersionConflictError(
      "This section was changed by another save. Reload and try again.",
    );
  }

  return mapPrismaToReportSection(saved);
}

export async function applySaveSection(
  tx: Prisma.TransactionClient,
  section: ReportSectionReadModel,
  expectedVersion: number,
): Promise<ReportSectionReadModel> {
  const sectionId = section.reportSectionId;

  await lockReportForSave(tx, section.reportId);
  await bumpSectionVersion(tx, section, sectionId, expectedVersion);

  // review-acknowledgement (comment-aware save): lift reviewer comments out
  // before the child delete-recreate cascades them away, keyed by the record's
  // durable lineage (stableId + kind), then re-anchor the survivors below. A
  // comment whose record is dropped from this payload is NOT re-inserted → it
  // hard-dies with the record it flagged.
  const capturedComments = await captureRecordComments(tx, sectionId);

  await clearSectionChildRows(tx, sectionId);
  await recreateChildRows(tx, section, sectionId);
  // Atomic with the version bump above.
  await reinsertRecordComments(tx, sectionId, capturedComments);

  return readBackSavedSection(tx, sectionId);
}
