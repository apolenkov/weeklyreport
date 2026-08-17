import { z } from "zod";

export const MAX_REVISIONS = 100;
const MAX_MODEL_LENGTH = 200;
const MAX_ENDPOINT_LENGTH = 500;
const MAX_MASKED_SUFFIX_LENGTH = 32;
const MAX_CREDENTIAL_LENGTH = 4096;
const MAX_REASONING_VALUE_LENGTH = 64;
const CUSTOM_PROVIDER_PROFILE = "custom-openai-compatible" as const;

export const aiProviderProfileSchema = z.enum([
  "mistral",
  "openrouter",
  "openai",
  "groq",
  "jina",
  CUSTOM_PROVIDER_PROFILE,
]);

export const aiProviderConnectionRoleSchema = z.enum([
  "generation",
  "embeddings",
]);

export const aiProviderProfileCapabilitySchema = z
  .object({
    profile: aiProviderProfileSchema,
    roles: z.array(aiProviderConnectionRoleSchema).min(1).max(2),
  })
  .strict();

export const AI_PROVIDER_PROFILE_CAPABILITIES = [
  { profile: "mistral", roles: ["generation", "embeddings"] },
  { profile: "openrouter", roles: ["generation", "embeddings"] },
  { profile: "openai", roles: ["generation", "embeddings"] },
  { profile: "groq", roles: ["generation"] },
  { profile: "jina", roles: ["embeddings"] },
  {
    profile: CUSTOM_PROVIDER_PROFILE,
    roles: ["generation", "embeddings"],
  },
] as const satisfies readonly z.input<
  typeof aiProviderProfileCapabilitySchema
>[];

export const profileSupportsRole = (
  profile: z.infer<typeof aiProviderProfileSchema>,
  role: z.infer<typeof aiProviderConnectionRoleSchema>,
): boolean =>
  AI_PROVIDER_PROFILE_CAPABILITIES.some(
    ({ profile: candidate, roles }) =>
      candidate === profile &&
      (
        roles as readonly z.infer<typeof aiProviderConnectionRoleSchema>[]
      ).includes(role),
  );

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

export const aiProviderReasoningModeSchema = z.enum([
  "provider_default",
  "off",
  "custom",
]);

export const aiProviderEmbeddingModeSchema = z.enum([
  "reuse_generation",
  "separate",
]);

export const reasoningCustomValueSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_REASONING_VALUE_LENGTH);
export const modelIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_MODEL_LENGTH);
export const endpointSchema = z.string().trim().min(1).max(MAX_ENDPOINT_LENGTH);
export const credentialSchema = z.string().min(1).max(MAX_CREDENTIAL_LENGTH);
export const maskedCredentialSchema = z
  .string()
  .trim()
  .max(MAX_MASKED_SUFFIX_LENGTH)
  .nullable();
export const embeddingDimensionsSchema = z.number().int().positive().nullable();

export const validateEndpoint = (
  value: { profile: string; baseUrl?: string },
  ctx: z.RefinementCtx,
): void => {
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
};
