import {
  AI_PROMPT_SLOT_KEYS,
  aiPromptContentsSchema,
  type AiPromptSlot,
  aiPromptSlotSchema,
} from "@customreport/shared";
import { AiPromptBundleLifecycle, Prisma } from "@prisma/client";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  aiProviderRevisionSelect,
  type StoredAiProviderRevision,
} from "../../ai-provider/index.js";
import {
  type AiComposedPromptSet,
  aiFeaturePromptCatalog,
  composePromptSet,
  REPORT_ASSISTANT_EVALUATOR_VERSION,
  REPORT_ASSISTANT_FEATURE_KEY,
} from "./ai-feature-prompt-catalog.js";

const providerSelect = aiProviderRevisionSelect;

const promptSelect = {
  id: true,
  featureKey: true,
  revision: true,
  baseRevisionId: true,
  coreContractVersion: true,
  composerVersion: true,
  lockedCoreSnapshot: true,
  promptContents: true,
  effectiveContentHash: true,
  lifecycle: true,
  createdBy: true,
  createdAt: true,
  updatedAt: true,
  activatedAt: true,
  supersededAt: true,
} as const;

type ProviderRecord = Prisma.AiProviderConfigurationGetPayload<{
  select: typeof providerSelect;
}>;
type PromptRecord = Prisma.AiPromptBundleRevisionGetPayload<{
  select: typeof promptSelect;
}>;

export type AiRuntimeConfigurationSnapshot = Readonly<{
  provider: StoredAiProviderRevision;
  featureKey: typeof REPORT_ASSISTANT_FEATURE_KEY;
  promptRevisionId: string;
  coreContractVersion: string;
  prompts: AiComposedPromptSet;
}>;

const storedProvider = (value: ProviderRecord): StoredAiProviderRevision =>
  value;

const snapshotObject = (value: Prisma.JsonValue): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Stored AI prompt snapshot is not an object");
  }
  return value;
};

const lockedCore = (
  value: Prisma.JsonValue,
): Readonly<Record<AiPromptSlot, string>> => {
  const object = snapshotObject(value);
  return Object.fromEntries(
    AI_PROMPT_SLOT_KEYS.map((slot) => {
      const key = aiPromptSlotSchema.parse(slot);
      const text = object[key];
      if (typeof text !== "string" || text.trim().length === 0) {
        throw new Error("Stored AI prompt core is incomplete");
      }
      return [key, text];
    }),
  ) as Readonly<Record<AiPromptSlot, string>>;
};

const resolvePrompt = (value: PromptRecord): AiComposedPromptSet => {
  const entry = aiFeaturePromptCatalog.require(REPORT_ASSISTANT_FEATURE_KEY);
  const editable = aiPromptContentsSchema.parse(value.promptContents);
  const composed = composePromptSet(
    entry,
    editable,
    lockedCore(value.lockedCoreSnapshot),
  );
  if (
    value.lifecycle !== AiPromptBundleLifecycle.active ||
    composed.contentHash !== value.effectiveContentHash ||
    composed.coreContractVersion !== value.coreContractVersion ||
    composed.composerVersion !== value.composerVersion
  ) {
    throw new Error("Stored AI prompt is not a valid active snapshot");
  }
  return composed;
};

export class AiRuntimeConfigurationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async resolveReportAssistant(): Promise<AiRuntimeConfigurationSnapshot | null> {
    const result = await this.prisma.$transaction(
      async (transaction) => {
        const [providerControl, promptControl] = await Promise.all([
          transaction.aiProviderControl.findUnique({
            where: { id: "singleton" },
            include: { activeConfiguration: { select: providerSelect } },
          }),
          transaction.aiFeaturePromptControl.findUnique({
            where: { featureKey: REPORT_ASSISTANT_FEATURE_KEY },
            include: { activeRevision: { select: promptSelect } },
          }),
        ]);
        const provider = providerControl?.activeConfiguration;
        const prompt = promptControl?.activeRevision;
        if (
          providerControl?.enabled !== true ||
          provider?.lifecycle !== "active" ||
          prompt?.featureKey !== REPORT_ASSISTANT_FEATURE_KEY
        ) {
          return null;
        }
        const evaluation = await transaction.aiPromptEvaluation.findUnique({
          where: {
            promptRevisionId_generationCompatibilityIdentity_contentHash_contractVersion_evaluatorVersion:
              {
                promptRevisionId: prompt.id,
                generationCompatibilityIdentity:
                  provider.generationCompatibilityIdentity,
                contentHash: prompt.effectiveContentHash,
                contractVersion: prompt.coreContractVersion,
                evaluatorVersion: REPORT_ASSISTANT_EVALUATOR_VERSION,
              },
          },
          select: { outcome: true },
        });
        return evaluation?.outcome === "passed" ? { provider, prompt } : null;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    if (!result) return null;
    try {
      const prompts = resolvePrompt(result.prompt);
      return {
        provider: storedProvider(result.provider),
        featureKey: REPORT_ASSISTANT_FEATURE_KEY,
        promptRevisionId: result.prompt.id,
        coreContractVersion: result.prompt.coreContractVersion,
        prompts,
      };
    } catch {
      return null;
    }
  }
}
