import {
  mapPrismaToReportSection,
  reportSectionFullInclude,
} from "@customreport/report-persistence";
import { type ReportSectionReadModel } from "@customreport/shared";
import type { Prisma } from "@prisma/client";

import { lockCurrentEditableReport } from "../../../lib/report-lifecycle.js";
import { lockStatusGraph } from "../../../lib/status-graph-lock.js";
import { PeriodLifecycleIntegrityError } from "../../period/index.js";
import {
  ReportSectionDomainError,
  ReportSectionNotFoundError,
  SectionVersionConflictError,
} from "../application/report-sections.service";
import {
  captureRecordComments,
  reinsertRecordComments,
} from "./report-sections.save-lineage";
import {
  assertPersistableDecisionParents,
  clearSectionChildRows,
  toActivityStatusRows,
  toDecisionRows,
  toItemRows,
  toProjectStatusRows,
  toRiskRows,
  toStageStatusRows,
} from "./save-section.derive";

// Publish/save mutual exclusion: lock the parent report row FIRST (same lock
// order as the publish tx — consistent ordering, no deadlock). A concurrent
// publish either committed already (save fails closed) or blocks until commit.
async function lockReportForSave(
  tx: Prisma.TransactionClient,
  reportId: string,
): Promise<void> {
  const gate = await lockCurrentEditableReport(tx, { reportId });
  // No row means the report was deleted between the precheck and this
  // transaction — the resource is gone, not period-locked, so it must surface
  // as NOT_FOUND rather than a period-state constraint.
  if (gate.kind === "not-found") {
    throw new ReportSectionNotFoundError("The report no longer exists.");
  }
  if (gate.kind === "inconsistent") throw new PeriodLifecycleIntegrityError();
  if (gate.kind === "not-editable") {
    throw new ReportSectionDomainError(
      "SECTION_ALREADY_SUBMITTED",
      "Cannot edit sections of a published report.",
    );
  }
}

// Optimistic-concurrency compare-and-set, run BEFORE any deleteMany so a
// conflict aborts with no child rows touched. `expectedVersion` is the
// client-loaded version, NOT the freshly-fetched row's, so a stale writer 409s.
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
  // model. Every id came from the seeded server-side set — mergeSection folds
  // client statuses onto section.activities; the service rejects unattached ids.
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

  // XOR parent enforced here, not just in the write schema: a read-model
  // decision carrying both (or neither) parent must fail the persist loudly,
  // never reach the DB CHECK as a raw constraint error.
  assertPersistableDecisionParents(section.decisions);
  const decisionsToSave = section.decisions;
  if (decisionsToSave.length > 0) {
    await tx.decision.createMany({
      data: toDecisionRows(decisionsToSave, sectionId),
    });
  }
}

// Re-read INSIDE the still-open transaction (read-your-own-writes), not after
// commit: the compare-and-set holds this tx's row lock on the section, which a
// concurrent report-delete cascade also needs — no post-commit gap for a delete.
async function readBackSavedSection(
  tx: Prisma.TransactionClient,
  sectionId: string,
): Promise<ReportSectionReadModel> {
  const saved = await tx.reportSection.findUnique({
    where: { id: sectionId },
    include: reportSectionFullInclude,
    relationLoadStrategy: "join",
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
  await lockStatusGraph(tx);
  const sectionId = section.reportSectionId;

  await lockReportForSave(tx, section.reportId);
  await bumpSectionVersion(tx, section, sectionId, expectedVersion);

  // Comment-aware save: lift reviewer comments out before the child
  // delete-recreate cascades them away, keyed by the record's durable lineage
  // (stableId + kind), then re-anchor survivors. Dropped records die with them.
  const capturedComments = await captureRecordComments(tx, sectionId);

  await clearSectionChildRows(tx, sectionId);
  await recreateChildRows(tx, section, sectionId);
  // Atomic with the version bump above.
  await reinsertRecordComments(tx, sectionId, capturedComments);

  return readBackSavedSection(tx, sectionId);
}
