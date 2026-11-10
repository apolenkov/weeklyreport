import type { Prisma } from "@prisma/client";
import { isCompleteDecision, isCompleteRisk } from "@weeklyreport/shared";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  ReviewAccessError,
  ReviewNotFoundError,
} from "../application/review.service.js";
import type { ReviewWriteActor } from "../application/review-actions.service.js";
import {
  assertReviewEntitlement,
  lockEditableReport,
  lockReviewUsers,
} from "./review-write-gate.js";

const COMMENT_NOT_FOUND = "Comment not found.";
const COMMENT_TARGET_NOT_FOUND = "Comment target not found.";
const REVIEW_GROUP_NOT_FOUND = "Review group not found.";

const targetSectionSelect = {
  reportSection: {
    select: {
      reportId: true,
      authorId: true,
      author: { select: { reportingGroupId: true } },
    },
  },
} as const;

// Read before the locks: only what names the rows to lock.
const lockTargetSelect = {
  reviewerId: true,
  item: { select: targetSectionSelect },
  risk: { select: targetSectionSelect },
  decision: { select: targetSectionSelect },
} as const;

// Read again under the locks, now with the fields that say whether a risk or
// decision is finished.
const currentTargetSelect = {
  reviewerId: true,
  item: { select: targetSectionSelect },
  risk: { select: { ...targetSectionSelect, impact: true, mitigation: true } },
  decision: { select: { ...targetSectionSelect, impact: true } },
} as const;

type CurrentComment = Prisma.RecordCommentGetPayload<{
  select: typeof currentTargetSelect;
}>;

interface LockedTarget {
  readonly reportId: string;
  readonly groupId: string | null;
}

const isUnfinishedDraft = (comment: CurrentComment): boolean =>
  (comment.risk !== null && !isCompleteRisk(comment.risk)) ||
  (comment.decision !== null && !isCompleteDecision(comment.decision));

async function lockCommentTarget(
  tx: Prisma.TransactionClient,
  commentId: string,
  actor: ReviewWriteActor,
): Promise<LockedTarget> {
  const comment = await tx.recordComment.findUnique({
    where: { id: commentId },
    select: lockTargetSelect,
  });
  if (!comment) throw new ReviewNotFoundError(COMMENT_NOT_FOUND);
  const target = comment.item ?? comment.risk ?? comment.decision;
  if (!target) throw new ReviewNotFoundError(COMMENT_TARGET_NOT_FOUND);
  const { reportId, authorId, author } = target.reportSection;
  await lockReviewUsers(tx, [actor.userId, comment.reviewerId, authorId]);
  await lockEditableReport(tx, reportId);
  return { reportId, groupId: author.reportingGroupId };
}

async function readCurrentComment(
  tx: Prisma.TransactionClient,
  commentId: string,
  locked: LockedTarget,
): Promise<CurrentComment & { readonly authorId: string }> {
  const current = await tx.recordComment.findUnique({
    where: { id: commentId },
    select: currentTargetSelect,
  });
  if (!current) throw new ReviewNotFoundError(COMMENT_NOT_FOUND);
  const section = (current.item ?? current.risk ?? current.decision)
    ?.reportSection;
  if (section?.reportId !== locked.reportId) {
    throw new ReviewNotFoundError(COMMENT_TARGET_NOT_FOUND);
  }
  if (section.author.reportingGroupId !== locked.groupId) {
    throw new ReviewNotFoundError(REVIEW_GROUP_NOT_FOUND);
  }
  return { ...current, authorId: section.authorId };
}

/**
 * Deletes a review comment under the same User → Report lock order as the
 * section save. A comment on an unfinished risk or decision belongs to the
 * author's private draft (openspec: record-comment-save-coordination): to
 * anyone else it is not found — its own writer, a head and an admin included —
 * until the author finishes the record.
 */
export function deleteCoordinatedComment(
  prisma: PrismaService,
  commentId: string,
  actor: ReviewWriteActor,
): Promise<void> {
  return prisma.$transaction(async (tx) => {
    const locked = await lockCommentTarget(tx, commentId, actor);
    const current = await readCurrentComment(tx, commentId, locked);
    if (isUnfinishedDraft(current) && actor.userId !== current.authorId) {
      throw new ReviewNotFoundError(COMMENT_NOT_FOUND);
    }
    const { groupId } = locked;
    if (!groupId) throw new ReviewNotFoundError(REVIEW_GROUP_NOT_FOUND);
    await assertReviewEntitlement(tx, actor, groupId);
    const allowed =
      actor.role === "admin" ||
      actor.userId === current.reviewerId ||
      (actor.role === "head" && actor.reportingGroupId === groupId);
    if (!allowed) {
      throw new ReviewAccessError(
        "You can only delete your own review comment.",
      );
    }
    await tx.recordComment.delete({ where: { id: commentId } });
  });
}
