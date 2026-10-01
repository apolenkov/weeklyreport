import { z } from "zod";

import type {
  aiProviderAvailabilityReadSchema,
  aiProviderAvailabilitySchema,
  aiProviderCapabilityTestResultSchema,
  aiProviderConfigurationReadSchema,
  aiProviderConnectionRoleSchema,
  aiProviderControlReadSchema,
  aiProviderDiscardResultSchema,
  aiProviderDraftSchema,
  aiProviderLifecycleSchema,
  aiProviderPreparationProgressSchema,
  aiProviderProfileCapabilitySchema,
  aiProviderProfileSchema,
  aiProviderReasoningModeSchema,
  aiProviderRevisionInputSchema,
} from "./ai-provider-configuration.js";

/** Public shared type contract for ai provider profile. */
export type AiProviderProfile = z.infer<typeof aiProviderProfileSchema>;
/** Public shared type contract for ai provider connection role. */
export type AiProviderConnectionRole = z.infer<
  typeof aiProviderConnectionRoleSchema
>;
/** Public shared type contract for ai provider profile capability. */
export type AiProviderProfileCapability = z.infer<
  typeof aiProviderProfileCapabilitySchema
>;
/** Public shared type contract for ai provider lifecycle. */
export type AiProviderLifecycle = z.infer<typeof aiProviderLifecycleSchema>;
/** Public shared type contract for ai provider availability. */
export type AiProviderAvailability = z.infer<
  typeof aiProviderAvailabilitySchema
>;
/** Public shared type contract for ai provider reasoning mode. */
export type AiProviderReasoningMode = z.infer<
  typeof aiProviderReasoningModeSchema
>;
/** Public shared type contract for ai provider draft. */
export type AiProviderDraft = z.infer<typeof aiProviderDraftSchema>;
/** Public shared type contract for ai provider configuration read. */
export type AiProviderConfigurationRead = z.infer<
  typeof aiProviderConfigurationReadSchema
>;
/** Public shared type contract for ai provider preparation progress. */
export type AiProviderPreparationProgress = z.infer<
  typeof aiProviderPreparationProgressSchema
>;
/** Public shared type contract for ai provider capability test result. */
export type AiProviderCapabilityTestResult = z.infer<
  typeof aiProviderCapabilityTestResultSchema
>;
/** Public shared type contract for ai provider availability read. */
export type AiProviderAvailabilityRead = z.infer<
  typeof aiProviderAvailabilityReadSchema
>;
/** Public shared type contract for ai provider revision input. */
export type AiProviderRevisionInput = z.infer<
  typeof aiProviderRevisionInputSchema
>;
/** Public shared type contract for ai provider discard result. */
export type AiProviderDiscardResult = z.infer<
  typeof aiProviderDiscardResultSchema
>;
/** Public shared type contract for ai provider control read. */
export type AiProviderControlRead = z.infer<typeof aiProviderControlReadSchema>;
