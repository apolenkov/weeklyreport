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
  aiPromptEvaluationCheckSchema,
  aiPromptEvaluationInputSchema,
  aiPromptEvaluationReadSchema,
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

export type AiFeatureKey = z.infer<typeof aiFeatureKeySchema>;
export type AiPromptSlot = z.infer<typeof aiPromptSlotSchema>;
export type AiPromptBundleLifecycle = z.infer<
  typeof aiPromptBundleLifecycleSchema
>;
export type AiPromptAvailability = z.infer<typeof aiPromptAvailabilitySchema>;
export type AiPromptServingStatus = z.infer<typeof aiPromptServingStatusSchema>;
export type AiPromptContents = z.infer<typeof aiPromptContentsSchema>;
export type AiPromptSlotRead = z.infer<typeof aiPromptSlotReadSchema>;
export type AiPromptEvaluationCheck = z.infer<
  typeof aiPromptEvaluationCheckSchema
>;
export type AiPromptEvaluationRead = z.infer<
  typeof aiPromptEvaluationReadSchema
>;
export type AiPromptBundleRead = z.infer<typeof aiPromptBundleReadSchema>;
export type AiPromptFeatureControlRead = z.infer<
  typeof aiPromptFeatureControlReadSchema
>;
export type AiPromptFeatureRead = z.infer<typeof aiPromptFeatureReadSchema>;
export type AiPromptCatalogRead = z.infer<typeof aiPromptCatalogReadSchema>;
export type AiPromptFeatureInput = z.infer<typeof aiPromptFeatureInputSchema>;
export type AiPromptRevisionInput = z.infer<typeof aiPromptRevisionInputSchema>;
export type AiPromptDraftInput = z.infer<typeof aiPromptDraftInputSchema>;
export type AiPromptEvaluationInput = z.infer<
  typeof aiPromptEvaluationInputSchema
>;
export type AiPromptActivationInput = z.infer<
  typeof aiPromptActivationInputSchema
>;
export type AiPromptRestoreInput = z.infer<typeof aiPromptRestoreInputSchema>;
export type AiPromptDiscardInput = z.infer<typeof aiPromptDiscardInputSchema>;
export type AiPromptDiscardResult = z.infer<typeof aiPromptDiscardResultSchema>;
export type AiPromptOperationResult = z.infer<
  typeof aiPromptOperationResultSchema
>;
