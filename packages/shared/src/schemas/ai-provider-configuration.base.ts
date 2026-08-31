import { z } from "zod";

/** Public shared schema or contract constant for m a x  r e v i s i o n s. */
export const MAX_REVISIONS = 100;
const MAX_MODEL_LENGTH = 200;
const MAX_ENDPOINT_LENGTH = 500;
const MAX_CREDENTIAL_LENGTH = 4096;
const MAX_REASONING_VALUE_LENGTH = 64;
const CUSTOM_PROVIDER_PROFILE = "custom-openai-compatible" as const;

/** Public shared schema or contract constant for ai provider profile schema. */
export const aiProviderProfileSchema = z.enum([
  "mistral",
  "openrouter",
  "openai",
  "groq",
  "jina",
  CUSTOM_PROVIDER_PROFILE,
]);

/** Public shared schema or contract constant for ai provider connection role schema. */
export const aiProviderConnectionRoleSchema = z.enum([
  "generation",
  "embeddings",
]);

/** Public shared schema or contract constant for ai provider profile capability schema. */
export const aiProviderProfileCapabilitySchema = z
  .object({
    profile: aiProviderProfileSchema,
    roles: z.array(aiProviderConnectionRoleSchema).min(1).max(2),
  })
  .strict();

/** Public shared schema or contract constant for a i  p r o v i d e r  p r o f i l e  c a p a b i l i t i e s. */
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

/** Public shared schema or contract constant for profile supports role. */
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

/** Public shared schema or contract constant for ai provider lifecycle schema. */
export const aiProviderLifecycleSchema = z.enum([
  "draft",
  "validated",
  "preparing",
  "active",
  "failed",
  "superseded",
]);

/** Public shared schema or contract constant for ai provider availability schema. */
export const aiProviderAvailabilitySchema = z.enum([
  "available",
  "not_configured",
]);

/** Public shared schema or contract constant for ai provider reasoning mode schema. */
export const aiProviderReasoningModeSchema = z.enum([
  "provider_default",
  "off",
  "custom",
]);

/** Public shared schema or contract constant for ai provider embedding mode schema. */
export const aiProviderEmbeddingModeSchema = z.enum([
  "reuse_generation",
  "separate",
]);

/** Public shared schema or contract constant for reasoning custom value schema. */
export const reasoningCustomValueSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_REASONING_VALUE_LENGTH);
/** Public shared schema or contract constant for model identifier schema. */
export const modelIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_MODEL_LENGTH);
/** Public shared schema or contract constant for endpoint schema. */
export const endpointSchema = z.string().trim().min(1).max(MAX_ENDPOINT_LENGTH);
/** Public shared schema or contract constant for credential schema. */
export const credentialSchema = z.string().min(1).max(MAX_CREDENTIAL_LENGTH);
/** Public fixed mask used when a credential is too short for a safe suffix. */
export const AI_PROVIDER_CREDENTIAL_MASK = "••••";
/** Public suffix length used only when plaintext remains hidden. */
export const AI_PROVIDER_CREDENTIAL_MASK_SUFFIX_LENGTH = 4;
/** Public shared schema or contract constant for masked credential schema. */
export const maskedCredentialSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      value === AI_PROVIDER_CREDENTIAL_MASK ||
      (value.startsWith(AI_PROVIDER_CREDENTIAL_MASK) &&
        Array.from(value.slice(AI_PROVIDER_CREDENTIAL_MASK.length)).length ===
          AI_PROVIDER_CREDENTIAL_MASK_SUFFIX_LENGTH),
    { message: "Credential metadata must use the safe masked format" },
  )
  .nullable();
/** Public shared schema or contract constant for embedding dimensions schema. */
export const embeddingDimensionsSchema = z.number().int().positive().nullable();

/** Public shared schema or contract constant for validate endpoint. */
export const validateEndpoint = (
  value: { profile: string; baseUrl?: string | undefined },
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
