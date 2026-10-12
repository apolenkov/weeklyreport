import type {
  AiProviderProfile,
  AiProviderReasoningMode,
} from "@weeklyreport/shared";

export type OpenAiCompatibleReasoningConfig = Readonly<{
  profile: AiProviderProfile;
  mode: AiProviderReasoningMode;
  customValue: string | null;
}>;

const reasoningEffort = (
  config: OpenAiCompatibleReasoningConfig,
): string | null => {
  if (config.mode === "provider_default") return null;
  if (config.mode === "off") return "none";
  if (!config.customValue) {
    throw new Error("Custom reasoning requires a value");
  }
  return config.customValue;
};

export const reasoningRequestOptions = (
  config: OpenAiCompatibleReasoningConfig | undefined,
): Readonly<{
  reasoningEffort?: string;
  reasoning?: Readonly<{ effort: string }>;
}> => {
  if (!config) return {};
  const effort = reasoningEffort(config);
  if (!effort) return {};
  return config.profile === "openrouter"
    ? { reasoning: { effort } }
    : { reasoningEffort: effort };
};
