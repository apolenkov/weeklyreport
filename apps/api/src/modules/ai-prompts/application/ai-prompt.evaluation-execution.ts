import { AiPromptBundleLifecycle } from "@prisma/client";

import type { StoredAiProviderRevision } from "../../ai-provider/index.js";
import type {
  AiPromptRepository,
  StoredAiPromptBundleRevision,
} from "../infrastructure/ai-prompt.repository.js";
import type { AiFeaturePromptCatalogEntry } from "./ai-feature-prompt-catalog.js";
import { safePromptEvaluation } from "./ai-prompt.evaluation-support.js";
import type { AiPromptSyntheticEvaluator } from "./ai-prompt.evaluator.js";
import {
  type AiPromptAuditSink,
  AiPromptConflictError,
  type AiPromptMetricsSink,
  composedFromRevision,
} from "./ai-prompt.service-support.js";

export const executePromptEvaluation = async (
  repository: AiPromptRepository,
  evaluator: AiPromptSyntheticEvaluator,
  entry: AiFeaturePromptCatalogEntry,
  revision: StoredAiPromptBundleRevision,
  provider: StoredAiProviderRevision,
  audit: AiPromptAuditSink,
  metrics: AiPromptMetricsSink,
  actorId: string,
) => {
  const result = await safePromptEvaluation(
    evaluator,
    entry,
    provider,
    composedFromRevision(entry, revision),
  );
  const evaluation = await repository.recordEvaluation({
    featureKey: revision.featureKey,
    promptRevisionId: revision.id,
    generationCompatibilityIdentity: provider.generationCompatibilityIdentity,
    contentHash: revision.effectiveContentHash,
    contractVersion: revision.coreContractVersion,
    servingContractVersion: entry.servingContractVersion,
    evaluatorVersion: entry.evaluatorVersion,
    checks: result.checks,
    outcome: result.outcome,
    evaluatedAt: new Date(),
  });
  const transitioned =
    revision.lifecycle === AiPromptBundleLifecycle.active
      ? true
      : await repository.transition(
          revision.featureKey,
          revision.id,
          [AiPromptBundleLifecycle.draft, AiPromptBundleLifecycle.failed],
          result.outcome === "passed"
            ? AiPromptBundleLifecycle.validated
            : AiPromptBundleLifecycle.failed,
        );
  if (!transitioned)
    throw new AiPromptConflictError(
      "Prompt lifecycle changed during evaluation",
    );
  audit.record({
    event: "ai_prompt.evaluated",
    actorId,
    featureKey: revision.featureKey,
    revisionId: revision.id,
    providerRevisionId: provider.id,
    contentHash: evaluation.contentHash,
    contractVersion: evaluation.contractVersion,
    evaluatorVersion: evaluation.evaluatorVersion,
    outcome: result.outcome,
  });
  metrics.record({
    feature: "lead-report-assistant",
    operation: "evaluation",
    outcome: result.outcome === "passed" ? "passed" : "failed",
  });
};
