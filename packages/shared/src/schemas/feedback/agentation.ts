import { z } from "zod";

import {
  MAX_FEEDBACK_MESSAGE_LENGTH,
  MAX_FEEDBACK_PAGE_SCOPE_LENGTH,
} from "./product-feedback";

/** Maximum length of an Agentation client identifier. */
export const AGENTATION_MAX_ID_LENGTH = 128;
/** Maximum length of a bounded Agentation string field. */
export const AGENTATION_MAX_STRING_LENGTH = 4000;
/** Maximum number of Agentation records in a bounded array. */
export const AGENTATION_MAX_ARRAY_LENGTH = 50;
/** Maximum accepted Agentation timestamp. */
export const AGENTATION_MAX_TIMESTAMP = Number.MAX_SAFE_INTEGER;
/** Maximum coordinate magnitude accepted by the wire contract. */
export const AGENTATION_MAX_COORDINATE = 10_000_000;
/** Maximum annotation x percentage. */
export const AGENTATION_MAX_X_PERCENT = 100;
/** Maximum action output length. */
export const AGENTATION_MAX_ACTION_OUTPUT_LENGTH = 20_000;

const finite = z.number();
const AGENTATION_MAX_METADATA_KEY_LENGTH = 100;
const boundedCoordinate = finite
  .min(-AGENTATION_MAX_COORDINATE)
  .max(AGENTATION_MAX_COORDINATE);
const boundedString = z.string().max(AGENTATION_MAX_STRING_LENGTH);
const id = z.string().min(1).max(AGENTATION_MAX_ID_LENGTH);
const rect = z
  .object({
    x: boundedCoordinate,
    y: boundedCoordinate,
    width: finite.min(0).max(AGENTATION_MAX_COORDINATE),
    height: finite.min(0).max(AGENTATION_MAX_COORDINATE),
  })
  .strip();

/** Validates Agentation lifecycle status. */
export const agentationStatusSchema = z.enum([
  "pending",
  "acknowledged",
  "resolved",
  "dismissed",
]);
/** Validates Agentation annotation kind. */
export const agentationKindSchema = z.enum([
  "feedback",
  "placement",
  "rearrange",
]);
/** Validates Agentation annotation intent. */
export const agentationIntentSchema = z.enum([
  "fix",
  "change",
  "question",
  "approve",
]);
/** Validates Agentation annotation severity. */
export const agentationSeveritySchema = z.enum([
  "blocking",
  "important",
  "suggestion",
]);

/** Agentation lifecycle status. */
export type AgentationStatus = z.infer<typeof agentationStatusSchema>;
/** Agentation annotation kind. */
export type AgentationKind = z.infer<typeof agentationKindSchema>;
/** Agentation annotation intent. */
export type AgentationIntent = z.infer<typeof agentationIntentSchema>;
/** Agentation annotation severity. */
export type AgentationSeverity = z.infer<typeof agentationSeveritySchema>;

/** Validates an Agentation session creation payload. */
export const agentationSessionCreateSchema = z
  .object({
    url: z.url().max(MAX_FEEDBACK_PAGE_SCOPE_LENGTH),
  })
  .strip();
/** Agentation session creation payload. */
export type AgentationSessionCreate = z.infer<
  typeof agentationSessionCreateSchema
>;

/** Validates placement capture metadata. */
export const agentationPlacementSchema = z
  .object({
    componentType: boundedString,
    width: finite.min(0).max(AGENTATION_MAX_COORDINATE),
    height: finite.min(0).max(AGENTATION_MAX_COORDINATE),
    scrollY: boundedCoordinate,
    text: boundedString.optional(),
  })
  .strip();

const rearrangeRect = z
  .object({
    x: boundedCoordinate,
    y: boundedCoordinate,
    width: finite.min(0).max(AGENTATION_MAX_COORDINATE),
    height: finite.min(0).max(AGENTATION_MAX_COORDINATE),
  })
  .strip();
/** Validates rearrange capture metadata. */
export const agentationRearrangeSchema = z
  .object({
    selector: boundedString,
    label: boundedString,
    tagName: boundedString,
    originalRect: rearrangeRect,
    currentRect: rearrangeRect,
  })
  .strip();

/** Validates a bounded Agentation annotation creation payload. */
export const agentationAnnotationCreateSchema = z
  .object({
    id,
    x: finite.min(0).max(AGENTATION_MAX_X_PERCENT),
    y: finite.min(-AGENTATION_MAX_COORDINATE).max(AGENTATION_MAX_COORDINATE),
    comment: z.string().trim().min(1).max(MAX_FEEDBACK_MESSAGE_LENGTH),
    element: boundedString,
    elementPath: boundedString,
    timestamp: finite.int().min(0).max(AGENTATION_MAX_TIMESTAMP),
    selectedText: boundedString.optional(),
    boundingBox: rect.optional(),
    nearbyText: boundedString.optional(),
    cssClasses: boundedString.optional(),
    nearbyElements: boundedString.optional(),
    computedStyles: boundedString.optional(),
    fullPath: boundedString.optional(),
    accessibility: boundedString.optional(),
    isMultiSelect: z.boolean().optional(),
    isFixed: z.boolean().optional(),
    reactComponents: boundedString.optional(),
    sourceFile: boundedString.optional(),
    drawingIndex: z
      .number()
      .int()
      .min(0)
      .max(AGENTATION_MAX_ARRAY_LENGTH)
      .optional(),
    elementBoundingBoxes: z
      .array(rect)
      .max(AGENTATION_MAX_ARRAY_LENGTH)
      .optional(),
    kind: agentationKindSchema.optional(),
    placement: agentationPlacementSchema.optional(),
    rearrange: agentationRearrangeSchema.optional(),
    intent: agentationIntentSchema.optional(),
    severity: agentationSeveritySchema.optional(),
  })
  .strip();
