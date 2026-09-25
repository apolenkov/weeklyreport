import {
  type PeriodStatus,
  type RecordCommentView,
  recordCommentViewSchema,
  type ReviewAcknowledgementView,
  reviewAcknowledgementViewSchema,
  type ReviewCommentInput,
  type ReviewVerdict,
  type ReviewVerdictResult,
  reviewVerdictResultSchema,
} from "@customreport/shared";

import {
  isDesignatedReviewer,
  isEditablePeriod,
  type ReviewSession,
  scopeCoversGroup,
} from "../domain/review-authz.js";
import {
  ReviewAccessError,
  ReviewConstraintError,
  ReviewNotFoundError,
} from "./review.service.js";

// A comment's single record anchor (exactly one set; the shared Zod input
// enforces that before this layer).
export interface RecordAnchor {
  readonly itemId?: string;
  readonly riskId?: string;
  readonly decisionId?: string;
}

export type ReviewWriteActor = Pick<
  ReviewSession,
  "userId" | "role" | "reportingGroupId"
>;

// Section facts a verdict reads — owning group and period lifecycle.
export interface VerdictContext {
  readonly groupId: string | null;
  readonly periodStatus: PeriodStatus;
  readonly archived: boolean;
}

export interface PostVerdictParams {
  readonly sectionId: string;
  readonly reviewerId: string;
  readonly verdict: ReviewVerdict;
  // The client-loaded version drives both the optimistic lock and the version
  // stamped on the verdict, so a stale judgement can never be persisted.
  readonly expectedVersion: number;
}

export interface ReviewActionsRepository {
  acknowledge(
    actor: ReviewWriteActor,
    reportId: string,
    groupId: string,
  ): Promise<ReviewAcknowledgementView>;
  listAcknowledgements(
    reportId: string,
    groupId: string,
  ): Promise<ReviewAcknowledgementView[]>;
  getRecordAnchorGroup(
    anchor: RecordAnchor,
  ): Promise<{ groupId: string | null } | null>;
  getViewerCanReview(userId: string, groupId: string): Promise<boolean>;
  insertComment(
    actor: ReviewWriteActor,
    anchor: RecordAnchor,
    text: string,
  ): Promise<RecordCommentView>;
  getCommentContext(
    commentId: string,
  ): Promise<{ reviewerId: string; groupId: string | null } | null>;
  deleteComment(commentId: string, actor: ReviewWriteActor): Promise<void>;
  getVerdictContext(sectionId: string): Promise<VerdictContext | null>;
  postVerdict(params: PostVerdictParams): Promise<{ unsubmitted: boolean }>;
}

// DI token binding the ReviewActionsRepository port to its adapter at the
// module boundary — the service depends on the port, not the prisma class.
export const REVIEW_ACTIONS_REPOSITORY = Symbol("ReviewActionsRepository");

function toAnchor(input: ReviewCommentInput): RecordAnchor {
  return {
    ...(input.itemId === undefined ? {} : { itemId: input.itemId }),
    ...(input.riskId === undefined ? {} : { riskId: input.riskId }),
    ...(input.decisionId === undefined ? {} : { decisionId: input.decisionId }),
  };
}

// Router owns leadership-chain authz; this service enforces per-group scope
// and reviewer designation on the write surface.
export class ReviewActionsService {
  constructor(private readonly repository: ReviewActionsRepository) {}

  async acknowledge(
    session: ReviewSession,
    input: { reportId: string; groupId: string },
  ): Promise<ReviewAcknowledgementView> {
    this.assertScope(session, input.groupId);
    const ack = await this.repository.acknowledge(
      session,
      input.reportId,
      input.groupId,
    );
    return reviewAcknowledgementViewSchema.parse(ack);
  }

  async listAcknowledgements(
    session: ReviewSession,
    input: { reportId: string; groupId: string },
  ): Promise<ReviewAcknowledgementView[]> {
    this.assertScope(session, input.groupId);
    const acks = await this.repository.listAcknowledgements(
      input.reportId,
      input.groupId,
    );
    return reviewAcknowledgementViewSchema.array().parse(acks);
  }

  async comment(
    session: ReviewSession,
    input: ReviewCommentInput,
  ): Promise<RecordCommentView> {
    const anchor = toAnchor(input);
    const context = await this.repository.getRecordAnchorGroup(anchor);
    if (!context) {
      throw new ReviewNotFoundError("Record not found.");
    }
    await this.assertReviewer(session, context.groupId);
    const comment = await this.repository.insertComment(
      session,
      anchor,
      input.text,
    );
    return recordCommentViewSchema.parse(comment);
  }

  async deleteComment(
    session: ReviewSession,
    input: { commentId: string },
  ): Promise<{ success: true }> {
    const context = await this.repository.getCommentContext(input.commentId);
    if (!context) {
      throw new ReviewNotFoundError("Comment not found.");
    }
    // Author may delete their own comment; admin deletes anywhere; the head of
    // the comment's group deletes any comment in their group. A plain
    // designated reviewer must not delete another reviewer's comment.
    const isAuthor = session.userId === context.reviewerId;
    const isGroupHead =
      session.role === "head" &&
      context.groupId !== null &&
      session.reportingGroupId === context.groupId;
    if (session.role !== "admin" && !isAuthor && !isGroupHead) {
      throw new ReviewAccessError(
        "You can only delete your own review comment.",
      );
    }
    await this.repository.deleteComment(input.commentId, session);
    return { success: true };
  }

  async verdict(
    session: ReviewSession,
    input: { reportSectionId: string; verdict: ReviewVerdict; version: number },
  ): Promise<ReviewVerdictResult> {
    const context = await this.repository.getVerdictContext(
      input.reportSectionId,
    );
    if (!context) {
      throw new ReviewNotFoundError("Section not found.");
    }
    await this.assertReviewer(session, context.groupId);
    if (!isEditablePeriod(context)) {
      throw new ReviewConstraintError(
        "This period is not editable; a verdict cannot be recorded.",
      );
    }
    const { unsubmitted } = await this.repository.postVerdict({
      sectionId: input.reportSectionId,
      reviewerId: session.userId,
      verdict: input.verdict,
      expectedVersion: input.version,
    });
    return reviewVerdictResultSchema.parse({
      verdict: input.verdict,
      judgedVersion: input.version,
      unsubmitted,
    });
  }

  private assertScope(session: ReviewSession, groupId: string): void {
    if (!scopeCoversGroup(session, groupId)) {
      throw new ReviewAccessError(
        "You do not have access to this group's report.",
      );
    }
  }

  private async assertReviewer(
    session: ReviewSession,
    groupId: string | null,
  ): Promise<void> {
    // Admin is a reviewer everywhere (even a group-less section). Otherwise a
    // group is required: head of THAT group is implicit; a viewer's designation
    // lives on the ViewerGroupAccess row for THAT group (`canReview`).
    if (session.role === "admin") return;
    const canReviewFlag =
      groupId !== null && session.role === "viewer"
        ? await this.repository.getViewerCanReview(session.userId, groupId)
        : false;
    if (
      groupId === null ||
      !isDesignatedReviewer(session, groupId, canReviewFlag)
    ) {
      throw new ReviewAccessError(
        "You are not a designated reviewer for this group.",
      );
    }
  }
}
