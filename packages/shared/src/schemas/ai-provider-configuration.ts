import { z } from "zod";

const MAX_MODEL_LENGTH = 200;
const MAX_ENDPOINT_LENGTH = 500;
const MAX_MASKED_SUFFIX_LENGTH = 32;
const MAX_CREDENTIAL_LENGTH = 4096;
const MAX_FAILURE_CODE_LENGTH = 100;
const MAX_CAPABILITIES = 10;
const MAX_REVISIONS = 100;
const CUSTOM_PROVIDER_PROFILE = "custom-openai-compatible" as const;

export const aiProviderProfileSchema = z.enum([
  "mistral",
  "openrouter",
  CUSTOM_PROVIDER_PROFILE,
]);

export const aiProviderLifecycleSchema = z.enum([
  "draft",
  "validated",
  "preparing",
  "active",
  "failed",
  "superseded",
]);

export const aiProviderAvailabilitySchema = z.enum([
  "available",
  "not_configured",
]);

export const aiProviderCapabilitySchema = z.enum([
  "authentication",
  "planner_tool_call",
  "structured_answer",
  "token_usage",
  "batch_embeddings",
]);

export const aiProviderCapabilityStatusSchema = z.enum(["passed", "failed"]);

const modelIdentifierSchema = z.string().trim().min(1).max(MAX_MODEL_LENGTH);
const endpointSchema = z.string().trim().min(1).max(MAX_ENDPOINT_LENGTH);

export const aiProviderDraftSchema = z
  .object({
    profile: aiProviderProfileSchema,
    baseUrl: endpointSchema.optional(),
    plannerModel: modelIdentifierSchema,
    answerModel: modelIdentifierSchema,
    embeddingModel: modelIdentifierSchema,
    credential: z.string().min(1).max(MAX_CREDENTIAL_LENGTH).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasCustomEndpoint = value.baseUrl !== undefined;
    if (value.profile === CUSTOM_PROVIDER_PROFILE && !hasCustomEndpoint) {
      ctx.addIssue({
        code: "custom",
        path: ["baseUrl"],
        message: "A base URL is required for a custom provider",
      });
    }
    if (value.profile !== CUSTOM_PROVIDER_PROFILE && hasCustomEndpoint) {
      ctx.addIssue({
        code: "custom",
        path: ["baseUrl"],
        message: "Built-in providers choose their endpoint automatically",
      });
    }
  });

export const aiProviderConfigurationReadSchema = z
  .object({
    id: z.uuid(),
    profile: aiProviderProfileSchema,
    lifecycle: aiProviderLifecycleSchema,
    baseUrl: endpointSchema,
    plannerModel: modelIdentifierSchema,
    answerModel: modelIdentifierSchema,
    embeddingModel: modelIdentifierSchema,
    embeddingDimensions: z.number().int().positive().nullable(),
    semanticInputVersion: z.string().trim().min(1),
    credentialConfigured: z.boolean(),
    credentialMaskedSuffix: z
      .string()
      .trim()
      .max(MAX_MASKED_SUFFIX_LENGTH)
      .nullable(),
    testResult: z
      .object({
        status: aiProviderCapabilityStatusSchema,
        capabilities: z
          .array(
            z
              .object({
                capability: aiProviderCapabilitySchema,
                status: aiProviderCapabilityStatusSchema,
                failureCode: z
                  .string()
                  .trim()
                  .min(1)
                  .max(MAX_FAILURE_CODE_LENGTH)
                  .optional(),
              })
              .strict(),
          )
          .max(MAX_CAPABILITIES),
        testedAt: z.coerce.date().nullable(),
      })
      .strict()
      .nullable(),
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

export const aiProviderCapabilityTestResultSchema = z
  .object({
    status: aiProviderCapabilityStatusSchema,
    capabilities: z
      .array(
        z
          .object({
            capability: aiProviderCapabilitySchema,
            status: aiProviderCapabilityStatusSchema,
            failureCode: z
              .string()
              .trim()
              .min(1)
              .max(MAX_FAILURE_CODE_LENGTH)
              .optional(),
          })
          .strict(),
      )
      .max(MAX_CAPABILITIES),
    testedAt: z.coerce.date().nullable(),
  })
  .strict();

export const aiProviderAvailabilityReadSchema = z
  .object({ availability: aiProviderAvailabilitySchema })
  .strict();

export const aiProviderRevisionInputSchema = z
  .object({ revisionId: z.uuid() })
  .strict();

export const aiProviderControlReadSchema = z
  .object({
    enabled: z.boolean(),
    availability: aiProviderAvailabilitySchema,
    activeRevisionId: z.uuid().nullable(),
    active: aiProviderConfigurationReadSchema.nullable(),
    revisions: z.array(aiProviderConfigurationReadSchema).max(MAX_REVISIONS),
  })
  .strict();

export type AiProviderProfile = z.infer<typeof aiProviderProfileSchema>;
export type AiProviderLifecycle = z.infer<typeof aiProviderLifecycleSchema>;
export type AiProviderAvailability = z.infer<
  typeof aiProviderAvailabilitySchema
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
export type AiProviderAvailabilityRead = z.infer<
  typeof aiProviderAvailabilityReadSchema
>;
export type AiProviderRevisionInput = z.infer<
  typeof aiProviderRevisionInputSchema
>;
export type AiProviderControlRead = z.infer<typeof aiProviderControlReadSchema>;
