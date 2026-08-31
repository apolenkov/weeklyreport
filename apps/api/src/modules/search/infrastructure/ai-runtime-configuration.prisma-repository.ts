import {
  AI_PROMPT_SLOT_KEYS,
  aiPromptContentsSchema,
  type AiPromptSlot,
  aiPromptSlotSchema,
} from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";
import { AiPromptBundleLifecycle, Prisma } from "@prisma/client";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  type AiComposedPromptSet,
  aiFeaturePromptCatalog,
  composePromptSet,
  REPORT_ASSISTANT_FEATURE_KEY,
  REPORT_ASSISTANT_SERVING_CONTRACT_VERSION,
} from "../../ai-prompts/index.js";
import {
  aiProviderRevisionSelect,
  type StoredAiProviderRevision,
} from "../../ai-provider/index.js";

const providerSelect = aiProviderRevisionSelect;

const promptSelect = {
  id: true,
  featureKey: true,
  revision: true,
  baseRevisionId: true,
  coreContractVersion: true,
  composerVersion: true,
  servingContractVersion: true,
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
  servingContractVersion: typeof REPORT_ASSISTANT_SERVING_CONTRACT_VERSION;
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
  if (
    value.servingContractVersion !== REPORT_ASSISTANT_SERVING_CONTRACT_VERSION
  ) {
    throw new Error("Stored AI prompt has an unsupported serving contract");
  }
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

@Injectable()
export class AiRuntimeConfigurationRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

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
          prompt?.featureKey !== REPORT_ASSISTANT_FEATURE_KEY ||
          prompt.servingContractVersion !==
            REPORT_ASSISTANT_SERVING_CONTRACT_VERSION
        ) {
          return null;
        }
        return { provider, prompt };
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
        servingContractVersion: REPORT_ASSISTANT_SERVING_CONTRACT_VERSION,
        coreContractVersion: result.prompt.coreContractVersion,
        prompts,
      };
    } catch {
      return null;
    }
  }
}
