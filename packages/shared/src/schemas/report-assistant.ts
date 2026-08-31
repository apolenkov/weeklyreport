import { z } from "zod";

/** Longest retry delay the report-assistant resource guard may expose. */
export const REPORT_ASSISTANT_RESOURCE_RETRY_MAX_SECONDS = 120;

import { safeText } from "./primitives/report-primitives.schema";
import { searchPlanSchema } from "./report-assistant-search-plan";

const MAX_RESOLUTION_TOKENS = 20;

const providerRateLimitSchema = z
  .object({ retryAfterSeconds: z.number().int().nonnegative() })
  .strict();

/** Public shared schema or contract constant for source citation schema. */
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

/** Public shared schema or contract constant for report assistant request schema. */
export const reportAssistantRequestSchema = z
  .object({
    question: safeText({ min: 1, max: 2000 }),
    resolutionTokens: z
      .array(safeText({ max: 2000 }))
      .max(MAX_RESOLUTION_TOKENS),
  })
  .strict();

/** Public shared schema or contract constant for clarification option schema. */
export const clarificationOptionSchema = z
  .object({
    label: z.string().min(1),
    token: safeText({ max: 2000 }),
  })
  .strict();

/** Public shared schema or contract constant for answer metadata schema. */
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

/** Public shared schema or contract constant for report assistant outcome schema. */
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
  z
    .object({
      kind: z.literal("resource_limited"),
      retryAfterSeconds: z
        .number()
        .int()
        .positive()
        .max(REPORT_ASSISTANT_RESOURCE_RETRY_MAX_SECONDS),
    })
    .strict(),
]);

/** Public shared schema or contract constant for search report entries tool input schema. */
export const searchReportEntriesToolInputSchema = searchPlanSchema;
/** Public shared type contract for report assistant request. */
export type ReportAssistantRequest = z.infer<
  typeof reportAssistantRequestSchema
>;
/** Public shared type contract for report assistant outcome. */
export type ReportAssistantOutcome = z.infer<
  typeof reportAssistantOutcomeSchema
>;
/** Public shared type contract for clarification option. */
export type ClarificationOption = z.infer<typeof clarificationOptionSchema>;
/** Public shared type contract for source citation. */
export type SourceCitation = z.infer<typeof sourceCitationSchema>;
/** Public shared type contract for answer metadata. */
export type AnswerMetadata = z.infer<typeof answerMetadataSchema>;
