import type {
  AiPromptEvaluationInput,
  AiPromptOperationResult,
} from "@customreport/shared";
import { AiPromptBundleLifecycle } from "@prisma/client";

import {
  AiProviderConfigurationRepository,
  type StoredAiProviderRevision,
} from "../../ai-provider/index.js";
import type {
  AiPromptRepository,
  StoredAiPromptBundleRevision,
} from "../infrastructure/ai-prompt.repository.js";
import {
  type AiFeaturePromptCatalog,
  REPORT_ASSISTANT_FEATURE_KEY,
} from "./ai-feature-prompt-catalog.js";
import {
  type AiPromptAuditSink,
  AiPromptConfigurationError,
  AiPromptConflictError,
  type AiPromptMetricsSink,
  AiPromptNotFoundError,
  composedFromRevision,
  featureFromCatalog,
} from "./ai-prompt.service-support.js";

type ActivationDependencies = Readonly<{
  repository: AiPromptRepository;
  providerRepository: AiProviderConfigurationRepository;
  catalog: AiFeaturePromptCatalog;
  audit: AiPromptAuditSink;
  metrics: AiPromptMetricsSink;
}>;

const requireActiveProvider = async (
  providerRepository: AiProviderConfigurationRepository,
): Promise<StoredAiProviderRevision> => {
  const control = await providerRepository.getControl();
  const provider = control?.activeConfiguration;
  if (!control?.enabled || provider?.lifecycle !== "active") {
    throw new AiPromptConfigurationError("AI provider is not configured");
  }
  return provider;
};

const requireRevision = async (
  repository: AiPromptRepository,
  featureKey: string,
  revisionId: string,
): Promise<StoredAiPromptBundleRevision> => {
  const revision = await repository.getRevision(featureKey, revisionId);
  if (!revision) throw new AiPromptNotFoundError();
  return revision;
};

export const activateAiPromptRevision = async (
  dependencies: ActivationDependencies,
  input: AiPromptEvaluationInput & { evaluationId?: string },
  actorId: string,
  allowedLifecycle: readonly AiPromptBundleLifecycle[],
  operation: "activation" | "restore",
): Promise<AiPromptOperationResult> => {
  const entry = featureFromCatalog(dependencies.catalog, input.featureKey);
  const revision = await requireRevision(
    dependencies.repository,
    input.featureKey,
    input.revisionId,
  );
  const provider = await requireActiveProvider(dependencies.providerRepository);
  const evaluation = await dependencies.repository.findEvaluation({
    promptRevisionId: revision.id,
    generationCompatibilityIdentity: provider.generationCompatibilityIdentity,
    contentHash: revision.effectiveContentHash,
    contractVersion: revision.coreContractVersion,
    evaluatorVersion: entry.evaluatorVersion,
  });
  const passingEvaluation =
    evaluation?.outcome === "passed" ? evaluation : null;
  if (!passingEvaluation) {
    throw new AiPromptConfigurationError(
      "A current passing provider/prompt evaluation is required",
    );
  }
  if (input.evaluationId && input.evaluationId !== passingEvaluation.id) {
    throw new AiPromptConflictError("Prompt evaluation is stale");
  }
  composedFromRevision(entry, revision);
  const activated = await dependencies.repository.activate(
    input.featureKey,
    revision.id,
    allowedLifecycle,
    new Date(),
    {
      generationCompatibilityIdentity: provider.generationCompatibilityIdentity,
      contentHash: revision.effectiveContentHash,
      contractVersion: revision.coreContractVersion,
      evaluatorVersion: entry.evaluatorVersion,
      evaluationId: passingEvaluation.id,
    },
  );
  if (!activated) {
    throw new AiPromptConflictError("Prompt activation lost a lifecycle race");
  }
  dependencies.audit.record({
    event:
      operation === "restore" ? "ai_prompt.restored" : "ai_prompt.activated",
    actorId,
    featureKey: input.featureKey,
    revisionId: revision.id,
    providerRevisionId: provider.id,
    contentHash: revision.effectiveContentHash,
    contractVersion: revision.coreContractVersion,
    evaluatorVersion: entry.evaluatorVersion,
  });
  dependencies.metrics.record({
    feature: REPORT_ASSISTANT_FEATURE_KEY,
    operation,
    outcome: "passed",
  });
  return {
    featureKey: REPORT_ASSISTANT_FEATURE_KEY,
    revisionId: revision.id,
    lifecycle: "active",
  };
};