/** Agentation annotation creation payload. */
export type AgentationAnnotationCreate = z.infer<
  typeof agentationAnnotationCreateSchema
>;

/** Validates an Agentation annotation update payload. */
export const agentationAnnotationPatchSchema = z
  .object({
    status: agentationStatusSchema.optional(),
    comment: z
      .string()
      .trim()
      .min(1)
      .max(MAX_FEEDBACK_MESSAGE_LENGTH)
      .optional(),
    intent: agentationIntentSchema.optional(),
    severity: agentationSeveritySchema.optional(),
    kind: agentationKindSchema.optional(),
  })
  .strip();
/** Agentation annotation update payload. */
export type AgentationAnnotationPatch = z.infer<
  typeof agentationAnnotationPatchSchema
>;

/** Validates an Agentation thread message payload. */
export const agentationThreadSchema = z
  .object({
    content: z.string().trim().min(1).max(MAX_FEEDBACK_MESSAGE_LENGTH),
  })
  .strip();
/** Agentation thread message payload. */
export type AgentationThread = z.infer<typeof agentationThreadSchema>;

/** Validates an Agentation action output payload. */
export const agentationActionSchema = z
  .object({
    output: z.string().trim().min(1).max(AGENTATION_MAX_ACTION_OUTPUT_LENGTH),
  })
  .strip();
/** Agentation action output payload. */
export type AgentationAction = z.infer<typeof agentationActionSchema>;

/** Validates a thread message returned by the Agentation adapter. */
export const agentationThreadMessageSchema = z
  .object({
    id,
    role: z.enum(["human", "agent"]),
    content: z.string().trim().min(1).max(MAX_FEEDBACK_MESSAGE_LENGTH),
    timestamp: finite.int().min(0).max(AGENTATION_MAX_TIMESTAMP),
  })
  .strip();
/** Thread message returned by the Agentation adapter. */
export type AgentationThreadMessage = z.infer<
  typeof agentationThreadMessageSchema
>;

/** Validates an annotation returned by the Agentation adapter. */
export const agentationAnnotationResponseSchema =
  agentationAnnotationCreateSchema
    .extend({
      clientId: id,
      sessionId: id,
      url: boundedString.optional(),
      status: agentationStatusSchema,
      thread: z
        .array(agentationThreadMessageSchema)
        .max(AGENTATION_MAX_ARRAY_LENGTH),
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime(),
      resolvedAt: z.iso.datetime().optional(),
      resolvedBy: z.string().max(AGENTATION_MAX_ID_LENGTH).optional(),
      authorId: id,
    })
    .strip();
/** Annotation returned by the Agentation adapter. */
export type AgentationAnnotationResponse = z.infer<
  typeof agentationAnnotationResponseSchema
>;

/** Validates a session returned by the Agentation adapter. */
export const agentationSessionResponseSchema = z
  .object({
    id,
    url: boundedString,
    status: z.enum(["active", "closed"]),
    projectId: boundedString,
    metadata: z
      .record(z.string().max(AGENTATION_MAX_METADATA_KEY_LENGTH), boundedString)
      .optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    annotations: z
      .array(agentationAnnotationResponseSchema)
      .max(AGENTATION_MAX_ARRAY_LENGTH)
      .optional(),
  })
  .strip();
/** Session returned by the Agentation adapter. */
export type AgentationSessionResponse = z.infer<
  typeof agentationSessionResponseSchema
>;

/** Validates the pending annotation collection returned by the adapter. */
export const agentationPendingResponseSchema = z
  .object({
    count: z.number().int().min(0).max(AGENTATION_MAX_ARRAY_LENGTH),
    annotations: z
      .array(agentationAnnotationResponseSchema)
      .max(AGENTATION_MAX_ARRAY_LENGTH),
  })
  .strip();
/** Pending annotation collection returned by the Agentation adapter. */
export type AgentationPendingResponse = z.infer<
  typeof agentationPendingResponseSchema
>;

/** Validates the bounded event envelope emitted by the Agentation SSE stream. */
export const agentationSseEventSchema = z
  .object({
    sequence: finite.int().min(0).max(AGENTATION_MAX_TIMESTAMP),
    type: boundedString,
    sessionId: id.optional(),
    timestamp: z.iso.datetime(),
    payload: z.unknown(),
  })
  .strip();
/** Event envelope emitted by the Agentation SSE stream. */
export type AgentationSseEvent = z.infer<typeof agentationSseEventSchema>;

/** Reduces a browser URL to its bounded pathname. */
export function normalizeAgentationPath(value: string): string {
  const parsed = new URL(value, "https://weeklyreport.invalid");
  const path = parsed.pathname || "/";
  return path.length <= MAX_FEEDBACK_PAGE_SCOPE_LENGTH
    ? path
    : path.slice(0, MAX_FEEDBACK_PAGE_SCOPE_LENGTH);
}
