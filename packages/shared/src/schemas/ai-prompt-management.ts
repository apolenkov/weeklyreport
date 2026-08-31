import { z } from "zod";

/** Public shared schema or contract constant for a i  p r o m p t  s l o t  k e y s. */
export const AI_PROMPT_SLOT_KEYS = [
  "planner",
  "planner-repair",
  "grounded-answer",
  "citation-repair",
] as const;

/** Public shared schema or contract constant for a i  p r o m p t  f e a t u r e  k e y s. */
export const AI_PROMPT_FEATURE_KEYS = ["lead-report-assistant"] as const;

/** Public shared schema or contract constant for a i  p r o m p t  s l o t  c o n t e n t  l i m i t. */
export const AI_PROMPT_SLOT_CONTENT_LIMIT = 12_000;
/** Public shared schema or contract constant for a i  p r o m p t  b u n d l e  e f f e c t i v e  l i m i t. */
export const AI_PROMPT_BUNDLE_EFFECTIVE_LIMIT = 48_000;
/** Public shared schema or contract constant for a i  p r o m p t  c o r e  l i m i t. */
export const AI_PROMPT_CORE_LIMIT = 24_000;
/** Public shared schema or contract constant for a i  p r o m p t  h a s h  l e n g t h. */
export const AI_PROMPT_HASH_LENGTH = 64;
/** Public shared schema or contract constant for a i  p r o m p t  v e r s i o n  l i m i t. */
export const AI_PROMPT_VERSION_LIMIT = 120;
/** Public shared schema or contract constant for a i  p r o m p t  d i s p l a y  n a m e  l i m i t. */
export const AI_PROMPT_DISPLAY_NAME_LIMIT = 120;
/** Public shared schema or contract constant for a i  p r o m p t  d e s c r i p t i o n  l i m i t. */
export const AI_PROMPT_DESCRIPTION_LIMIT = 500;
/** Public shared schema or contract constant for a i  p r o m p t  h i s t o r y  l i m i t. */
export const AI_PROMPT_HISTORY_LIMIT = 100;

const CONTROL_CHARACTER_PATTERN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const HASH_PATTERN = /^[a-f0-9]{64}$/u;

const safePromptText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value), {
      message: "Prompt text contains an unsafe control character",
    });

const versionSchema = z.string().trim().min(1).max(AI_PROMPT_VERSION_LIMIT);
const contentHashSchema = z
  .string()
  .regex(HASH_PATTERN, "Content hash must be a lowercase SHA-256 hex digest");

/** Public shared schema or contract constant for ai feature key schema. */
export const aiFeatureKeySchema = z.enum(AI_PROMPT_FEATURE_KEYS);
/** Public shared schema or contract constant for ai prompt slot schema. */
export const aiPromptSlotSchema = z.enum(AI_PROMPT_SLOT_KEYS);
/** Public shared schema or contract constant for ai prompt bundle lifecycle schema. */
export const aiPromptBundleLifecycleSchema = z.enum([
  "draft",
  "validated",
  "active",
  "failed",
  "superseded",
]);
/** Public shared schema or contract constant for ai prompt availability schema. */
export const aiPromptAvailabilitySchema = z.enum([
  "available",
  "not_configured",
  "provider_incompatible",
]);
/** Public shared schema or contract constant for ai prompt serving status schema. */
export const aiPromptServingStatusSchema = z.enum(["current", "incompatible"]);

/** Public shared schema or contract constant for ai prompt slot definition schema. */
export const aiPromptSlotDefinitionSchema = z
  .object({
    slot: aiPromptSlotSchema,
    displayName: z.string().trim().min(1).max(AI_PROMPT_DISPLAY_NAME_LIMIT),
    required: z.literal(true),
  })
  .strict();

/** Public shared schema or contract constant for ai prompt contents schema. */
export const aiPromptContentsSchema = z
  .object({
    planner: safePromptText(AI_PROMPT_SLOT_CONTENT_LIMIT),
    "planner-repair": safePromptText(AI_PROMPT_SLOT_CONTENT_LIMIT),
    "grounded-answer": safePromptText(AI_PROMPT_SLOT_CONTENT_LIMIT),
    "citation-repair": safePromptText(AI_PROMPT_SLOT_CONTENT_LIMIT),
  })
  .strict();

/** Public shared schema or contract constant for ai prompt slot read schema. */
export const aiPromptSlotReadSchema = z
  .object({
    slot: aiPromptSlotSchema,
    lockedCore: safePromptText(AI_PROMPT_CORE_LIMIT),
    promptContents: safePromptText(AI_PROMPT_SLOT_CONTENT_LIMIT),
    effectivePrompt: safePromptText(AI_PROMPT_SLOT_CONTENT_LIMIT * 2),
  })
  .strict();

