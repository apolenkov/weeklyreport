import { Inject, Injectable } from "@nestjs/common";
import type {
  RecordCommentView,
  ReviewAcknowledgementView,
} from "@weeklyreport/shared";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  ReviewAccessError,
  ReviewNotFoundError,
} from "../application/review.service.js";
import type {
  PostVerdictParams,
  RecordAnchor,
  ReviewActionsRepository,
  ReviewWriteActor,
  VerdictContext,
} from "../application/review-actions.service.js";
import { insertCoordinatedComment } from "./review-actions.comment-write.js";
import { writeVerdict } from "./review-actions.verdict-write.js";
import {
  assertAcknowledgementAccess,
  assertReviewEntitlement,
  lockEditableReport,
  lockReviewUsers,
} from "./review-write-gate.js";

// review-acknowledgement: the group that owns a record is its section author's
// reporting group (the same relation path `groupScopeFilter(_, 'reportSection')`
// filters on). Selected via the anchor record → section → author.
const sectionGroupSelect = {
  reportSection: { select: { author: { select: { reportingGroupId: true } } } },
} as const;

interface SectionGroupRow {
  readonly reportSection: { author: { reportingGroupId: string | null } };
}

const groupIdOf = (row: SectionGroupRow | null): string | null | undefined =>
  row === null ? undefined : row.reportSection.author.reportingGroupId;
const REVIEW_GROUP_NOT_FOUND = "Review group not found.";

const deleteTargetSelect = {
  reportSection: {
    select: {
      reportId: true,
      authorId: true,
      author: { select: { reportingGroupId: true } },
    },
  },
} as const;

const currentTargetSelect = {
  reportSection: {
    select: {
      reportId: true,
      author: { select: { reportingGroupId: true } },
    },
  },
} as const;

