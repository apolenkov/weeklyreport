import { AiPromptBundleLifecycle } from "@prisma/client";
import type {
  AiPromptActivationInput,
  AiPromptOperationResult,
} from "@weeklyreport/shared";

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
  catalog: AiFeaturePromptCatalog;
  audit: AiPromptAuditSink;
  metrics: AiPromptMetricsSink;
}>;

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
  input: AiPromptActivationInput,
  actorId: string,
  activation: Readonly<{
    allowedLifecycle: readonly AiPromptBundleLifecycle[];
    operation: "activation" | "restore";
  }>,
): Promise<AiPromptOperationResult> => {
  const { allowedLifecycle, operation } = activation;
  const entry = featureFromCatalog(dependencies.catalog, input.featureKey);
  const revision = await requireRevision(
    dependencies.repository,
    input.featureKey,
    input.revisionId,
  );
  if (revision.servingContractVersion !== entry.servingContractVersion) {
    throw new AiPromptConfigurationError(
      "This prompt revision belongs to a retired serving contract",
    );
  }
  composedFromRevision(entry, revision);
  const activated = await dependencies.repository.activate(
    input.featureKey,
    revision.id,
    {
      allowedLifecycle,
      now: new Date(),
      contract: { servingContractVersion: entry.servingContractVersion },
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
    contentHash: revision.effectiveContentHash,
    contractVersion: revision.coreContractVersion,
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