/** Public shared schema or contract constant for ai prompt bundle read schema. */
export const aiPromptBundleReadSchema = z
  .object({
    id: z.uuid(),
    featureKey: aiFeatureKeySchema,
    revision: z.number().int().positive(),
    baseRevisionId: z.uuid().nullable(),
    coreContractVersion: versionSchema,
    composerVersion: versionSchema,
    servingContractVersion: versionSchema.nullable(),
    servingStatus: aiPromptServingStatusSchema,
    lockedCoreSnapshot: z.record(
      aiPromptSlotSchema,
      safePromptText(AI_PROMPT_CORE_LIMIT),
    ),
    promptContents: aiPromptContentsSchema,
    slots: z.array(aiPromptSlotReadSchema).length(AI_PROMPT_SLOT_KEYS.length),
    effectiveContentHash: contentHashSchema,
    lifecycle: aiPromptBundleLifecycleSchema,
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    activatedAt: z.coerce.date().nullable(),
    supersededAt: z.coerce.date().nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const slots = value.slots.map(({ slot }) => slot);
    if (new Set(slots).size !== AI_PROMPT_SLOT_KEYS.length) {
      ctx.addIssue({
        code: "custom",
        path: ["slots"],
        message: "A prompt bundle must contain each registered slot once",
      });
    }
  });

/** Public shared schema or contract constant for ai prompt feature control read schema. */
export const aiPromptFeatureControlReadSchema = z
  .object({
    featureKey: aiFeatureKeySchema,
    activeRevisionId: z.uuid().nullable(),
    activeBundle: aiPromptBundleReadSchema.nullable(),
    latestRevision: aiPromptBundleReadSchema.nullable(),
    history: z.array(aiPromptBundleReadSchema).max(AI_PROMPT_HISTORY_LIMIT),
    availability: aiPromptAvailabilitySchema,
  })
  .strict();

/** Public shared schema or contract constant for ai prompt feature read schema. */
export const aiPromptFeatureReadSchema = z
  .object({
    featureKey: aiFeatureKeySchema,
    displayName: z.string().trim().min(1).max(AI_PROMPT_DISPLAY_NAME_LIMIT),
    description: z.string().trim().min(1).max(AI_PROMPT_DESCRIPTION_LIMIT),
    slots: z
      .array(aiPromptSlotDefinitionSchema)
      .length(AI_PROMPT_SLOT_KEYS.length),
    control: aiPromptFeatureControlReadSchema,
  })
  .strict();

/** Public shared schema or contract constant for ai prompt catalog read schema. */
export const aiPromptCatalogReadSchema = z
  .object({ features: z.array(aiPromptFeatureReadSchema).min(1) })
  .strict();

/** Public shared schema or contract constant for ai prompt feature input schema. */
export const aiPromptFeatureInputSchema = z
  .object({ featureKey: aiFeatureKeySchema })
  .strict();

const revisionInputSchema = () =>
  z.object({ featureKey: aiFeatureKeySchema, revisionId: z.uuid() }).strict();

/** Public shared schema or contract constant for ai prompt revision input schema. */
export const aiPromptRevisionInputSchema = revisionInputSchema();

/** Public shared schema or contract constant for ai prompt draft input schema. */
export const aiPromptDraftInputSchema = z
  .object({
    featureKey: aiFeatureKeySchema,
    baseRevisionId: z.uuid(),
    promptContents: aiPromptContentsSchema,
  })
  .strict();

const activationInputSchema = () =>
  z
    .object({
      featureKey: aiFeatureKeySchema,
      revisionId: z.uuid(),
    })
    .strict();

/** Public shared schema or contract constant for ai prompt activation input schema. */
export const aiPromptActivationInputSchema = activationInputSchema();
/** Public shared schema or contract constant for ai prompt restore input schema. */
export const aiPromptRestoreInputSchema = activationInputSchema();
/** Public shared schema or contract constant for ai prompt discard input schema. */
export const aiPromptDiscardInputSchema = revisionInputSchema();

/** Public shared schema or contract constant for ai prompt discard result schema. */
export const aiPromptDiscardResultSchema = z
  .object({
    featureKey: aiFeatureKeySchema,
    revisionId: z.uuid(),
    discarded: z.literal(true),
  })
  .strict();

/** Public shared schema or contract constant for ai prompt operation result schema. */
export const aiPromptOperationResultSchema = z
  .object({
    featureKey: aiFeatureKeySchema,
    revisionId: z.uuid(),
    lifecycle: aiPromptBundleLifecycleSchema,
  })
  .strict();

export type * from "./ai-prompt-management.types";
