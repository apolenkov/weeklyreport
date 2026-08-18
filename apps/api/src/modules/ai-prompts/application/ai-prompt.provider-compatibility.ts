import type {
  AiProviderCapabilityTestResult,
  AiProviderFeatureCompatibility,
} from "@customreport/shared";
import {
  aiPromptEvaluationReadSchema,
  aiProviderCapabilityTestResultSchema,
} from "@customreport/shared";

import type {
  AiProviderConfigurationRepository,
  StoredAiProviderRevision,
} from "../../ai-provider/index.js";
import type { AiPromptRepository } from "../infrastructure/ai-prompt.repository.js";
import type { StoredAiPromptEvaluation } from "../infrastructure/ai-prompt.repository.types.js";
import type { AiFeaturePromptCatalog } from "./ai-feature-prompt-catalog.js";
import { safePromptEvaluation } from "./ai-prompt.evaluation-support.js";
import type { AiPromptSyntheticEvaluator } from "./ai-prompt.evaluator.js";
import {
  type AiPromptMetricsSink,
  composedFromRevision,
} from "./ai-prompt.service-support.js";

export type AiPromptProviderCompatibilityResult = Readonly<{
  status: AiProviderCapabilityTestResult["status"];
  features: readonly AiProviderFeatureCompatibility[];
}>;

const compatibilityStatus = (
  features: readonly AiProviderFeatureCompatibility[],
): AiProviderCapabilityTestResult["status"] =>
  features.some(({ outcome }) => outcome === "failed")
    ? "failed"
    : features.some(({ outcome }) => outcome === "inconclusive")
      ? "inconclusive"
      : "passed";

const featureFromEvaluation = (
  evaluation: StoredAiPromptEvaluation,
): AiProviderFeatureCompatibility => {
  const parsed = aiPromptEvaluationReadSchema.parse(evaluation);
  return {
    featureKey: parsed.featureKey,
    promptRevisionId: parsed.promptRevisionId,
    contentHash: parsed.contentHash,
    evaluatorVersion: parsed.evaluatorVersion,
    outcome: parsed.outcome,
    checks: parsed.checks,
  };
};

const passingSnapshotFeature = (
  provider: StoredAiProviderRevision,
  expected: Readonly<{
    featureKey: string;
    promptRevisionId: string;
    contentHash: string;
    evaluatorVersion: string;
  }>,
): AiProviderFeatureCompatibility | null => {
  const parsed = aiProviderCapabilityTestResultSchema.safeParse(
    provider.testResult,
  );
  if (!parsed.success) return null;
  return (
    parsed.data.generation.featureCompatibility.find(
      (feature) =>
        feature.featureKey === expected.featureKey &&
        feature.promptRevisionId === expected.promptRevisionId &&
        feature.contentHash === expected.contentHash &&
        feature.evaluatorVersion === expected.evaluatorVersion &&
        feature.outcome === "passed",
    ) ?? null
  );
};

export class AiPromptProviderCompatibilityService {
  constructor(
    private readonly repository: AiPromptRepository,
    private readonly evaluator: AiPromptSyntheticEvaluator,
    private readonly catalog: AiFeaturePromptCatalog,
    private readonly metrics: AiPromptMetricsSink,
    private readonly providerRepository: AiProviderConfigurationRepository,
  ) {}

  private async recoverPassingSnapshot(
    provider: StoredAiProviderRevision,
    expected: Readonly<{
      featureKey: string;
      promptRevisionId: string;
      contentHash: string;
      contractVersion: string;
      servingContractVersion: string;
      evaluatorVersion: string;
    }>,
  ): Promise<AiProviderFeatureCompatibility | null> {
    const own = passingSnapshotFeature(provider, expected);
    const activeProvider = own
      ? null
      : (await this.providerRepository.getControl())?.activeConfiguration;
    const inherited =
      activeProvider?.generationCompatibilityIdentity ===
      provider.generationCompatibilityIdentity
        ? passingSnapshotFeature(activeProvider, expected)
        : null;
    const snapshot = own ?? inherited;
    if (!snapshot) return null;
    const recorded = await this.repository.recordEvaluation({
      featureKey: expected.featureKey,
      promptRevisionId: expected.promptRevisionId,
      generationCompatibilityIdentity: provider.generationCompatibilityIdentity,
      contentHash: expected.contentHash,
      contractVersion: expected.contractVersion,
      servingContractVersion: expected.servingContractVersion,
      evaluatorVersion: expected.evaluatorVersion,
      checks: snapshot.checks,
      outcome: "passed",
      evaluatedAt: new Date(),
    });
    return featureFromEvaluation(recorded);
  }

