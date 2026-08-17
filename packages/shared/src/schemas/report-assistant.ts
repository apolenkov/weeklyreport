import { z } from "zod";

import { searchPlanSchema } from "./report-assistant-search-plan";
import { safeText } from "./report-primitives.schema";

const MAX_RESOLUTION_TOKENS = 20;

const providerRateLimitSchema = z
  .object({ retryAfterSeconds: z.number().int().nonnegative() })
  .strict();

export const sourceCitationSchema = z
  .object({
    sourceId: z.string().regex(/^S[1-9]\d*$/u),
    reportId: z.uuid(),
    periodLabel: z.string(),
    authorName: z.string(),
    subjectName: z.string(),
    recordKind: z.string(),
  })
  .strict();

export const reportAssistantRequestSchema = z
  .object({
    question: safeText({ min: 1, max: 2000 }),
    resolutionTokens: z
      .array(safeText({ max: 2000 }))
      .max(MAX_RESOLUTION_TOKENS),
  })
  .strict();

export const clarificationOptionSchema = z
  .object({
    label: z.string().min(1),
    token: safeText({ max: 2000 }),
  })
  .strict();

export const answerMetadataSchema = z
  .object({
    truncated: z.boolean(),
    insufficientEvidence: z.boolean(),
  })
  .strict();

const okOutcomeSchema = z
  .object({
    kind: z.literal("ok"),
    answerMarkdown: z.string(),
    citations: z.array(sourceCitationSchema),
    metadata: answerMetadataSchema,
  })
  .strict();

export const reportAssistantOutcomeSchema = z.discriminatedUnion("kind", [
  okOutcomeSchema,
  z
    .object({
      kind: z.literal("clarification_required"),
      options: z.array(clarificationOptionSchema).min(1),
    })
    .strict(),
  z.object({ kind: z.literal("no_results") }).strict(),
  z.object({ kind: z.literal("semantic_index_pending") }).strict(),
  z
    .object({
      kind: z.literal("provider_unavailable"),
      rateLimit: providerRateLimitSchema.optional(),
    })
    .strict(),
  z.object({ kind: z.literal("result_set_too_large") }).strict(),
  z.object({ kind: z.literal("invalid_plan") }).strict(),
  z.object({ kind: z.literal("ai_not_configured") }).strict(),
]);

export const searchReportEntriesToolInputSchema = searchPlanSchema;
export type ReportAssistantRequest = z.infer<
  typeof reportAssistantRequestSchema
>;
export type ReportAssistantOutcome = z.infer<
  typeof reportAssistantOutcomeSchema
>;
export type ClarificationOption = z.infer<typeof clarificationOptionSchema>;
export type SourceCitation = z.infer<typeof sourceCitationSchema>;
export type AnswerMetadata = z.infer<typeof answerMetadataSchema>;
