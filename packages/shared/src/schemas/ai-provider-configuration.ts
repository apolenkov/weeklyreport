import { z } from "zod";

import {
  aiProviderProfileSchema,
  aiProviderReasoningModeSchema,
  credentialSchema,
  endpointSchema,
  modelIdentifierSchema,
  profileSupportsRole,
  reasoningCustomValueSchema,
  validateEndpoint,
} from "./ai-provider-configuration.base";

export {
  AI_PROVIDER_PROFILE_CAPABILITIES,
  aiProviderAvailabilitySchema,
  aiProviderConnectionRoleSchema,
  aiProviderEmbeddingModeSchema,
  aiProviderLifecycleSchema,
  aiProviderProfileCapabilitySchema,
  aiProviderProfileSchema,
  aiProviderReasoningModeSchema,
} from "./ai-provider-configuration.base";
export {
  aiProviderAvailabilityReadSchema,
  aiProviderConfigurationReadSchema,
  aiProviderControlReadSchema,
  aiProviderDiscardResultSchema,
  aiProviderPreparationProgressSchema,
  aiProviderRevisionInputSchema,
} from "./ai-provider-configuration.read";
export {
  aiProviderCapabilitySchema,
  aiProviderCapabilityStatusSchema,
  aiProviderCapabilityTestResultSchema,
} from "./ai-provider-configuration-results";

export const aiProviderGenerationDraftSchema = z
  .object({
    profile: aiProviderProfileSchema,
    baseUrl: endpointSchema.optional(),
    plannerModel: modelIdentifierSchema,
    answerModel: modelIdentifierSchema,
    reasoningMode: aiProviderReasoningModeSchema,
    reasoningCustomValue: reasoningCustomValueSchema.optional(),
    credential: credentialSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    validateEndpoint(value, ctx);
    if (value.reasoningMode === "custom" && !value.reasoningCustomValue) {
      ctx.addIssue({
        code: "custom",
        path: ["reasoningCustomValue"],
        message: "A custom reasoning value is required",
      });
    }
    if (value.reasoningMode !== "custom" && value.reasoningCustomValue) {
      ctx.addIssue({
        code: "custom",
        path: ["reasoningCustomValue"],
        message: "A custom reasoning value requires custom mode",
      });
    }
  });

export const aiProviderSeparateEmbeddingDraftSchema = z
  .object({
    mode: z.literal("separate"),
    profile: aiProviderProfileSchema,
    baseUrl: endpointSchema.optional(),
    model: modelIdentifierSchema,
    credential: credentialSchema.optional(),
  })
  .strict()
  .superRefine(validateEndpoint);

export const aiProviderEmbeddingDraftSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("reuse_generation"),
      model: modelIdentifierSchema,
    })
    .strict(),
  aiProviderSeparateEmbeddingDraftSchema,
]);

export const aiProviderDraftSchema = z
  .object({
    baseRevisionId: z.uuid().optional(),
    generation: aiProviderGenerationDraftSchema,
    embeddings: aiProviderEmbeddingDraftSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!profileSupportsRole(value.generation.profile, "generation")) {
      ctx.addIssue({
        code: "custom",
        path: ["generation", "profile"],
        message: "The profile does not support generation",
      });
    }
    if (value.embeddings.mode === "reuse_generation") {
      if (!profileSupportsRole(value.generation.profile, "embeddings")) {
        ctx.addIssue({
          code: "custom",
          path: ["embeddings", "mode"],
          message: "The generation profile does not support embeddings",
        });
      }
      return;
    }
    if (!profileSupportsRole(value.embeddings.profile, "embeddings")) {
      ctx.addIssue({
        code: "custom",
        path: ["embeddings", "profile"],
        message: "The profile does not support embeddings",
      });
    }
  });

export type * from "./ai-provider-configuration.types";
