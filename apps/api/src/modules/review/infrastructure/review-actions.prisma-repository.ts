import { Inject, Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  LeadItemDiscussionInput,
  LeadItemDiscussionView,
  RecordCommentView,
  ReviewAcknowledgementView,
} from "@weeklyreport/shared";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { ReviewNotFoundError } from "../application/review.service.js";
import type {
  PostVerdictParams,
  RecordAnchor,
  ReviewActionsRepository,
  ReviewWriteActor,
  VerdictContext,
} from "../application/review-actions.service.js";
import { deleteCoordinatedComment } from "./review-actions.comment-delete.js";
import {
  insertCoordinatedComment,
  insertCoordinatedLeadItemComment,
} from "./review-actions.comment-write.js";
import { writeVerdict } from "./review-actions.verdict-write.js";
import { readLeadItemDiscussion } from "./review-lead-discussion.read.js";
import {
  assertAcknowledgementAccess,
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

// Completeness is stored as nullable details. Refuse private foreign anchors
// before group-specific errors; the locked writer still rechecks after races.
const readableRisk = (actorUserId: string): Prisma.RiskWhereInput => ({
  OR: [
    { reportSection: { authorId: actorUserId } },
    { impact: { not: null }, mitigation: { not: null } },
  ],
});
const readableDecision = (actorUserId: string): Prisma.DecisionWhereInput => ({
  OR: [{ reportSection: { authorId: actorUserId } }, { impact: { not: null } }],
});

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
    actorUserId: string,
  ): Promise<{ groupId: string | null } | null> {
    const row = await this.loadAnchorSectionGroup(anchor, actorUserId);
    const groupId = groupIdOf(row);
    return groupId === undefined ? null : { groupId };
  }

  private async loadAnchorSectionGroup(
    anchor: RecordAnchor,
    actorUserId: string,
  ): Promise<SectionGroupRow | null> {
    if (anchor.itemId !== undefined) {
      return this.prisma.item.findUnique({
        where: { id: anchor.itemId },
        select: sectionGroupSelect,
      });
    }
    if (anchor.riskId !== undefined) {
      return this.prisma.risk.findUnique({
        where: { id: anchor.riskId, AND: readableRisk(actorUserId) },
        select: sectionGroupSelect,
      });
    }
    if (anchor.decisionId === undefined) return null;
    return this.prisma.decision.findUnique({
      where: { id: anchor.decisionId, AND: readableDecision(actorUserId) },
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

  insertLeadItemComment(
    actor: ReviewWriteActor,
    itemId: string,
    text: string,
  ): Promise<RecordCommentView> {
    return insertCoordinatedLeadItemComment(this.prisma, actor, itemId, text);
  }

  readLeadItemDiscussion(
    actor: ReviewWriteActor,
    input: LeadItemDiscussionInput,
  ): Promise<LeadItemDiscussionView> {
    return readLeadItemDiscussion(this.prisma, actor, input);
  }

  async getCommentContext(
    commentId: string,
    actorUserId: string,
  ): Promise<{ reviewerId: string; groupId: string | null } | null> {
    const comment = await this.prisma.recordComment.findUnique({
      where: {
        id: commentId,
        OR: [
          { item: { isNot: null } },
          { risk: readableRisk(actorUserId) },
          { decision: readableDecision(actorUserId) },
        ],
      },
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

  deleteComment(commentId: string, actor: ReviewWriteActor): Promise<void> {
    return deleteCoordinatedComment(this.prisma, commentId, actor);
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
