import { Prisma } from "@prisma/client";
import type {
  LeadItemDiscussionInput,
  LeadItemDiscussionView,
} from "@weeklyreport/shared";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { editableReportLifecycleWhere } from "../../../lib/report-lifecycle.js";
import type { ReviewWriteActor } from "../application/review-actions.service.js";

const UNAVAILABLE = { status: "unavailable" } as const;

const commentSelect = {
  id: true,
  reviewerId: true,
  text: true,
  createdAt: true,
  reviewer: { select: { name: true } },
} as const;

/**
 * Reads one own-Lead item discussion in a single repeatable-read snapshot:
 * active Lead, own section, editable report lifecycle, the lineage's current
 * item and its comments ordered by time and id. Read-only: it takes no write
 * fence, creates nothing and returns no whole section. Every logical denial is
 * the same "unavailable" answer; storage failures propagate as errors.
 */
export function readLeadItemDiscussion(
  prisma: PrismaService,
  actor: ReviewWriteActor,
  input: LeadItemDiscussionInput,
): Promise<LeadItemDiscussionView> {
  return prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: actor.userId },
        select: { isActive: true, role: true },
      });
      if (!user?.isActive || user.role !== "lead") return UNAVAILABLE;
      const section = await tx.reportSection.findFirst({
        where: {
          id: input.reportSectionId,
          authorId: actor.userId,
          report: editableReportLifecycleWhere(),
        },
        select: { id: true },
      });
      if (!section) return UNAVAILABLE;
      const item = await tx.item.findUnique({
        where: {
          reportSectionId_stableId: {
            reportSectionId: section.id,
            stableId: input.stableId,
          },
        },
        select: {
          recordComments: {
            select: commentSelect,
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      });
      if (!item) return UNAVAILABLE;
      return {
        status: "available",
        comments: item.recordComments.map((comment) => ({
          id: comment.id,
          reviewerId: comment.reviewerId,
          reviewerName: comment.reviewer.name,
          text: comment.text,
          createdAt: comment.createdAt,
        })),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
