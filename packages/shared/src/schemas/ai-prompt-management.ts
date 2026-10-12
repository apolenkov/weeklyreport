import { z } from "zod";

/** Prompt stages required in every managed prompt bundle. */
export const AI_PROMPT_SLOT_KEYS = [
  "planner",
  "planner-repair",
  "grounded-answer",
  "citation-repair",
] as const;

/** Product features whose prompts can be managed by administrators. */
export const AI_PROMPT_FEATURE_KEYS = ["lead-report-assistant"] as const;

/** Maximum editable characters in one prompt slot. */
export const AI_PROMPT_SLOT_CONTENT_LIMIT = 12_000;
/** Maximum combined effective prompt size across a bundle. */
export const AI_PROMPT_BUNDLE_EFFECTIVE_LIMIT = 48_000;
/** Maximum locked-core characters retained for one prompt slot. */
export const AI_PROMPT_CORE_LIMIT = 24_000;
/** Separator joining the locked core and editable tail in a composed prompt. */
export const AI_PROMPT_EDITABLE_TAIL_SEPARATOR =
  "\n\nOperator guidance (editable tail):\n";
/** Maximum composed effective-prompt characters in one prompt slot. */
export const AI_PROMPT_EFFECTIVE_PROMPT_LIMIT =
  AI_PROMPT_CORE_LIMIT +
  AI_PROMPT_EDITABLE_TAIL_SEPARATOR.length +
  AI_PROMPT_SLOT_CONTENT_LIMIT;
/** Maximum length of a prompt contract or composer version. */
export const AI_PROMPT_VERSION_LIMIT = 120;
/** Maximum display-name length for prompt features and slots. */
export const AI_PROMPT_DISPLAY_NAME_LIMIT = 120;
/** Maximum prompt-feature description length. */
export const AI_PROMPT_DESCRIPTION_LIMIT = 500;
/** Maximum number of prompt revisions returned in feature history. */
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

/** Accepts a registered prompt-managed feature. */
export const aiFeatureKeySchema = z.enum(AI_PROMPT_FEATURE_KEYS);
/** Accepts a registered prompt slot. */
export const aiPromptSlotSchema = z.enum(AI_PROMPT_SLOT_KEYS);
/** Lifecycle states of an immutable prompt bundle revision. */
export const aiPromptBundleLifecycleSchema = z.enum([
  "draft",
  "validated",
  "active",
  "failed",
  "superseded",
]);
/** Availability states exposed by prompt administration. */
export const aiPromptAvailabilitySchema = z.enum([
  "available",
  "not_configured",
  "provider_incompatible",
]);
/** Whether a prompt revision matches the current serving contract. */
export const aiPromptServingStatusSchema = z.enum(["current", "incompatible"]);

/** Describes one required, catalog-owned prompt slot. */
export const aiPromptSlotDefinitionSchema = z
  .object({
    slot: aiPromptSlotSchema,
    displayName: z.string().trim().min(1).max(AI_PROMPT_DISPLAY_NAME_LIMIT),
    required: z.literal(true),
  })
  .strict();

/** Validates the complete editable contents of a prompt bundle. */
export const aiPromptContentsSchema = z.record(
  aiPromptSlotSchema,
  safePromptText(AI_PROMPT_SLOT_CONTENT_LIMIT),
);

/** Read model for one composed prompt slot. */
export const aiPromptSlotReadSchema = z
  .object({
    slot: aiPromptSlotSchema,
    lockedCore: safePromptText(AI_PROMPT_CORE_LIMIT),
    promptContents: safePromptText(AI_PROMPT_SLOT_CONTENT_LIMIT),
    effectivePrompt: safePromptText(AI_PROMPT_EFFECTIVE_PROMPT_LIMIT),
  })
  .strict();

/** Read model for an immutable prompt bundle revision. */
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

/** Active, latest, and historical state for one prompt-managed feature. */
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

/** Catalog metadata and revision control state for one feature. */
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

/** Administrator-visible catalog of prompt-managed features. */
export const aiPromptCatalogReadSchema = z
  .object({ features: z.array(aiPromptFeatureReadSchema).min(1) })
  .strict();

/** Selects one registered prompt-managed feature. */
export const aiPromptFeatureInputSchema = z
  .object({ featureKey: aiFeatureKeySchema })
  .strict();

const revisionInputSchema = () =>
  z.object({ featureKey: aiFeatureKeySchema, revisionId: z.uuid() }).strict();

/** Selects one immutable revision of a prompt-managed feature. */
export const aiPromptRevisionInputSchema = revisionInputSchema();

/** Validates editable contents used to create a draft revision. */
export const aiPromptDraftInputSchema = z
  .object({
    featureKey: aiFeatureKeySchema,
    baseRevisionId: z.uuid(),
    promptContents: aiPromptContentsSchema,
  })
  .strict();

/** Selects the revision to make active for a feature. */
export const aiPromptActivationInputSchema = revisionInputSchema();
/** Selects the historical revision to restore for a feature. */
export const aiPromptRestoreInputSchema = revisionInputSchema();
/** Selects the inactive revision to discard for a feature. */
export const aiPromptDiscardInputSchema = revisionInputSchema();

/** Confirms that an inactive prompt revision was discarded. */
export const aiPromptDiscardResultSchema = z
  .object({
    featureKey: aiFeatureKeySchema,
    revisionId: z.uuid(),
    discarded: z.literal(true),
  })
  .strict();

/** Reports the resulting lifecycle of a prompt revision operation. */
export const aiPromptOperationResultSchema = z
  .object({
    featureKey: aiFeatureKeySchema,
    revisionId: z.uuid(),
    lifecycle: aiPromptBundleLifecycleSchema,
  })
  .strict();

export type * from "./ai-prompt-management.types.js";
