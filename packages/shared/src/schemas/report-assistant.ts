import { z } from "zod";

import { safeText } from "./primitives/report-primitives.schema.js";
import { searchPlanSchema } from "./report-assistant-search-plan.js";

/** Longest retry delay the report-assistant resource guard may expose. */
export const REPORT_ASSISTANT_RESOURCE_RETRY_MAX_SECONDS = 120;

const MAX_RESOLUTION_TOKENS = 20;

const providerRateLimitSchema = z
  .object({ retryAfterSeconds: z.number().int().nonnegative() })
  .strict();

/** Identifies a source used to support an assistant answer. */
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

/** User question and bounded search context sent to the assistant. */
export const reportAssistantRequestSchema = z
  .object({
    question: safeText({ min: 1, max: 2000 }),
    resolutionTokens: z
      .array(safeText({ max: 2000 }))
      .max(MAX_RESOLUTION_TOKENS),
  })
  .strict();

/** One selectable clarification offered by the assistant. */
export const clarificationOptionSchema = z
  .object({
    label: z.string().min(1),
    token: safeText({ max: 2000 }),
  })
  .strict();

/** Metadata attached to an accepted assistant answer. */
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

/** Discriminated result returned by the report assistant. */
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
  z.object({ kind: z.literal("provider_response_incomplete") }).strict(),
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

/** Search-plan input accepted by the report-entries tool. */
export const searchReportEntriesToolInputSchema = searchPlanSchema;
/** Parsed request passed to the report assistant. */
export type ReportAssistantRequest = z.infer<
  typeof reportAssistantRequestSchema
>;
/** Parsed result returned by the report assistant. */
export type ReportAssistantOutcome = z.infer<
  typeof reportAssistantOutcomeSchema
>;
/** Parsed clarification option offered by the assistant. */
export type ClarificationOption = z.infer<typeof clarificationOptionSchema>;
/** Parsed source citation attached to an assistant answer. */
export type SourceCitation = z.infer<typeof sourceCitationSchema>;
/** Parsed metadata attached to an assistant answer. */
export type AnswerMetadata = z.infer<typeof answerMetadataSchema>;
