import type {
  AiPromptCatalogRead,
  AiPromptDraftInput,
  AiPromptFeatureRead,
  AiPromptOperationResult,
  AiPromptRestoreInput,
} from "@customreport/shared";
import {
  aiPromptCatalogReadSchema,
  aiPromptContentsSchema,
  aiPromptFeatureReadSchema,
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
  aiFeaturePromptCatalog,
  type AiFeaturePromptCatalogEntry,
  composePromptSet,
} from "./ai-feature-prompt-catalog.js";
import { bootstrapPromptControl } from "./ai-prompt.bootstrap.js";
import type { AiPromptSyntheticEvaluator } from "./ai-prompt.evaluator.js";
import { AiPromptLifecycleService } from "./ai-prompt.lifecycle-service.js";
import {
  type AiPromptProviderCompatibilityResult,
  AiPromptProviderCompatibilityService,
} from "./ai-prompt.provider-compatibility.js";
import {
  type AiPromptAuditSink,
  AiPromptConfigurationError,
  type AiPromptMetricsSink,
  AiPromptNotFoundError,
  bundleRead,
  featureFromCatalog,
  lockedCoreFrom,
  NOOP_AI_PROMPT_AUDIT,
  NOOP_AI_PROMPT_METRICS,
  promptAvailability,
} from "./ai-prompt.service-support.js";

export class AiPromptService {
  private readonly lifecycle: AiPromptLifecycleService;
  private readonly compatibility: AiPromptProviderCompatibilityService;

  constructor(
    private readonly repository: AiPromptRepository,
    private readonly providerRepository: AiProviderConfigurationRepository,
    evaluator: AiPromptSyntheticEvaluator,
    private readonly catalog: AiFeaturePromptCatalog = aiFeaturePromptCatalog,
    audit: AiPromptAuditSink = NOOP_AI_PROMPT_AUDIT,
    metrics: AiPromptMetricsSink = NOOP_AI_PROMPT_METRICS,
    enqueuer?: AiCompatibilityEnqueuer,
  ) {
    this.lifecycle = new AiPromptLifecycleService(
      repository,
      providerRepository,
      evaluator,
      catalog,
      audit,
      metrics,
      enqueuer,
    );
    this.compatibility = new AiPromptProviderCompatibilityService(
      repository,
      evaluator,
      catalog,
      metrics,
      providerRepository,
    );
    this.audit = audit;
    this.metrics = metrics;
  }

  private readonly audit: AiPromptAuditSink;
  private readonly metrics: AiPromptMetricsSink;

  async list(): Promise<AiPromptCatalogRead> {
    const provider = await this.activeProvider();
    const features = await Promise.all(
      this.catalog.list().map((entry) => this.readEntry(entry, provider)),
    );
    return aiPromptCatalogReadSchema.parse({ features });
  }

  async read(featureKey: string): Promise<AiPromptFeatureRead> {
    const entry = featureFromCatalog(this.catalog, featureKey);
    return aiPromptFeatureReadSchema.parse(
      await this.readEntry(entry, await this.activeProvider()),
    );
  }

  async draft(input: AiPromptDraftInput, actorId: string) {
    const entry = featureFromCatalog(this.catalog, input.featureKey);
    const base = await this.requireRevision(
      input.featureKey,
      input.baseRevisionId,
    );
    if (
      base.lifecycle === AiPromptBundleLifecycle.draft ||
      base.lifecycle === AiPromptBundleLifecycle.failed
    ) {
      throw new AiPromptConfigurationError(
        "A draft must be based on a retained prompt revision",
      );
    }
    const promptContents = aiPromptContentsSchema.parse(input.promptContents);
    const lockedCoreSnapshot = lockedCoreFrom(base.lockedCoreSnapshot);
    const composed = composePromptSet(
      entry,
      promptContents,
      lockedCoreSnapshot,
    );
    const created = await this.repository.createDraft({
      featureKey: input.featureKey,
      baseRevisionId: base.id,
      coreContractVersion: base.coreContractVersion,
      composerVersion: base.composerVersion,
      lockedCoreSnapshot: lockedCoreSnapshot,
      promptContents,
      effectiveContentHash: composed.contentHash,
      createdBy: actorId,
    });
    this.audit.record({
      event: "ai_prompt.draft_created",
      actorId,
      featureKey: input.featureKey,
      revisionId: created.id,
      baseRevisionId: base.id,
      contentHash: created.effectiveContentHash,
      contractVersion: created.coreContractVersion,
    });
    this.metrics.record({
      feature: "lead-report-assistant",
      operation: "draft",
      outcome: "passed",
    });
    return bundleRead(entry, created);
  }

  evaluate(
    input: Parameters<AiPromptLifecycleService["evaluate"]>[0],
    actorId: string,
  ) {
    return this.lifecycle.evaluate(input, actorId);
  }

  executeEvaluation(
    input: Parameters<AiPromptLifecycleService["evaluate"]>[0],
    providerRevisionId?: string,
  ) {
    return this.lifecycle.executeEvaluation(input, providerRevisionId);
  }

  activate(
    input: Parameters<AiPromptLifecycleService["activate"]>[0],
    actorId: string,
  ): Promise<AiPromptOperationResult> {
    return this.lifecycle.activate(input, actorId);
  }

  restore(
    input: AiPromptRestoreInput,
    actorId: string,
  ): Promise<AiPromptOperationResult> {
    return this.lifecycle.restore(input, actorId);
  }

  discard(
    input: Parameters<AiPromptLifecycleService["discard"]>[0],
    actorId: string,
  ) {
    return this.lifecycle.discard(input, actorId);
  }

  evaluateProviderCompatibility(
    provider: StoredAiProviderRevision,
  ): Promise<AiPromptProviderCompatibilityResult> {
    return this.compatibility.evaluate(provider);
  }

  verifyProviderCompatibility(provider: StoredAiProviderRevision) {
    return this.compatibility.verify(provider);
  }

  currentFeatureEvaluatorVersions(): Readonly<Record<string, string>> {
    return this.compatibility.currentFeatureEvaluatorVersions();
  }

  async bootstrap(
    actorId = "bootstrap",
  ): Promise<AiPromptOperationResult | null> {
    return bootstrapPromptControl(
      this.repository,
      this.catalog,
      this.audit,
      this.metrics,
      actorId,
    );
  }

  private async readEntry(
    entry: AiFeaturePromptCatalogEntry,
    provider: StoredAiProviderRevision | null,
  ): Promise<AiPromptFeatureRead> {
    const control = await this.repository.getControl(entry.featureKey);
    const activeBundle = control?.activeRevision
      ? bundleRead(entry, control.activeRevision)
      : null;
    const latestRevision = control?.latestRevision
      ? bundleRead(entry, control.latestRevision)
      : null;
    const history = (control?.history ?? []).map((revision) =>
      bundleRead(entry, revision),
    );
    return {
      featureKey: entry.featureKey,
      displayName: entry.displayName,
      description: entry.description,
      slots: entry.slots.map((slot) => ({
        slot,
        displayName: slot.replaceAll("-", " "),
        required: true,
      })),
      control: {
        featureKey: entry.featureKey,
        activeRevisionId: control?.activeRevisionId ?? null,
        activeBundle,
        latestRevision,
        history,
        availability: promptAvailability(entry, control, provider),
      },
    };
  }

  private async activeProvider(): Promise<StoredAiProviderRevision | null> {
    const control = await this.providerRepository.getControl();
    return control?.enabled &&
      control.activeConfiguration?.lifecycle === "active"
      ? control.activeConfiguration
      : null;
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
