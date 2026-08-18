import type { StoredAiProviderRevision } from "../../ai-provider/index.js";
import type {
  AiComposedPromptSet,
  AiFeaturePromptCatalogEntry,
} from "./ai-feature-prompt-catalog.js";
import type {
  AiPromptEvaluationResult,
  AiPromptSyntheticEvaluator,
} from "./ai-prompt.evaluator.js";

export const safePromptEvaluation = async (
  evaluator: AiPromptSyntheticEvaluator,
  entry: AiFeaturePromptCatalogEntry,
  provider: StoredAiProviderRevision,
  prompts: AiComposedPromptSet,
): Promise<AiPromptEvaluationResult> => {
  try {
    return await evaluator.evaluate({ feature: entry, provider, prompts });
  } catch (error) {
    const inconclusive =
      typeof error === "object" &&
      error !== null &&
      "retryable" in error &&
      error.retryable === true;
    return {
      outcome: inconclusive ? "inconclusive" : "failed",
      checks: [
        {
          code: "provider_probe_failed",
          status: inconclusive ? "inconclusive" : "failed",
          passedCount: 0,
          failedCount: 1,
        },
      ],
    };
  }
};
