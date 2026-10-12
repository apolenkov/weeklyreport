import { AiPromptBundleLifecycle } from "@prisma/client";
import type {
  AiPromptActivationInput,
  AiPromptDiscardInput,
  AiPromptOperationResult,
  AiPromptRestoreInput,
} from "@weeklyreport/shared";

import type {
  AiPromptRepository,
  StoredAiPromptBundleRevision,
} from "../infrastructure/ai-prompt.repository.js";
import {
  type AiFeaturePromptCatalog,
  REPORT_ASSISTANT_FEATURE_KEY,
} from "./ai-feature-prompt-catalog.js";
import { activateAiPromptRevision } from "./ai-prompt.activation.js";
import {
  type AiPromptAuditSink,
  AiPromptConfigurationError,
  AiPromptConflictError,
  type AiPromptMetricsSink,
  AiPromptNotFoundError,
  featureFromCatalog,
} from "./ai-prompt.service-support.js";

export class AiPromptLifecycleService {
  constructor(
    private readonly repository: AiPromptRepository,
    private readonly catalog: AiFeaturePromptCatalog,
    private readonly audit: AiPromptAuditSink,
    private readonly metrics: AiPromptMetricsSink,
  ) {}

  async activate(
    input: AiPromptActivationInput,
    actorId: string,
  ): Promise<AiPromptOperationResult> {
    return activateAiPromptRevision(
      {
        repository: this.repository,
        catalog: this.catalog,
        audit: this.audit,
        metrics: this.metrics,
      },
      input,
      actorId,
      {
        allowedLifecycle: [
          AiPromptBundleLifecycle.draft,
          AiPromptBundleLifecycle.validated,
          AiPromptBundleLifecycle.failed,
          AiPromptBundleLifecycle.active,
        ],
        operation: "activation",
      },
    );
  }

  async restore(
    input: AiPromptRestoreInput,
    actorId: string,
  ): Promise<AiPromptOperationResult> {
    return activateAiPromptRevision(
      {
        repository: this.repository,
        catalog: this.catalog,
        audit: this.audit,
        metrics: this.metrics,
      },
      input,
      actorId,
      {
        allowedLifecycle: [AiPromptBundleLifecycle.superseded],
        operation: "restore",
      },
    );
  }

  async discard(input: AiPromptDiscardInput, actorId: string) {
    featureFromCatalog(this.catalog, input.featureKey);
    const revision = await this.requireRevision(
      input.featureKey,
      input.revisionId,
    );
    if (
      revision.lifecycle !== AiPromptBundleLifecycle.draft &&
      revision.lifecycle !== AiPromptBundleLifecycle.failed
    ) {
      throw new AiPromptConfigurationError(
        "Only draft or failed AI prompt attempts can be discarded",
      );
    }
    if (
      !(await this.repository.discardDisposable(
        input.featureKey,
        input.revisionId,
      ))
    ) {
      throw new AiPromptConflictError(
        "AI prompt attempt could not be discarded",
      );
    }
    this.audit.record({
      event: "ai_prompt.discarded",
      actorId,
      featureKey: input.featureKey,
      revisionId: input.revisionId,
      contentHash: revision.effectiveContentHash,
      contractVersion: revision.coreContractVersion,
    });
    this.metrics.record({
      feature: REPORT_ASSISTANT_FEATURE_KEY,
      operation: "discard",
      outcome: "passed",
    });
    return {
      featureKey: REPORT_ASSISTANT_FEATURE_KEY,
      revisionId: input.revisionId,
      discarded: true as const,
    };
  }

  private async requireRevision(
    featureKey: string,
    revisionId: string,
  ): Promise<StoredAiPromptBundleRevision> {
    const revision = await this.repository.getRevision(featureKey, revisionId);
    if (!revision) throw new AiPromptNotFoundError();
    return revision;
  }
}
