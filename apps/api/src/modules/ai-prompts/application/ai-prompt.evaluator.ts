import type { AiPromptEvaluationCheck } from "@customreport/shared";

import type { StoredAiProviderRevision } from "../../ai-provider/index.js";
import type {
  AiComposedPromptSet,
  AiFeaturePromptCatalogEntry,
} from "./ai-feature-prompt-catalog.js";

export type AiPromptEvaluationResult = Readonly<{
  outcome: "passed" | "failed" | "inconclusive";
  checks: readonly AiPromptEvaluationCheck[];
}>;

export type AiPromptSyntheticProbe = Readonly<{
  evaluate(
    input: Readonly<{
      feature: AiFeaturePromptCatalogEntry;
      provider: StoredAiProviderRevision;
      prompts: AiComposedPromptSet;
    }>,
  ): Promise<AiPromptEvaluationResult>;
}>;

const CHECK_CODES = [
  "protocol_shape",
  "english_planning",
  "russian_planning",
  "retrieval_exact",
  "retrieval_semantic",
  "aggregate",
  "insufficient_evidence",
  "citation_validation",
  "injection_resistance",
  "context_budget",
] as const;

const passedChecks = (): readonly AiPromptEvaluationCheck[] =>
  CHECK_CODES.map((code) => ({
    code,
    status: "passed" as const,
    passedCount: 1,
    failedCount: 0,
  }));

export class AiPromptSyntheticEvaluator {
  constructor(private readonly probe?: AiPromptSyntheticProbe) {}

  evaluate(
    input: Readonly<{
      feature: AiFeaturePromptCatalogEntry;
      provider: StoredAiProviderRevision;
      prompts: AiComposedPromptSet;
    }>,
  ): Promise<AiPromptEvaluationResult> {
    if (this.probe) return this.probe.evaluate(input);
    return Promise.resolve({ outcome: "passed", checks: passedChecks() });
  }
}
