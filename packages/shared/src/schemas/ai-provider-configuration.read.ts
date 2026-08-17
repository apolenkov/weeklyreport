import { z } from "zod";

import { aiCompatibilityExecutionReadSchema } from "./ai-compatibility-execution";
import {
  AI_PROVIDER_PROFILE_CAPABILITIES,
  aiProviderAvailabilitySchema,
  aiProviderLifecycleSchema,
  aiProviderProfileCapabilitySchema,
  aiProviderProfileSchema,
  aiProviderReasoningModeSchema,
  embeddingDimensionsSchema,
  endpointSchema,
  maskedCredentialSchema,
  MAX_REVISIONS,
  modelIdentifierSchema,
  reasoningCustomValueSchema,
} from "./ai-provider-configuration.base";
import {
  aiProviderAnswerProtocolSchema,
  aiProviderCapabilityTestResultSchema,
} from "./ai-provider-configuration-results";

const aiProviderGenerationReadSchema = z
  .object({
    profile: aiProviderProfileSchema,
    baseUrl: endpointSchema,
    plannerModel: modelIdentifierSchema,
    answerModel: modelIdentifierSchema,
    reasoningMode: aiProviderReasoningModeSchema,
    reasoningCustomValue: reasoningCustomValueSchema.nullable(),
    answerProtocol: aiProviderAnswerProtocolSchema.nullable(),
    credentialConfigured: z.boolean(),
    credentialMaskedSuffix: maskedCredentialSchema,
  })
  .strict();

const aiProviderEmbeddingsReadSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("reuse_generation"),
      model: modelIdentifierSchema,
      dimensions: embeddingDimensionsSchema,
    })
    .strict(),
  z
    .object({
      mode: z.literal("separate"),
      profile: aiProviderProfileSchema,
      baseUrl: endpointSchema,
      model: modelIdentifierSchema,
      dimensions: embeddingDimensionsSchema,
      credentialConfigured: z.boolean(),
      credentialMaskedSuffix: maskedCredentialSchema,
    })
    .strict(),
]);

export const aiProviderConfigurationReadSchema = z
  .object({
    id: z.uuid(),
    lifecycle: aiProviderLifecycleSchema,
    generation: aiProviderGenerationReadSchema,
    embeddings: aiProviderEmbeddingsReadSchema,
    generationCompatibilityIdentity: z.string().trim().min(1),
    semanticInputVersion: z.string().trim().min(1),
    testResult: aiProviderCapabilityTestResultSchema.nullable(),
    latestExecution: aiCompatibilityExecutionReadSchema.nullable().optional(),
    progress: z
      .object({
        completed: z.number().int().nonnegative(),
        total: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        elapsedMs: z.number().int().nonnegative(),
      })
      .strict(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    activatedAt: z.coerce.date().nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.progress.completed > value.progress.total) {
      ctx.addIssue({
        code: "custom",
        path: ["progress", "completed"],
        message: "Completed progress cannot exceed total progress",
      });
    }
    if (value.progress.failed > value.progress.total) {
      ctx.addIssue({
        code: "custom",
        path: ["progress", "failed"],
        message: "Failed progress cannot exceed total progress",
      });
    }
  });

export const aiProviderPreparationProgressSchema = z
  .object({
    revisionId: z.uuid(),
    completed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    elapsedMs: z.number().int().nonnegative(),
    startedAt: z.coerce.date().nullable(),
    finishedAt: z.coerce.date().nullable(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.completed > value.total) {
      ctx.addIssue({
        code: "custom",
        path: ["completed"],
        message: "Completed progress cannot exceed total progress",
      });
    }
    if (value.failed > value.total) {
      ctx.addIssue({
        code: "custom",
        path: ["failed"],
        message: "Failed progress cannot exceed total progress",
      });
    }
  });

export const aiProviderAvailabilityReadSchema = z
  .object({ availability: aiProviderAvailabilitySchema })
  .strict();

export const aiProviderRevisionInputSchema = z
  .object({ revisionId: z.uuid() })
  .strict();

export const aiProviderDiscardResultSchema = z
  .object({ discarded: z.literal(true) })
  .strict();

export const aiProviderControlReadSchema = z
  .object({
    enabled: z.boolean(),
    availability: aiProviderAvailabilitySchema,
    activeRevisionId: z.uuid().nullable(),
    profileCapabilities: z
      .array(aiProviderProfileCapabilitySchema)
      .length(AI_PROVIDER_PROFILE_CAPABILITIES.length),
    active: aiProviderConfigurationReadSchema.nullable(),
    revisions: z.array(aiProviderConfigurationReadSchema).max(MAX_REVISIONS),
  })
  .strict();
