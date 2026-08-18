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

export const handoffPromptBaseline = async (
  repository: AiPromptRepository,
  catalog: AiFeaturePromptCatalog,
  audit: AiPromptAuditSink,
  metrics: AiPromptMetricsSink,
  actorId: string,
): Promise<AiPromptOperationResult> => {
  const entry = catalog.require(REPORT_ASSISTANT_FEATURE_KEY);
  const baseline = entry.compose(entry.defaultEditableInstructions);
  const result = await repository.handoff({
    featureKey: entry.featureKey,
    servingContractVersion: entry.servingContractVersion,
    coreContractVersion: entry.coreContractVersion,
    composerVersion: entry.composerVersion,
    lockedCoreSnapshot: Object.fromEntries(
      baseline.slots.map(({ slot, lockedCore }) => [slot, lockedCore]),
    ),
    promptContents: entry.defaultEditableInstructions,
    effectiveContentHash: baseline.contentHash,
    createdBy: actorId,
  });
  if (result.created) {
    audit.record({
      event: "ai_prompt.handoff_created",
      actorId,
      featureKey: entry.featureKey,
      revisionId: result.revision.id,
      contentHash: result.revision.effectiveContentHash,
      contractVersion: result.revision.coreContractVersion,
    });
    metrics.record({
      feature: REPORT_ASSISTANT_FEATURE_KEY,
      operation: "handoff",
      outcome: "passed",
    });
  }
  return {
    featureKey: entry.featureKey,
    revisionId: result.revision.id,
    lifecycle: result.revision.lifecycle,
  };
};
