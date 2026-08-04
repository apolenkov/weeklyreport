import type {
  RecordCommentView,
  ReviewAcknowledgementView,
} from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import type {
  PostVerdictParams,
  RecordAnchor,
  ReviewActionsRepository,
  VerdictContext,
} from "../application/review-actions.service.js";
import { insertCoordinatedComment } from "./review-actions.comment-write.js";
import { writeVerdict } from "./review-actions.verdict-write.js";

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

@Injectable()
export class ReviewActionsPrismaRepository implements ReviewActionsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async acknowledge(
    userId: string,
    reportId: string,
    groupId: string,
  ): Promise<ReviewAcknowledgementView> {
    const ack = await this.prisma.reviewAcknowledgement.upsert({
      where: { userId_reportId_groupId: { userId, reportId, groupId } },
      create: { userId, reportId, groupId },
      // Explicit so @updatedAt refreshes the receipt on a re-acknowledge.
      update: { seenAt: new Date() },
      select: { userId: true, reportId: true, groupId: true, seenAt: true },
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
    reviewerId: string,
    anchor: RecordAnchor,
    text: string,
  ): Promise<RecordCommentView> {
    return insertCoordinatedComment(this.prisma, reviewerId, anchor, text);
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

  async deleteComment(commentId: string): Promise<void> {
    await this.prisma.recordComment.delete({ where: { id: commentId } });
  }

  async getVerdictContext(sectionId: string): Promise<VerdictContext | null> {
    const section = await this.prisma.reportSection.findUnique({
      where: { id: sectionId },
      select: {
        status: true,
        author: { select: { reportingGroupId: true } },
        report: { select: { periodStatus: true, archived: true } },
      },
    });
    if (!section) return null;
    return {
      status: section.status,
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