@Injectable()
export class ReviewActionsPrismaRepository implements ReviewActionsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async acknowledge(
    actor: ReviewWriteActor,
    reportId: string,
    groupId: string,
  ): Promise<ReviewAcknowledgementView> {
    const ack = await this.prisma.$transaction(async (tx) => {
      const section = await tx.reportSection.findFirst({
        where: { reportId, author: { reportingGroupId: groupId } },
        orderBy: { id: "asc" },
        select: { id: true, authorId: true },
      });
      if (!section) {
        throw new ReviewNotFoundError(REVIEW_GROUP_NOT_FOUND);
      }
      await lockReviewUsers(tx, [actor.userId, section.authorId]);
      await lockEditableReport(tx, reportId);
      const currentSection = await tx.reportSection.findFirst({
        where: { reportId, author: { reportingGroupId: groupId } },
        orderBy: { id: "asc" },
        select: { id: true, authorId: true },
      });
      if (currentSection?.authorId !== section.authorId) {
        throw new ReviewNotFoundError(REVIEW_GROUP_NOT_FOUND);
      }
      await assertAcknowledgementAccess(tx, actor, groupId);
      return tx.reviewAcknowledgement.upsert({
        where: {
          userId_reportId_groupId: {
            userId: actor.userId,
            reportId,
            groupId,
          },
        },
        create: { userId: actor.userId, reportId, groupId },
        // seenAt is the first view; a repeat keeps the "Seen by" order.
        update: {},
        select: { userId: true, reportId: true, groupId: true, seenAt: true },
      });
    });
    return ack;
  }

  async listAcknowledgements(
    reportId: string,
    groupId: string,
  ): Promise<ReviewAcknowledgementView[]> {
    const acks = await this.prisma.reviewAcknowledgement.findMany({
      where: { reportId, groupId },
      select: {
        userId: true,
        reportId: true,
        groupId: true,
        seenAt: true,
        user: { select: { name: true } },
      },
      orderBy: { seenAt: "desc" },
    });
    return acks.map((ack) => ({
      userId: ack.userId,
      userName: ack.user.name,
      reportId: ack.reportId,
      groupId: ack.groupId,
      seenAt: ack.seenAt,
    }));
  }

  async getRecordAnchorGroup(
    anchor: RecordAnchor,
  ): Promise<{ groupId: string | null } | null> {
    const row = await this.loadAnchorSectionGroup(anchor);
    const groupId = groupIdOf(row);
    return groupId === undefined ? null : { groupId };
  }

  private async loadAnchorSectionGroup(
    anchor: RecordAnchor,
  ): Promise<SectionGroupRow | null> {
    if (anchor.itemId !== undefined) {
      return this.prisma.item.findUnique({
        where: { id: anchor.itemId },
        select: sectionGroupSelect,
      });
    }
    if (anchor.riskId !== undefined) {
      return this.prisma.risk.findUnique({
        where: { id: anchor.riskId },
        select: sectionGroupSelect,
      });
    }
    if (anchor.decisionId === undefined) return null;
    return this.prisma.decision.findUnique({
      where: { id: anchor.decisionId },
      select: sectionGroupSelect,
    });
  }

  async getViewerCanReview(userId: string, groupId: string): Promise<boolean> {
    const row = await this.prisma.viewerGroupAccess.findUnique({
      where: { viewerUserId_groupId: { viewerUserId: userId, groupId } },
      select: { canReview: true },
    });
    return row?.canReview ?? false;
  }

  async insertComment(
    actor: ReviewWriteActor,
    anchor: RecordAnchor,
    text: string,
  ): Promise<RecordCommentView> {
    return insertCoordinatedComment(this.prisma, actor, anchor, text);
  }

  async getCommentContext(
    commentId: string,
  ): Promise<{ reviewerId: string; groupId: string | null } | null> {
    const comment = await this.prisma.recordComment.findUnique({
      where: { id: commentId },
      select: {
        reviewerId: true,
        item: { select: sectionGroupSelect },
        risk: { select: sectionGroupSelect },
        decision: { select: sectionGroupSelect },
      },
    });
    if (!comment) return null;
    const groupId = groupIdOf(
      comment.item ?? comment.risk ?? comment.decision ?? null,
    );
    return { reviewerId: comment.reviewerId, groupId: groupId ?? null };
  }

  async deleteComment(
    commentId: string,
    actor: ReviewWriteActor,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const comment = await tx.recordComment.findUnique({
        where: { id: commentId },
        select: {
          reviewerId: true,
          item: {
            select: deleteTargetSelect,
          },
          risk: {
            select: deleteTargetSelect,
          },
          decision: {
            select: deleteTargetSelect,
          },
        },
      });
      if (!comment) throw new ReviewNotFoundError("Comment not found.");
      const target = comment.item ?? comment.risk ?? comment.decision;
      if (!target) throw new ReviewNotFoundError("Comment target not found.");
      const groupId = target.reportSection.author.reportingGroupId;
      await lockReviewUsers(tx, [
        actor.userId,
        comment.reviewerId,
        target.reportSection.authorId,
      ]);
      await lockEditableReport(tx, target.reportSection.reportId);
      const current = await tx.recordComment.findUnique({
        where: { id: commentId },
        select: {
          reviewerId: true,
          item: {
            select: currentTargetSelect,
          },
          risk: {
            select: currentTargetSelect,
          },
          decision: {
            select: currentTargetSelect,
          },
        },
      });
      if (!current) throw new ReviewNotFoundError("Comment not found.");
      const currentTarget = current.item ?? current.risk ?? current.decision;
      if (
        currentTarget?.reportSection.reportId !== target.reportSection.reportId
      ) {
        throw new ReviewNotFoundError("Comment target not found.");
      }
      const currentGroupId =
        currentTarget.reportSection.author.reportingGroupId;
      if (currentGroupId !== groupId)
        throw new ReviewNotFoundError(REVIEW_GROUP_NOT_FOUND);
      if (!groupId) throw new ReviewNotFoundError(REVIEW_GROUP_NOT_FOUND);
      await assertReviewEntitlement(tx, actor, groupId);
      const allowed =
        actor.role === "admin" ||
        actor.userId === current.reviewerId ||
        (actor.role === "head" && actor.reportingGroupId === groupId);
      if (!allowed)
        throw new ReviewAccessError(
          "You can only delete your own review comment.",
        );
      await tx.recordComment.delete({ where: { id: commentId } });
    });
  }

  async getVerdictContext(sectionId: string): Promise<VerdictContext | null> {
    const section = await this.prisma.reportSection.findUnique({
      where: { id: sectionId },
      select: {
        author: { select: { reportingGroupId: true } },
        report: { select: { periodStatus: true, archived: true } },
      },
    });
    if (!section) return null;
    return {
      groupId: section.author.reportingGroupId,
      periodStatus: section.report.periodStatus,
      archived: section.report.archived,
    };
  }

  async postVerdict(
    params: PostVerdictParams,
  ): Promise<{ unsubmitted: boolean }> {
    return writeVerdict(this.prisma, params);
  }
}
