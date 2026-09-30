import { z } from "zod";

/** Maximum provider revisions returned in administrator history. */
export const MAX_REVISIONS = 100;
const MAX_MODEL_LENGTH = 200;
const MAX_ENDPOINT_LENGTH = 500;
const MAX_CREDENTIAL_LENGTH = 4096;
const MAX_REASONING_VALUE_LENGTH = 64;
const CUSTOM_PROVIDER_PROFILE = "custom-openai-compatible" as const;

/** Provider profiles supported by generation or embedding connections. */
export const aiProviderProfileSchema = z.enum([
  "mistral",
  "openrouter",
  "openai",
  "groq",
  "jina",
  CUSTOM_PROVIDER_PROFILE,
]);

/** Capabilities assigned to provider connections. */
export const aiProviderConnectionRoleSchema = z.enum([
  "generation",
  "embeddings",
]);

/** Validates the capabilities supported by one provider profile. */
export const aiProviderProfileCapabilitySchema = z
  .object({
    profile: aiProviderProfileSchema,
    roles: z.array(aiProviderConnectionRoleSchema).min(1).max(2),
  })
  .strict();

/** Canonical capability registry for every supported provider profile. */
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

/** Returns whether a provider profile supports a connection capability. */
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

/** Lifecycle states of an immutable provider configuration revision. */
export const aiProviderLifecycleSchema = z.enum([
  "draft",
  "validated",
  "preparing",
  "active",
  "failed",
  "superseded",
]);

/** Runtime availability derived from the active provider configuration. */
export const aiProviderAvailabilitySchema = z.enum([
  "available",
  "not_configured",
]);

/** Supported reasoning controls for generation models. */
export const aiProviderReasoningModeSchema = z.enum([
  "provider_default",
  "off",
  "custom",
]);

/** Validates a non-empty provider-specific reasoning value. */
export const reasoningCustomValueSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_REASONING_VALUE_LENGTH);
/** Validates a provider model identifier. */
export const modelIdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_MODEL_LENGTH);
/** Validates the configured custom-provider endpoint text. */
export const endpointSchema = z.string().trim().min(1).max(MAX_ENDPOINT_LENGTH);
/** Validates the length of a submitted provider credential. */
export const credentialSchema = z.string().min(1).max(MAX_CREDENTIAL_LENGTH);
/** Public fixed mask used when a credential is too short for a safe suffix. */
export const AI_PROVIDER_CREDENTIAL_MASK = "••••";
/** Public suffix length used only when plaintext remains hidden. */
export const AI_PROVIDER_CREDENTIAL_MASK_SUFFIX_LENGTH = 4;
/** Accepts only the fixed credential mask with an optional four-character suffix. */
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
/** Accepts measured embedding dimensions or an unmeasured null state. */
export const embeddingDimensionsSchema = z.number().int().positive().nullable();

/** Enforces that only custom profiles supply an explicit base URL. */
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
