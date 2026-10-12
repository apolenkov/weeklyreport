import type {
  AiProviderConfigurationRead,
  AiProviderProfile,
  AiProviderReasoningMode,
} from "@customreport/shared";

export const CUSTOM_PROVIDER_PROFILE = "custom-openai-compatible" as const;

const PROFILE_LABELS: Readonly<Record<AiProviderProfile, string>> = {
  mistral: "Mistral",
  openrouter: "OpenRouter",
  openai: "OpenAI",
  groq: "Groq",
  jina: "Jina",
  [CUSTOM_PROVIDER_PROFILE]: "Custom OpenAI-compatible",
};

export const profileLabel = (profile: AiProviderProfile): string =>
  PROFILE_LABELS[profile];

export interface AiProviderFormState {
  generation: {
    profile: AiProviderProfile;
    baseUrl: string;
    plannerModel: string;
    answerModel: string;
    reasoningMode: AiProviderReasoningMode;
    reasoningCustomValue: string;
    credential: string;
  };
  embeddings: {
    mode: "reuse_generation" | "separate";
    profile: AiProviderProfile;
    baseUrl: string;
    model: string;
    credential: string;
  };
}

export const hasPendingExecution = (
  revision: AiProviderConfigurationRead | null,
): boolean => {
  const state = revision?.latestExecution?.state;
  return state === "queued" || state === "running";
};

export const embeddingDimensionsLabel = (dimensions: number | null): string =>
  dimensions === null ? "not measured" : String(dimensions);
