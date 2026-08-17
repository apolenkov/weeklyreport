import { createHash, randomUUID } from "node:crypto";

import type {
  AiPromptEvaluationInput,
  AiPromptOperationResult,
  AiPromptRestoreInput,
} from "@customreport/shared";
import { AiPromptBundleLifecycle } from "@prisma/client";

import {
  type AiCompatibilityEnqueuer,
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
import { activateAiPromptRevision } from "./ai-prompt.activation.js";
import { executePromptEvaluation } from "./ai-prompt.evaluation-execution.js";
import type { AiPromptSyntheticEvaluator } from "./ai-prompt.evaluator.js";
import {
  type AiPromptAuditSink,
  AiPromptConfigurationError,
  AiPromptConflictError,
  type AiPromptMetricsSink,
  AiPromptNotFoundError,
  bundleRead,
  featureFromCatalog,
} from "./ai-prompt.service-support.js";

const executionIdentity = (
  promptRevisionId: string,
  generationCompatibilityIdentity: string,
  contentHash: string,
  contractVersion: string,
  evaluatorVersion: string,
): string =>
  createHash("sha256")
    .update(
      [
        "prompt-compatibility-v2",
        promptRevisionId,
        generationCompatibilityIdentity,
        contentHash,
        contractVersion,
        evaluatorVersion,
      ].join(":"),
    )
    .digest("hex");

export class AiPromptLifecycleService {
  constructor(
    private readonly repository: AiPromptRepository,
    private readonly providerRepository: AiProviderConfigurationRepository,
    private readonly evaluator: AiPromptSyntheticEvaluator,
    private readonly catalog: AiFeaturePromptCatalog,
    private readonly audit: AiPromptAuditSink,
    private readonly metrics: AiPromptMetricsSink,
    private readonly enqueuer?: AiCompatibilityEnqueuer,
  ) {}

  async evaluate(input: AiPromptEvaluationInput, _actorId: string) {
    const entry = featureFromCatalog(this.catalog, input.featureKey);
    const revision = await this.requireRevision(
      input.featureKey,
      input.revisionId,
    );
    const provider = await this.requireActiveProvider();
    if (!this.enqueuer) {
      throw new AiPromptConfigurationError(
        "AI prompt compatibility queue is not wired",
      );
    }
    const execution = await this.repository.createOrReusePromptExecution(
      revision.id,
      {
        identity: executionIdentity(
          revision.id,
          provider.generationCompatibilityIdentity,
          revision.effectiveContentHash,
          revision.coreContractVersion,
          entry.evaluatorVersion,
        ),
        featureKey: input.featureKey,
        providerRevisionId: provider.id,
        generationCompatibilityIdentity:
          provider.generationCompatibilityIdentity,
        contentHash: revision.effectiveContentHash,
        contractVersion: revision.coreContractVersion,
        evaluatorVersion: entry.evaluatorVersion,
      },
    );
    if (execution.created) {
      await this.enqueuer.enqueue({
        traceId: randomUUID(),
        executionId: execution.id,
        kind: "prompt_evaluation",
      });
    }
    return bundleRead(
      entry,
      await this.requireRevision(input.featureKey, revision.id),
    );
  }

  async executeEvaluation(
    input: AiPromptEvaluationInput,
    providerRevisionId?: string,
    actorId = "worker",
  ) {
    const entry = featureFromCatalog(this.catalog, input.featureKey);
    const revision = await this.requireRevision(
      input.featureKey,
      input.revisionId,
    );
    const provider = providerRevisionId
      ? await this.providerRepository.getRevision(providerRevisionId)
      : await this.requireActiveProvider();
    if (!provider) {
      throw new AiPromptConfigurationError(
        "AI provider revision is not available",
      );
    }
    await executePromptEvaluation(
      this.repository,
      this.evaluator,
      entry,
      revision,
      provider,
      this.audit,
      this.metrics,
      actorId,
    );
    return bundleRead(
      entry,
      await this.requireRevision(input.featureKey, revision.id),
    );
  }

  async activate(
    input: AiPromptEvaluationInput & { evaluationId: string },
    actorId: string,
  ): Promise<AiPromptOperationResult> {
    return activateAiPromptRevision(
      {
        repository: this.repository,
        providerRepository: this.providerRepository,
        catalog: this.catalog,
        audit: this.audit,
        metrics: this.metrics,
      },
      input,
      actorId,
      [AiPromptBundleLifecycle.validated],
      "activation",
    );
  }

  async restore(
    input: AiPromptRestoreInput,
    actorId: string,
  ): Promise<AiPromptOperationResult> {
    return activateAiPromptRevision(
      {
        repository: this.repository,
        providerRepository: this.providerRepository,
        catalog: this.catalog,
        audit: this.audit,
        metrics: this.metrics,
      },
      input,
      actorId,
      [AiPromptBundleLifecycle.superseded],
      "restore",
    );
  }

  async discard(input: AiPromptEvaluationInput, actorId: string) {
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

  private async requireActiveProvider(): Promise<StoredAiProviderRevision> {
    const control = await this.providerRepository.getControl();
    const provider = control?.activeConfiguration;
    if (!control?.enabled || provider?.lifecycle !== "active") {
      throw new AiPromptConfigurationError("AI provider is not configured");
    }
    return provider;
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
