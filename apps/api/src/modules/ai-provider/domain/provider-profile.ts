import { createHash } from "node:crypto";

import type {
  AiProviderConnectionRole,
  AiProviderDraft,
  AiProviderProfile,
} from "@customreport/shared";
import { AI_PROVIDER_PROFILE_CAPABILITIES } from "@customreport/shared";

const BUILT_IN_ENDPOINTS = {
  mistral: "https://api.mistral.ai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  openai: "https://api.openai.com/v1",
  groq: "https://api.groq.com/openai/v1",
  jina: "https://api.jina.ai/v1",
} as const;
const CUSTOM_PROFILE = "custom-openai-compatible" as const;
const ENDPOINT_IDENTITY_HEX_LENGTH = 32;

type ResolvedConnection = Readonly<{
  profile: AiProviderProfile;
  baseUrl: string;
  endpointIdentity: string;
}>;

type ResolvedGenerationProfile = ResolvedConnection &
  Readonly<{
    plannerModel: string;
    answerModel: string;
    reasoningMode: AiProviderDraft["generation"]["reasoningMode"];
    reasoningCustomValue: string | null;
  }>;

// Full provider configuration combines generation and embedding settings; the
// narrower profile above is shared by generation-only flows.
export type ResolvedProviderProfile = ResolvedGenerationProfile &
  Readonly<{
    embeddingModel: string;
    embeddingDimensions: number | null;
    semanticInputVersion: string;
  }>;

export type ResolvedEmbeddingProfile = ResolvedConnection &
  Readonly<{
    model: string;
    dimensions: number | null;
    semanticInputVersion: string;
  }>;

export type ResolvedCompositeProviderProfile = Readonly<{
  generation: ResolvedGenerationProfile;
  embeddings:
    | Readonly<{
        mode: "reuse_generation";
        effective: ResolvedEmbeddingProfile;
      }>
    | Readonly<{
        mode: "separate";
        connection: ResolvedConnection;
        effective: ResolvedEmbeddingProfile;
      }>;
}>;

export class ProviderUrlPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderUrlPolicyError";
  }
}

const parseUrl = (value: string): URL => {
  try {
    const parsed = new URL(value);
    if (!/^https?:$/iu.test(parsed.protocol)) {
      throw new ProviderUrlPolicyError(
        "Provider endpoint must use HTTP or HTTPS",
      );
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new ProviderUrlPolicyError(
        "Provider endpoint must not contain credentials, a query, or a fragment",
      );
    }
    return parsed;
  } catch (error) {
    if (error instanceof ProviderUrlPolicyError) throw error;
    throw new ProviderUrlPolicyError("Provider endpoint must be a valid URL");
  }
};

export const normalizeProviderBaseUrl = (value: string): string => {
  const parsed = parseUrl(value.trim());
  const parts = parsed.pathname.split("/").filter(Boolean);
  const path = parts.length > 0 ? `/${parts.join("/")}` : "";
  return `${parsed.origin}${path}`;
};

const allowedOrigins = (values: string): ReadonlySet<string> => {
  const origins = values
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const parsed = parseUrl(value);
      if (parsed.pathname !== "/")
        throw new ProviderUrlPolicyError(
          "Allowed provider entries must be exact origins",
        );
      return parsed.origin;
    });
  if (origins.length === 0)
    throw new ProviderUrlPolicyError("Provider origin allowlist is empty");
  return new Set(origins);
};

const endpointFor = (
  profile: AiProviderProfile,
  baseUrl: string | undefined,
): string => {
  if (profile === CUSTOM_PROFILE) {
    if (!baseUrl)
      throw new ProviderUrlPolicyError(
        "A custom provider endpoint is required",
      );
    return baseUrl;
  }
  return BUILT_IN_ENDPOINTS[profile];
};

const resolveConnection = (
  profile: AiProviderProfile,
  baseUrl: string | undefined,
  allowed: ReadonlySet<string>,
): ResolvedConnection => {
  const normalizedBaseUrl = normalizeProviderBaseUrl(
    endpointFor(profile, baseUrl),
  );
  if (!allowed.has(new URL(normalizedBaseUrl).origin)) {
    throw new ProviderUrlPolicyError("Provider endpoint is not allowlisted");
  }
  return {
    profile,
    baseUrl: normalizedBaseUrl,
    endpointIdentity: providerEndpointIdentity(profile, normalizedBaseUrl),
  };
};

export const providerEndpointIdentity = (
  profile: AiProviderProfile,
  normalizedBaseUrl: string,
): string => {
  const identityInput = `${profile}\0${normalizedBaseUrl}`;
  const digest = createHash("sha256")
    .update(identityInput, "utf8")
    .digest("hex")
    .slice(0, ENDPOINT_IDENTITY_HEX_LENGTH);
  return `${profile}:${digest}`;
};

export const resolveProviderProfile = (
  draft: AiProviderDraft,
  allowedOriginList: string,
  semanticInputVersion: string,
): ResolvedCompositeProviderProfile => {
  const allowed = allowedOrigins(allowedOriginList);
  const generationConnection = resolveConnection(
    draft.generation.profile,
    draft.generation.baseUrl,
    allowed,
  );
  const generation: ResolvedGenerationProfile = {
    ...generationConnection,
    plannerModel: draft.generation.plannerModel,
    answerModel: draft.generation.answerModel,
    reasoningMode: draft.generation.reasoningMode,
    reasoningCustomValue: draft.generation.reasoningCustomValue ?? null,
  };
  if (draft.embeddings.mode === "reuse_generation") {
    return {
      generation,
      embeddings: {
        mode: "reuse_generation",
        effective: {
          ...generationConnection,
          model: draft.embeddings.model,
          dimensions: null,
          semanticInputVersion,
        },
      },
    };
  }
  const connection = resolveConnection(
    draft.embeddings.profile,
    draft.embeddings.baseUrl,
    allowed,
  );
  return {
    generation,
    embeddings: {
      mode: "separate",
      connection,
      effective: {
        ...connection,
        model: draft.embeddings.model,
        dimensions: null,
        semanticInputVersion,
      },
    },
  };
};

export const endpointSupportsRole = (
  profile: AiProviderProfile,
  role: AiProviderConnectionRole,
): boolean =>
  AI_PROVIDER_PROFILE_CAPABILITIES.some(
    (capability) =>
      capability.profile === profile &&
      (capability.roles as readonly AiProviderConnectionRole[]).includes(role),
  );

export const embeddingScopeChanged = (
  left: Pick<
    ResolvedEmbeddingProfile,
    "endpointIdentity" | "model" | "dimensions" | "semanticInputVersion"
  >,
  right: Pick<
    ResolvedEmbeddingProfile,
    "endpointIdentity" | "model" | "dimensions" | "semanticInputVersion"
  >,
): boolean =>
  left.endpointIdentity !== right.endpointIdentity ||
  left.model !== right.model ||
  left.dimensions !== right.dimensions ||
  left.semanticInputVersion !== right.semanticInputVersion;

export const builtInProviderEndpoints = BUILT_IN_ENDPOINTS;