  currentFeatureEvaluatorVersions(): Readonly<Record<string, string>> {
    return Object.fromEntries(
      this.catalog
        .list()
        .map(({ featureKey, evaluatorVersion }) => [
          featureKey,
          evaluatorVersion,
        ]),
    );
  }

  async evaluate(
    provider: StoredAiProviderRevision,
  ): Promise<AiPromptProviderCompatibilityResult> {
    const features = await this.catalog.list().reduce(
      async (pending, entry) => {
        const collected = await pending;
        const control = await this.repository.getControl(entry.featureKey);
        const active = control?.activeRevision;
        if (!active) return [...collected, null] as const;
        if (active.servingContractVersion !== entry.servingContractVersion) {
          return [...collected, null] as const;
        }
        const lookup = {
          promptRevisionId: active.id,
          generationCompatibilityIdentity:
            provider.generationCompatibilityIdentity,
          contentHash: active.effectiveContentHash,
          contractVersion: active.coreContractVersion,
          servingContractVersion: entry.servingContractVersion,
          evaluatorVersion: entry.evaluatorVersion,
        };
        const existing = await this.repository.findEvaluation(lookup);
        if (existing?.outcome === "passed") {
          return [...collected, featureFromEvaluation(existing)] as const;
        }
        const recovered = await this.recoverPassingSnapshot(provider, {
          featureKey: entry.featureKey,
          ...lookup,
        });
        if (recovered) return [...collected, recovered] as const;
        const result = await safePromptEvaluation(
          this.evaluator,
          entry,
          provider,
          composedFromRevision(entry, active),
        );
        const recorded = await this.repository.recordEvaluation({
          featureKey: entry.featureKey,
          promptRevisionId: active.id,
          generationCompatibilityIdentity:
            provider.generationCompatibilityIdentity,
          contentHash: active.effectiveContentHash,
          contractVersion: active.coreContractVersion,
          servingContractVersion: entry.servingContractVersion,
          evaluatorVersion: entry.evaluatorVersion,
          checks: [...result.checks] as Record<string, string | number>[],
          outcome: result.outcome,
          evaluatedAt: new Date(),
        });
        return [...collected, featureFromEvaluation(recorded)] as const;
      },
      Promise.resolve([] as readonly (AiProviderFeatureCompatibility | null)[]),
    );
    const present = features.filter(
      (feature): feature is AiProviderFeatureCompatibility => feature !== null,
    );
    const status = compatibilityStatus(present);
    this.metrics.record({
      feature: "lead-report-assistant",
      operation: "evaluation",
      outcome: status === "passed" ? "passed" : "failed",
    });
    return {
      status,
      features: present,
    };
  }

  async verify(provider: StoredAiProviderRevision): Promise<boolean> {
    const checks = await Promise.all(
      this.catalog.list().map(async (entry) => {
        const control = await this.repository.getControl(entry.featureKey);
        const active = control?.activeRevision;
        if (!active) return true;
        if (active.servingContractVersion !== entry.servingContractVersion) {
          return false;
        }
        return (
          passingSnapshotFeature(provider, {
            featureKey: entry.featureKey,
            promptRevisionId: active.id,
            contentHash: active.effectiveContentHash,
            evaluatorVersion: entry.evaluatorVersion,
          }) !== null
        );
      }),
    );
    return checks.every(Boolean);
  }
}
