import type { AiPromptOperationResult } from "@customreport/shared";

import type { AiPromptRepository } from "../infrastructure/ai-prompt.repository.js";
import {
  type AiFeaturePromptCatalog,
  REPORT_ASSISTANT_FEATURE_KEY,
} from "./ai-feature-prompt-catalog.js";
import {
  type AiPromptAuditSink,
  type AiPromptMetricsSink,
} from "./ai-prompt.service-support.js";

export const bootstrapPromptControl = async (
  repository: AiPromptRepository,
  catalog: AiFeaturePromptCatalog,
  audit: AiPromptAuditSink,
  metrics: AiPromptMetricsSink,
  actorId: string,
): Promise<AiPromptOperationResult | null> => {
  const entry = catalog.require(REPORT_ASSISTANT_FEATURE_KEY);
  const baseline = entry.compose(entry.defaultEditableInstructions);
  const created = await repository.bootstrap({
    featureKey: entry.featureKey,
    coreContractVersion: entry.coreContractVersion,
    composerVersion: entry.composerVersion,
    lockedCoreSnapshot: Object.fromEntries(
      baseline.slots.map(({ slot, lockedCore }) => [slot, lockedCore]),
    ),
    promptContents: entry.defaultEditableInstructions,
    effectiveContentHash: baseline.contentHash,
    createdBy: actorId,
  });
  if (!created) return null;
  audit.record({
    event: "ai_prompt.bootstrapped",
    actorId,
    featureKey: entry.featureKey,
    revisionId: created.id,
    contentHash: created.effectiveContentHash,
    contractVersion: created.coreContractVersion,
  });
  metrics.record({
    feature: REPORT_ASSISTANT_FEATURE_KEY,
    operation: "bootstrap",
    outcome: "passed",
  });
  return {
    featureKey: REPORT_ASSISTANT_FEATURE_KEY,
    revisionId: created.id,
    lifecycle: "active",
  };
};
