import type {
  AiCompatibilityExecutionRead,
  AiPromptBundleRead,
  AiPromptContents,
  AiPromptEvaluationRead,
  AiPromptFeatureRead,
} from "@customreport/shared";
import { aiCompatibilityExecutionReadSchema } from "@customreport/shared";
import {
  AI_PROMPT_SLOT_KEYS,
  aiPromptBundleReadSchema,
  aiPromptContentsSchema,
  aiPromptEvaluationReadSchema,
  aiPromptSlotSchema,
} from "@customreport/shared";

import type { StoredAiProviderRevision } from "../../ai-provider/index.js";
import type {
  StoredAiFeaturePromptControl,
  StoredAiPromptBundleRevision,
} from "../infrastructure/ai-prompt.repository.js";
import {
  type AiComposedPromptSet,
  type AiFeaturePromptCatalog,
  type AiFeaturePromptCatalogEntry,
  composePromptSet,
} from "./ai-feature-prompt-catalog.js";
import type {
  AiPromptEvaluationResult,
  AiPromptSyntheticEvaluator,
} from "./ai-prompt.evaluator.js";

export type AiPromptAuditSink = Readonly<{
  record(event: Readonly<Record<string, string | number | null>>): void;
}>;

export type AiPromptMetricsSink = Readonly<{
  record(
    input: Readonly<{
      feature: "lead-report-assistant";
      operation:
        | "draft"
        | "evaluation"
        | "activation"
        | "restore"
        | "discard"
        | "bootstrap";
      outcome: "passed" | "failed";
    }>,
  ): void;
}>;

export const NOOP_AI_PROMPT_AUDIT: AiPromptAuditSink = {
  record: () => undefined,
};

export const NOOP_AI_PROMPT_METRICS: AiPromptMetricsSink = {
  record: () => undefined,
};

export class AiPromptNotFoundError extends Error {
  constructor() {
    super("AI prompt revision was not found");
    this.name = "AiPromptNotFoundError";
  }
}

export class AiPromptConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiPromptConfigurationError";
  }
}

export class AiPromptConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiPromptConflictError";
  }
}

export const featureFromCatalog = (
  catalog: AiFeaturePromptCatalog,
  featureKey: string,
): AiFeaturePromptCatalogEntry => catalog.require(featureKey);

const asObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AiPromptConfigurationError(
      "Stored AI prompt snapshot is invalid",
    );
  }
  return value as Record<string, unknown>;
};

export const lockedCoreFrom = (
  value: unknown,
): Readonly<Record<(typeof AI_PROMPT_SLOT_KEYS)[number], string>> => {
  const object = asObject(value);
  const entries = AI_PROMPT_SLOT_KEYS.map((slot) => {
    const parsedSlot = aiPromptSlotSchema.parse(slot);
    const text = object[parsedSlot];
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new AiPromptConfigurationError(
        "Stored AI prompt core is incomplete",
      );
    }
    return [parsedSlot, text] as const;
  });
  return Object.fromEntries(entries) as Readonly<
    Record<(typeof AI_PROMPT_SLOT_KEYS)[number], string>
  >;
};

const editableFrom = (value: unknown): AiPromptContents => {
  const parsed = aiPromptContentsSchema.safeParse(value);
  if (!parsed.success) {
    throw new AiPromptConfigurationError(
      "Stored AI prompt instructions are invalid",
    );
  }
  return parsed.data;
};

const evaluationRead = (
  revision: StoredAiPromptBundleRevision,
): AiPromptEvaluationRead | null => {
  const evaluation = revision.latestEvaluation;
  if (!evaluation) return null;
  return aiPromptEvaluationReadSchema.parse({
    ...evaluation,
    outcome: evaluation.outcome,
  });
};

const executionRead = (
  revision: StoredAiPromptBundleRevision,
): AiCompatibilityExecutionRead | null => {
  const execution = revision.latestExecution;
  if (!execution) return null;
  return aiCompatibilityExecutionReadSchema.parse({
    ...execution,
    checks: execution.checks ?? [],
  });
};

export const bundleRead = (
  entry: AiFeaturePromptCatalogEntry,
  revision: StoredAiPromptBundleRevision,
): AiPromptBundleRead => {
  const promptContents = editableFrom(revision.promptContents);
  const lockedCoreSnapshot = lockedCoreFrom(revision.lockedCoreSnapshot);
  const composed = composePromptSet(entry, promptContents, lockedCoreSnapshot);
  if (
    composed.contentHash !== revision.effectiveContentHash ||
    composed.coreContractVersion !== revision.coreContractVersion ||
    composed.composerVersion !== revision.composerVersion
  ) {
    throw new AiPromptConfigurationError(
      "Stored AI prompt hash or contract is invalid",
    );
  }
  return aiPromptBundleReadSchema.parse({
    id: revision.id,
    featureKey: revision.featureKey,
    revision: revision.revision,
    baseRevisionId: revision.baseRevisionId,
    coreContractVersion: revision.coreContractVersion,
    composerVersion: revision.composerVersion,
    lockedCoreSnapshot,
    promptContents,
    slots: composed.slots,
    effectiveContentHash: revision.effectiveContentHash,
    lifecycle: revision.lifecycle,
    createdAt: revision.createdAt,
    updatedAt: revision.updatedAt,
    activatedAt: revision.activatedAt,
    supersededAt: revision.supersededAt,
    latestEvaluation: evaluationRead(revision),
    latestExecution: executionRead(revision),
  });
};

export const composedFromRevision = (
  entry: AiFeaturePromptCatalogEntry,
  revision: StoredAiPromptBundleRevision,
): AiComposedPromptSet =>
  composePromptSet(
    entry,
    editableFrom(revision.promptContents),
    lockedCoreFrom(revision.lockedCoreSnapshot),
  );

export const safePromptEvaluation = async (
  evaluator: AiPromptSyntheticEvaluator,
  entry: AiFeaturePromptCatalogEntry,
  provider: StoredAiProviderRevision,
  prompts: AiComposedPromptSet,
): Promise<AiPromptEvaluationResult> => {
  try {
    return await evaluator.evaluate({ feature: entry, provider, prompts });
  } catch (error) {
    const inconclusive =
      typeof error === "object" &&
      error !== null &&
      "retryable" in error &&
      error.retryable === true;
    return {
      outcome: inconclusive ? "inconclusive" : "failed",
      checks: [
        {
          code: "provider_probe_failed",
          status: inconclusive ? "inconclusive" : "failed",
          passedCount: 0,
          failedCount: 1,
        },
      ],
    };
  }
};

export const promptAvailability = (
  entry: AiFeaturePromptCatalogEntry,
  control: StoredAiFeaturePromptControl | null,
  provider: StoredAiProviderRevision | null,
): AiPromptFeatureRead["control"]["availability"] => {
  if (!control?.activeRevision || !provider) return "not_configured";
  if (provider.lifecycle !== "active") return "provider_incompatible";
  const evaluation = control.activeRevision.latestEvaluation;
  if (evaluation?.outcome !== "passed") return "evaluation_required";
  if (
    evaluation.generationCompatibilityIdentity !==
      provider.generationCompatibilityIdentity ||
    evaluation.contentHash !== control.activeRevision.effectiveContentHash ||
    evaluation.contractVersion !== control.activeRevision.coreContractVersion ||
    evaluation.evaluatorVersion !== entry.evaluatorVersion
  ) {
    return "evaluation_required";
  }
  return "available";
};
