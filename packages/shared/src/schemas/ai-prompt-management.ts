import { z } from "zod";

import { aiCompatibilityExecutionReadSchema } from "./ai-compatibility-execution";

export const AI_PROMPT_SLOT_KEYS = [
  "planner",
  "planner-repair",
  "grounded-answer",
  "citation-repair",
] as const;

export const AI_PROMPT_FEATURE_KEYS = ["lead-report-assistant"] as const;

export const AI_PROMPT_SLOT_CONTENT_LIMIT = 12_000;
export const AI_PROMPT_BUNDLE_EFFECTIVE_LIMIT = 48_000;
export const AI_PROMPT_CORE_LIMIT = 24_000;
export const AI_PROMPT_HASH_LENGTH = 64;
export const AI_PROMPT_EVALUATION_CHECK_LIMIT = 32;
export const AI_PROMPT_VERSION_LIMIT = 120;
export const AI_PROMPT_CHECK_CODE_LIMIT = 80;
export const AI_PROMPT_DISPLAY_NAME_LIMIT = 120;
export const AI_PROMPT_DESCRIPTION_LIMIT = 500;
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

export const aiFeatureKeySchema = z.enum(AI_PROMPT_FEATURE_KEYS);
export const aiPromptSlotSchema = z.enum(AI_PROMPT_SLOT_KEYS);
export const aiPromptBundleLifecycleSchema = z.enum([
  "draft",
  "validated",
  "active",
  "failed",
  "superseded",
]);
export const aiPromptAvailabilitySchema = z.enum([
  "available",
  "not_configured",
  "evaluation_required",
  "provider_incompatible",
]);
export const aiPromptOperationOutcomeSchema = z.enum([
  "passed",
  "failed",
  "inconclusive",
]);
export const aiPromptEvaluationCheckStatusSchema = z.enum([
  "passed",
  "failed",
  "inconclusive",
]);

export const aiPromptSlotDefinitionSchema = z
  .object({
    slot: aiPromptSlotSchema,
    displayName: z.string().trim().min(1).max(AI_PROMPT_DISPLAY_NAME_LIMIT),
    required: z.literal(true),
  })
  .strict();

export const aiPromptContentsSchema = z
  .object({
    planner: safePromptText(AI_PROMPT_SLOT_CONTENT_LIMIT),
    "planner-repair": safePromptText(AI_PROMPT_SLOT_CONTENT_LIMIT),
    "grounded-answer": safePromptText(AI_PROMPT_SLOT_CONTENT_LIMIT),
    "citation-repair": safePromptText(AI_PROMPT_SLOT_CONTENT_LIMIT),
  })
  .strict();

export const aiPromptSlotReadSchema = z
  .object({
    slot: aiPromptSlotSchema,
    lockedCore: safePromptText(AI_PROMPT_CORE_LIMIT),
    promptContents: safePromptText(AI_PROMPT_SLOT_CONTENT_LIMIT),
    effectivePrompt: safePromptText(AI_PROMPT_SLOT_CONTENT_LIMIT * 2),
  })
  .strict();

export const aiPromptEvaluationCheckSchema = z
  .object({
    code: z.string().trim().min(1).max(AI_PROMPT_CHECK_CODE_LIMIT),
    status: aiPromptEvaluationCheckStatusSchema,
    passedCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.passedCount + value.failedCount === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["passedCount"],
        message: "An evaluation check must record at least one case",
      });
    }
    if (value.status === "passed" && value.failedCount > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: "A passing check cannot contain failed cases",
      });
    }
    if (value.status === "failed" && value.failedCount === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: "A failed check must contain a failed case",
      });
    }
  });

export const aiPromptEvaluationReadSchema = z
  .object({
    id: z.uuid(),
    featureKey: aiFeatureKeySchema,
    promptRevisionId: z.uuid(),
    generationCompatibilityIdentity: versionSchema,
    contentHash: contentHashSchema,
    contractVersion: versionSchema,
    evaluatorVersion: versionSchema,
    outcome: aiPromptOperationOutcomeSchema,
    checks: z
      .array(aiPromptEvaluationCheckSchema)
      .min(1)
      .max(AI_PROMPT_EVALUATION_CHECK_LIMIT),
    evaluatedAt: z.coerce.date(),
  })
  .strict();

export const aiPromptBundleReadSchema = z
  .object({
    id: z.uuid(),
    featureKey: aiFeatureKeySchema,
    revision: z.number().int().positive(),
    baseRevisionId: z.uuid().nullable(),
    coreContractVersion: versionSchema,
    composerVersion: versionSchema,
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
    latestEvaluation: aiPromptEvaluationReadSchema.nullable(),
    latestExecution: aiCompatibilityExecutionReadSchema.nullable().optional(),
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

export const aiPromptCatalogReadSchema = z
  .object({ features: z.array(aiPromptFeatureReadSchema).min(1) })
  .strict();

export const aiPromptFeatureInputSchema = z
  .object({ featureKey: aiFeatureKeySchema })
  .strict();

const revisionInputSchema = () =>
  z.object({ featureKey: aiFeatureKeySchema, revisionId: z.uuid() }).strict();

export const aiPromptRevisionInputSchema = revisionInputSchema();

export const aiPromptDraftInputSchema = z
  .object({
    featureKey: aiFeatureKeySchema,
    baseRevisionId: z.uuid(),
    promptContents: aiPromptContentsSchema,
  })
  .strict();

export const aiPromptEvaluationInputSchema = revisionInputSchema();
const activationInputSchema = () =>
  z
    .object({
      featureKey: aiFeatureKeySchema,
      revisionId: z.uuid(),
      evaluationId: z.uuid(),
    })
    .strict();

export const aiPromptActivationInputSchema = activationInputSchema();
export const aiPromptRestoreInputSchema = activationInputSchema();
export const aiPromptDiscardInputSchema = revisionInputSchema();

export const aiPromptDiscardResultSchema = z
  .object({
    featureKey: aiFeatureKeySchema,
    revisionId: z.uuid(),
    discarded: z.literal(true),
  })
  .strict();

export const aiPromptOperationResultSchema = z
  .object({
    featureKey: aiFeatureKeySchema,
    revisionId: z.uuid(),
    lifecycle: aiPromptBundleLifecycleSchema,
  })
  .strict();

export type * from "./ai-prompt-management.types";
