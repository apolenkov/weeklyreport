import { z } from "zod";

import {
  recordCommentViewSchema,
  reviewCommentTextSchema,
} from "./review.schema.js";

/** A Lead may write only to an item, under the authenticated identity. */
export const leadItemCommentInputSchema = z
  .strictObject({ itemId: z.uuid(), text: reviewCommentTextSchema })
  .readonly();

/** Strict item-only Lead reply command. */
export type LeadItemCommentInput = z.infer<typeof leadItemCommentInputSchema>;

/** Selects one own item discussion by section and stable lineage. */
export const leadItemDiscussionInputSchema = z
  .strictObject({ reportSectionId: z.uuid(), stableId: z.uuid() })
  .readonly();

/** Own-Lead discussion read input. */
export type LeadItemDiscussionInput = z.infer<
  typeof leadItemDiscussionInputSchema
>;

/**
 * One coherent read of an own item discussion. Every denial is the same
 * "unavailable" answer, without target details.
 */
export const leadItemDiscussionViewSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("available"),
      comments: z.array(recordCommentViewSchema).readonly(),
    })
    .readonly(),
  z.object({ status: z.literal("unavailable") }).readonly(),
]);

/** Own-Lead discussion read result. */
export type LeadItemDiscussionView = z.infer<
  typeof leadItemDiscussionViewSchema
>;
