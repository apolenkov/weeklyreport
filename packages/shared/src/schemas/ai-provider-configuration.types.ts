import { z } from "zod";

import type {
  aiProviderAnswerProtocolSchema,
  aiProviderAvailabilityReadSchema,
  aiProviderAvailabilitySchema,
  aiProviderCapabilityTestResultSchema,
  aiProviderConfigurationReadSchema,
  aiProviderConnectionRoleSchema,
  aiProviderControlReadSchema,
  aiProviderDiscardResultSchema,
  aiProviderDraftSchema,
  aiProviderFeatureCompatibilitySchema,
  aiProviderLifecycleSchema,
  aiProviderPreparationProgressSchema,
  aiProviderProfileCapabilitySchema,
  aiProviderProfileSchema,
  aiProviderReasoningModeSchema,
  aiProviderRevisionInputSchema,
} from "./ai-provider-configuration";

export type AiProviderProfile = z.infer<typeof aiProviderProfileSchema>;
export type AiProviderConnectionRole = z.infer<
  typeof aiProviderConnectionRoleSchema
>;
export type AiProviderProfileCapability = z.infer<
  typeof aiProviderProfileCapabilitySchema
>;
export type AiProviderLifecycle = z.infer<typeof aiProviderLifecycleSchema>;
export type AiProviderAvailability = z.infer<
  typeof aiProviderAvailabilitySchema
>;
export type AiProviderReasoningMode = z.infer<
  typeof aiProviderReasoningModeSchema
>;
export type AiProviderAnswerProtocol = z.infer<
  typeof aiProviderAnswerProtocolSchema
>;
export type AiProviderDraft = z.infer<typeof aiProviderDraftSchema>;
export type AiProviderConfigurationRead = z.infer<
  typeof aiProviderConfigurationReadSchema
>;
export type AiProviderPreparationProgress = z.infer<
  typeof aiProviderPreparationProgressSchema
>;
export type AiProviderCapabilityTestResult = z.infer<
  typeof aiProviderCapabilityTestResultSchema
>;
export type AiProviderFeatureCompatibility = z.infer<
  typeof aiProviderFeatureCompatibilitySchema
>;
export type AiProviderAvailabilityRead = z.infer<
  typeof aiProviderAvailabilityReadSchema
>;
export type AiProviderRevisionInput = z.infer<
  typeof aiProviderRevisionInputSchema
>;
export type AiProviderDiscardResult = z.infer<
  typeof aiProviderDiscardResultSchema
>;
export type AiProviderControlRead = z.infer<typeof aiProviderControlReadSchema>;
