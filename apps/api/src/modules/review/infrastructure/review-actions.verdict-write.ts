import type { Prisma } from "@prisma/client";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { applyRevokeTransition } from "../../report-sections/index.js";
import {
  ReviewConstraintError,
  ReviewNotFoundError,
  ReviewVersionConflictError,
} from "../application/review.service.js";
import type { PostVerdictParams } from "../application/review-actions.service.js";

async function assertPeriodEditable(
  tx: Prisma.TransactionClient,
  sectionId: string,
): Promise<void> {
  const gate = await tx.$queryRaw<
    { periodStatus: string; archived: boolean }[]
  >`SELECT report."periodStatus", report."archived"
        FROM "Report" AS report
        INNER JOIN "ReportSection" AS section
          ON section."reportId" = report."id"
        WHERE section."id" = ${sectionId}
        FOR UPDATE OF report`;
  const gateRow = gate[0];
  // A missing row means the section was deleted between the precheck and
  // this transaction — NOT_FOUND, not a period-state constraint.
  if (gateRow === undefined) {
    throw new ReviewNotFoundError(
      "The section no longer exists; a verdict cannot be recorded.",
    );
  }
  // The archive transition leaves periodStatus untouched, so the in-tx
  // gate must re-check `archived` too — same predicate as
  // isEditablePeriod on the authz path.
  if (
    gateRow.archived ||
    (gateRow.periodStatus !== "open" && gateRow.periodStatus !== "reopened")
  ) {
    throw new ReviewConstraintError(
      "This period is not editable; a verdict cannot be recorded.",
    );
  }
}

// Version lock as a guarded WRITE, not a plain read: the no-op update row-locks
// the section, so a concurrent re-submit either committed first (zero rows) or
// blocks; a zero-row match rejects the verdict and the tx rolls back.
async function lockSectionVersion(
  tx: Prisma.TransactionClient,
  sectionId: string,
  expectedVersion: number,
): Promise<void> {
  const { count } = await tx.reportSection.updateMany({
    where: { id: sectionId, version: expectedVersion },
    data: { version: expectedVersion },
  });
  if (count === 0) {
    throw new ReviewVersionConflictError(
      "The section changed since you opened it; reload and re-decide.",
    );
  }
}

async function upsertVerdict(
  tx: Prisma.TransactionClient,
  params: PostVerdictParams,
): Promise<void> {
  await tx.sectionReview.upsert({
    where: {
      reportSectionId_reviewerId: {
        reportSectionId: params.sectionId,
        reviewerId: params.reviewerId,
      },
    },
    create: {
      reportSectionId: params.sectionId,
      reviewerId: params.reviewerId,
      verdict: params.verdict,
      judgedVersion: params.expectedVersion,
    },
    update: {
      verdict: params.verdict,
      judgedVersion: params.expectedVersion,
    },
  });
}

// changes_requested un-submits a still-submitted section by REUSING the head's
// revoke transition; the version guard adds the optimistic lock, and the
// transition is atomic with the verdict upsert (transitions once).
async function unsubmitOnChangesRequested(
  tx: Prisma.TransactionClient,
  params: PostVerdictParams,
): Promise<boolean> {
  if (
    params.verdict !== "changes_requested" ||
    params.currentStatus !== "submitted"
  ) {
    return false;
  }
  const count = await applyRevokeTransition(
    tx,
    params.sectionId,
    params.reviewerId,
    params.expectedVersion,
  );
  return count > 0;
}

export function writeVerdict(
  prisma: PrismaService,
  params: PostVerdictParams,
): Promise<{ unsubmitted: boolean }> {
  return prisma.$transaction(async (tx) => {
    await assertPeriodEditable(tx, params.sectionId);
    await lockSectionVersion(tx, params.sectionId, params.expectedVersion);
    await upsertVerdict(tx, params);
    return { unsubmitted: await unsubmitOnChangesRequested(tx, params) };
  });
}
