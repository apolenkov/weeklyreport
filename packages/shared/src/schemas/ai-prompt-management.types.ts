import { z } from "zod";

import type {
  aiFeatureKeySchema,
  aiPromptActivationInputSchema,
  aiPromptAvailabilitySchema,
  aiPromptBundleLifecycleSchema,
  aiPromptBundleReadSchema,
  aiPromptCatalogReadSchema,
  aiPromptContentsSchema,
  aiPromptDiscardInputSchema,
  aiPromptDiscardResultSchema,
  aiPromptDraftInputSchema,
  aiPromptFeatureControlReadSchema,
  aiPromptFeatureInputSchema,
  aiPromptFeatureReadSchema,
  aiPromptOperationResultSchema,
  aiPromptRestoreInputSchema,
  aiPromptRevisionInputSchema,
  aiPromptServingStatusSchema,
  aiPromptSlotReadSchema,
  aiPromptSlotSchema,
} from "./ai-prompt-management";

/** Public shared type contract for ai feature key. */
export type AiFeatureKey = z.infer<typeof aiFeatureKeySchema>;
/** Public shared type contract for ai prompt slot. */
export type AiPromptSlot = z.infer<typeof aiPromptSlotSchema>;
/** Public shared type contract for ai prompt bundle lifecycle. */
export type AiPromptBundleLifecycle = z.infer<
  typeof aiPromptBundleLifecycleSchema
>;
/** Public shared type contract for ai prompt availability. */
export type AiPromptAvailability = z.infer<typeof aiPromptAvailabilitySchema>;
/** Public shared type contract for ai prompt serving status. */
export type AiPromptServingStatus = z.infer<typeof aiPromptServingStatusSchema>;
/** Public shared type contract for ai prompt contents. */
export type AiPromptContents = z.infer<typeof aiPromptContentsSchema>;
/** Public shared type contract for ai prompt slot read. */
export type AiPromptSlotRead = z.infer<typeof aiPromptSlotReadSchema>;
/** Public shared type contract for ai prompt bundle read. */
export type AiPromptBundleRead = z.infer<typeof aiPromptBundleReadSchema>;
/** Public shared type contract for ai prompt feature control read. */
export type AiPromptFeatureControlRead = z.infer<
  typeof aiPromptFeatureControlReadSchema
>;
/** Public shared type contract for ai prompt feature read. */
export type AiPromptFeatureRead = z.infer<typeof aiPromptFeatureReadSchema>;
/** Public shared type contract for ai prompt catalog read. */
export type AiPromptCatalogRead = z.infer<typeof aiPromptCatalogReadSchema>;
/** Public shared type contract for ai prompt feature input. */
export type AiPromptFeatureInput = z.infer<typeof aiPromptFeatureInputSchema>;
/** Public shared type contract for ai prompt revision input. */
export type AiPromptRevisionInput = z.infer<typeof aiPromptRevisionInputSchema>;
/** Public shared type contract for ai prompt draft input. */
export type AiPromptDraftInput = z.infer<typeof aiPromptDraftInputSchema>;
/** Public shared type contract for ai prompt activation input. */
export type AiPromptActivationInput = z.infer<
  typeof aiPromptActivationInputSchema
>;
/** Public shared type contract for ai prompt restore input. */
export type AiPromptRestoreInput = z.infer<typeof aiPromptRestoreInputSchema>;
/** Public shared type contract for ai prompt discard input. */
export type AiPromptDiscardInput = z.infer<typeof aiPromptDiscardInputSchema>;
/** Public shared type contract for ai prompt discard result. */
export type AiPromptDiscardResult = z.infer<typeof aiPromptDiscardResultSchema>;
/** Public shared type contract for ai prompt operation result. */
export type AiPromptOperationResult = z.infer<
  typeof aiPromptOperationResultSchema
>;
