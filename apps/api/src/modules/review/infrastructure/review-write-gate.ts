import type { Prisma } from "@prisma/client";

import { lockCurrentEditableReport } from "../../../lib/report-lifecycle.js";
import { lockUser } from "../../../lib/user-activity-assignment.js";
import {
  ReviewAccessError,
  ReviewConstraintError,
  ReviewNotFoundError,
} from "../application/review.service.js";
import type { ReviewWriteActor } from "../application/review-actions.service.js";

/** Lock and validate the live report before any review-side write. */
export async function lockEditableReport(
  tx: Prisma.TransactionClient,
  reportId: string,
): Promise<void> {
  const gate = await lockCurrentEditableReport(tx, { reportId });
  if (gate.kind === "not-found") {
    throw new ReviewNotFoundError("Report not found.");
  }
  if (gate.kind === "inconsistent" || gate.kind === "not-editable") {
    throw new ReviewConstraintError("This report is not editable.");
  }
}

/** Re-check current group access for a group-level acknowledgement. */
export async function assertAcknowledgementAccess(
  tx: Prisma.TransactionClient,
  actor: ReviewWriteActor,
  groupId: string,
): Promise<void> {
  const user = await tx.user.findUnique({
    where: { id: actor.userId },
    select: {
      isActive: true,
      role: true,
      reportingGroupId: true,
      viewerGroupAccess: {
        where: { groupId },
        select: { groupId: true },
      },
    },
  });
  if (!user) throw new ReviewAccessError("Reviewer no longer exists.");
  const allowed =
    user.isActive &&
    (user.role === "admin" ||
      (user.role === "head" && user.reportingGroupId === groupId) ||
      (user.role === "viewer" && user.viewerGroupAccess.length > 0));
  if (!allowed) {
    throw new ReviewAccessError(
      "You no longer have access to this group's report.",
    );
  }
}

/** Re-check the actor's current database entitlement inside the same tx. */
export function assertReviewEntitlement(
  tx: Prisma.TransactionClient,
  actor: ReviewWriteActor,
  groupId: string,
): Promise<void> {
  return assertReviewEntitlementByUserId(tx, actor.userId, groupId);
}

/** Re-check a reviewer's current database entitlement inside the same tx. */
export async function assertReviewEntitlementByUserId(
  tx: Prisma.TransactionClient,
  userId: string,
  groupId: string,
): Promise<void> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      isActive: true,
      role: true,
      reportingGroupId: true,
      viewerGroupAccess: {
        where: { groupId },
        select: { canReview: true },
      },
    },
  });
  if (!user) throw new ReviewAccessError("Reviewer no longer exists.");
  const allowed =
    user.isActive &&
    (user.role === "admin" ||
      (user.role === "head" && user.reportingGroupId === groupId) ||
      (user.role === "viewer" &&
        user.viewerGroupAccess[0]?.canReview === true));
  if (!allowed) {
    throw new ReviewAccessError(
      "You are no longer a designated reviewer for this group.",
    );
  }
}

/**
 * Lock every user participating in a review write in one stable order.
 * Review writers therefore use the global User -> Report lock order.
 */
export async function lockReviewUsers(
  tx: Prisma.TransactionClient,
  userIds: readonly (string | null | undefined)[],
): Promise<void> {
  const ids = [
    ...new Set(
      userIds.filter((id): id is string => id !== null && id !== undefined),
    ),
  ].sort((left, right) => left.localeCompare(right));
  for (const userId of ids) {
    if (!(await lockUser(tx, userId))) {
      throw new ReviewNotFoundError("Review participant not found.");
    }
  }
}
