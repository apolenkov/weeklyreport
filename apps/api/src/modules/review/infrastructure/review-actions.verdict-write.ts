import type { Prisma } from "@prisma/client";
import type { ReportSectionStatus } from "@weeklyreport/shared";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { applyRevokeTransition } from "../../report-sections/index.js";
import {
  ReviewConstraintError,
  ReviewNotFoundError,
  ReviewVersionConflictError,
} from "../application/review.service.js";
import type { PostVerdictParams } from "../application/review-actions.service.js";
import {
  assertReviewEntitlementByUserId,
  lockEditableReport,
  lockReviewUsers,
} from "./review-write-gate.js";

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
      comment: params.comment ?? null,
    },
    update: {
      verdict: params.verdict,
      judgedVersion: params.expectedVersion,
      // null on approval so a stale reason never outlives a later verdict.
      comment: params.comment ?? null,
    },
  });
}

// changes_requested un-submits a still-submitted section by REUSING the head's
// revoke transition; the version guard adds the optimistic lock, and the
// transition is atomic with the verdict upsert (transitions once).
async function unsubmitOnChangesRequested(
  tx: Prisma.TransactionClient,
  params: PostVerdictParams,
  currentStatus: ReportSectionStatus,
): Promise<boolean> {
  if (params.verdict !== "changes_requested" || currentStatus !== "submitted") {
    return false;
  }
  const count = await applyRevokeTransition(
    tx,
    params.sectionId,
    params.reviewerId,
    { scope: {}, expectedVersion: params.expectedVersion },
  );
  return count > 0;
}

export function writeVerdict(
  prisma: PrismaService,
  params: PostVerdictParams,
): Promise<{ unsubmitted: boolean }> {
  return prisma.$transaction(async (tx) => {
    const before = await tx.reportSection.findUnique({
      where: { id: params.sectionId },
      select: {
        reportId: true,
        authorId: true,
      },
    });
    if (!before) {
      throw new ReviewNotFoundError(
        "The section no longer exists; a verdict cannot be recorded.",
      );
    }
    await lockReviewUsers(tx, [params.reviewerId, before.authorId]);
    await lockEditableReport(tx, before.reportId);
    const section = await tx.reportSection.findUnique({
      where: { id: params.sectionId },
      select: {
        status: true,
        reportId: true,
        authorId: true,
        author: { select: { reportingGroupId: true } },
      },
    });
    if (section?.reportId !== before.reportId) {
      throw new ReviewNotFoundError(
        "The section no longer exists; a verdict cannot be recorded.",
      );
    }
    if (section.authorId !== before.authorId) {
      throw new ReviewConstraintError(
        "The section owner changed; reload and re-decide.",
      );
    }
    if (!section.author.reportingGroupId) {
      throw new ReviewNotFoundError("Review group not found.");
    }
    await assertReviewEntitlementByUserId(
      tx,
      params.reviewerId,
      section.author.reportingGroupId,
    );
    await lockSectionVersion(tx, params.sectionId, params.expectedVersion);
    await upsertVerdict(tx, params);
    return {
      unsubmitted: await unsubmitOnChangesRequested(tx, params, section.status),
    };
  });
}
