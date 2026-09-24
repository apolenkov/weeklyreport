import type {
  AiProviderProfile,
  AiProviderReasoningMode,
} from "@customreport/shared";

export const CUSTOM_PROVIDER_PROFILE = "custom-openai-compatible" as const;

export const profileLabel = (profile: AiProviderProfile): string => {
  if (profile === CUSTOM_PROVIDER_PROFILE) return "Custom OpenAI-compatible";
  return profile === "openrouter"
    ? "OpenRouter"
    : profile.charAt(0).toUpperCase() + profile.slice(1);
};

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
