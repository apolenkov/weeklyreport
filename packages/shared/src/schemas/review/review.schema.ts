import { z } from "zod";

import { safeText } from "../primitives/report-primitives.schema";

/** Maximum length accepted for a review comment. */
export const REVIEW_COMMENT_MAX_LENGTH = 2000;

/** Section verdict; requesting changes returns a submitted section to draft. */
const reviewVerdictSchema = z.enum(["approved", "changes_requested"]);

/** Validates a flat review comment rendered at its record anchor. */
export const recordCommentViewSchema = z
  .object({
    id: z.uuid(),
    reviewerId: z.uuid(),
    reviewerName: z.string().min(1).optional(),
    text: z.string().min(1),
    createdAt: z.coerce.date(),
  })
  .readonly();

/** Validates a section verdict with its judged version and derived currency flag. */
export const sectionReviewViewSchema = z
  .object({
    reviewerId: z.uuid(),
    reviewerName: z.string().min(1).optional(),
    verdict: reviewVerdictSchema,
    judgedVersion: z.number().int().min(1),
    /** Reviewer reason recorded with `changes_requested`; absent otherwise. */
    comment: z.string().min(1).optional(),
    isCurrent: z.boolean(),
    createdAt: z.coerce.date(),
  })
  .readonly();

/** Validates a group-level acknowledgement command. */
export const reviewAcknowledgeInputSchema = z
  .object({
    reportId: z.uuid(),
    groupId: z.uuid(),
  })
  .readonly();

/** Validates acknowledgement-list scope for one report group. */
export const reviewListAcknowledgementsInputSchema = z
  .object({
    reportId: z.uuid(),
    groupId: z.uuid(),
  })
  .readonly();

/** Validates a comment anchored to exactly one item, risk, or decision. */
export const reviewCommentInputSchema = z
  .object({
    itemId: z.uuid().optional(),
    riskId: z.uuid().optional(),
    decisionId: z.uuid().optional(),
    text: safeText({ max: REVIEW_COMMENT_MAX_LENGTH }),
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
  })
  .readonly();

/** Validates deletion of one anchored review comment. */
export const reviewDeleteCommentInputSchema = z
  .object({
    commentId: z.uuid(),
  })
  .readonly();

/** Validates a version-bound verdict command for one section. */
export const reviewVerdictInputSchema = z
  .object({
    reportSectionId: z.uuid(),
    verdict: reviewVerdictSchema,
    // Optimistic-concurrency expected version: the ReportSection.version the
    // reviewer judged. Guards the auto-un-submit so concurrent verdicts (or a
    // race with the head's revoke) transition exactly once.
    version: z.number().int().min(1),
    // Mandatory reason for changes_requested; forbidden for approved.
    // Trimmed before the non-empty check so padding alone never counts.
    comment: z
      .string()
      .trim()
      .pipe(safeText({ max: REVIEW_COMMENT_MAX_LENGTH }))
      .optional(),
  })
  .superRefine((value, ctx) => {
    const requested = value.verdict === "changes_requested";
    if (requested && value.comment === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["comment"],
        message: "Requesting changes requires a comment.",
      });
    }
    if (!requested && value.comment !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["comment"],
        message: "Only a changes request may carry a comment.",
      });
    }
  })
  .readonly();

/** Validates the read receipt recorded for a report group. */
export const reviewAcknowledgementViewSchema = z
  .object({
    userId: z.uuid(),
    userName: z.string().min(1).optional(),
    reportId: z.uuid(),
    groupId: z.uuid(),
    seenAt: z.coerce.date(),
  })
  .readonly();

/** Validates the recorded verdict and whether it returned the section to draft. */
export const reviewVerdictResultSchema = z
  .object({
    verdict: reviewVerdictSchema,
    judgedVersion: z.number().int().min(1),
    // true only when this verdict actually flipped a submitted section back to
    // draft; false for `approved` or a `changes_requested` on an already-draft
    // section (verdict recorded, no transition applied).
    unsubmitted: z.boolean(),
  })
  .readonly();

/** Verdict values accepted for a submitted section. */
export type ReviewVerdict = z.infer<typeof reviewVerdictSchema>;
/** Flat reviewer comment anchored to one report record. */
export type RecordCommentView = z.infer<typeof recordCommentViewSchema>;
/** Section verdict tied to a judged version and derived currency state. */
export type SectionReviewView = z.infer<typeof sectionReviewViewSchema>;
/** Command creating a comment at exactly one item, risk, or decision anchor. */
export type ReviewCommentInput = z.infer<typeof reviewCommentInputSchema>;
/** User read receipt for one report and reporting group. */
export type ReviewAcknowledgementView = z.infer<
  typeof reviewAcknowledgementViewSchema
>;
/** Applied verdict plus whether the section returned to draft. */
export type ReviewVerdictResult = z.infer<typeof reviewVerdictResultSchema>;
