import { z } from "zod";

import { safeText } from "./report-primitives.schema";

// The per-section verdict. `approved` leaves the section submitted;
// `changes_requested` auto-un-submits a submitted section.
export const reviewVerdictSchema = z.enum(["approved", "changes_requested"]);

// ---------------------------------------------------------------------------
// Read-model view schemas — embedded in the section read model so a reviewer /
// lead read carries the feedback. Kept here (not in section.schema) so the
// verdict enum has one home; section.schema imports these.
// ---------------------------------------------------------------------------

// A reviewer comment as surfaced on its anchor record. Flat, no threads. The
// author's display name rides along when the read path joins it.
export const recordCommentViewSchema = z.object({
  id: z.uuid(),
  reviewerId: z.uuid(),
  reviewerName: z.string().min(1).optional(),
  text: z.string().min(1),
  createdAt: z.coerce.date(),
});

// A per-section verdict as surfaced on the section. `isCurrent` is DERIVED at
// read time (`judgedVersion === section.version`): a re-submission bumps the
// section version, so a prior verdict reads stale with no clearing step.
export const sectionReviewViewSchema = z.object({
  reviewerId: z.uuid(),
  reviewerName: z.string().min(1).optional(),
  verdict: reviewVerdictSchema,
  judgedVersion: z.number().int().min(1),
  isCurrent: z.boolean(),
  createdAt: z.coerce.date(),
});

// ---------------------------------------------------------------------------
// Procedure input schemas.
// ---------------------------------------------------------------------------

export const reviewAcknowledgeInputSchema = z.object({
  reportId: z.uuid(),
  groupId: z.uuid(),
});

export const reviewListAcknowledgementsInputSchema = z.object({
  reportId: z.uuid(),
  groupId: z.uuid(),
});

// A comment anchors to EXACTLY ONE concrete record. The superRefine is the
// primary gate (mirrored by a DB CHECK as defence-in-depth).
export const reviewCommentInputSchema = z
  .object({
    itemId: z.uuid().optional(),
    riskId: z.uuid().optional(),
    decisionId: z.uuid().optional(),
    text: safeText({ max: 2000 }),
  })
  .superRefine((value, ctx) => {
    const anchors = [value.itemId, value.riskId, value.decisionId].filter(
      (anchor) => anchor !== undefined,
    );
    if (anchors.length !== 1) {
      ctx.addIssue({
        code: "custom",
        message:
          "A comment must anchor to exactly one of itemId, riskId, or decisionId.",
      });
    }
  });

export const reviewDeleteCommentInputSchema = z.object({
  commentId: z.uuid(),
});

export const reviewVerdictInputSchema = z.object({
  reportSectionId: z.uuid(),
  verdict: reviewVerdictSchema,
  // Optimistic-concurrency expected version: the ReportSection.version the
  // reviewer judged. Guards the auto-un-submit so concurrent verdicts (or a
  // race with the head's revoke) transition exactly once.
  version: z.number().int().min(1),
});

// ---------------------------------------------------------------------------
// Procedure output schemas.
// ---------------------------------------------------------------------------

export const reviewAcknowledgementViewSchema = z.object({
  userId: z.uuid(),
  userName: z.string().min(1).optional(),
  reportId: z.uuid(),
  groupId: z.uuid(),
  seenAt: z.coerce.date(),
});

export const reviewVerdictResultSchema = z.object({
  verdict: reviewVerdictSchema,
  judgedVersion: z.number().int().min(1),
  // true only when this verdict actually flipped a submitted section back to
  // draft; false for `approved` or a `changes_requested` on an already-draft
  // section (verdict recorded, no transition applied).
  unsubmitted: z.boolean(),
});

export type ReviewVerdict = z.infer<typeof reviewVerdictSchema>;
export type RecordCommentView = z.infer<typeof recordCommentViewSchema>;
export type SectionReviewView = z.infer<typeof sectionReviewViewSchema>;
export type ReviewAcknowledgeInput = z.infer<
  typeof reviewAcknowledgeInputSchema
>;
export type ReviewCommentInput = z.infer<typeof reviewCommentInputSchema>;
export type ReviewDeleteCommentInput = z.infer<
  typeof reviewDeleteCommentInputSchema
>;
export type ReviewVerdictInput = z.infer<typeof reviewVerdictInputSchema>;
export type ReviewAcknowledgementView = z.infer<
  typeof reviewAcknowledgementViewSchema
>;
export type ReviewVerdictResult = z.infer<typeof reviewVerdictResultSchema>;
