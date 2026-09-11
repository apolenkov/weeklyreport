import "reflect-metadata";

import {
  AiPromptBundleLifecycle,
  AiProviderLifecycle,
  AiProviderProfile,
  type Prisma,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  aiFeaturePromptCatalog,
  baselineReportAssistantPrompts,
  REPORT_ASSISTANT_FEATURE_KEY,
} from "../../ai-prompts/application/ai-feature-prompt-catalog.js";
import type { StoredAiPromptBundleRevision } from "../../ai-prompts/infrastructure/ai-prompt.repository.js";
import type { aiProviderRevisionSelect } from "../../ai-provider/index.js";
import { AiRuntimeConfigurationRepository } from "../infrastructure/ai-runtime-configuration.prisma-repository.js";

const providerId = "a0000000-0000-4000-8000-000000000901";
const promptId = "a0000000-0000-4000-8000-000000000902";
const now = new Date("2026-08-11T00:00:00.000Z");
const prompts = baselineReportAssistantPrompts();
const entry = aiFeaturePromptCatalog.require(REPORT_ASSISTANT_FEATURE_KEY);
const lockedCoreSnapshot = Object.fromEntries(
  prompts.slots.map(({ slot, lockedCore }) => [slot, lockedCore]),
);

const provider: Prisma.AiProviderConfigurationGetPayload<{
  select: typeof aiProviderRevisionSelect;
}> = {
  id: providerId,
  generationProfile: AiProviderProfile.mistral,
  generationBaseUrl: "https://api.mistral.ai/v1",
  generationEndpointIdentity: "mistral:stable-endpoint",
  plannerModel: "planner",
  answerModel: "answer",
  embeddingModel: "embed",
  embeddingDimensions: 3,
  semanticInputVersion: "report-assistant/v1",
  reasoningMode: "provider_default",
  reasoningCustomValue: null,
  generationCompatibilityIdentity: "generation-identity",
  generationCredentialCiphertext: "ciphertext",
  generationCredentialNonce: "nonce",
  generationCredentialTag: "tag",
  generationCredentialKeyVersion: 1,
  generationCredentialMaskedSuffix: "••••abcd",
  embeddingMode: "reuse_generation",
  embeddingProfile: null,
  embeddingBaseUrl: null,
  embeddingEndpointIdentity: null,
  embeddingCredentialCiphertext: null,
  embeddingCredentialNonce: null,
  embeddingCredentialTag: null,
  embeddingCredentialKeyVersion: null,
  embeddingCredentialMaskedSuffix: null,
  embeddingScopeIdentity: "embedding-identity",
  compositeTestIdentity: "composite-identity",
  testExecutions: [],
  lifecycle: AiProviderLifecycle.active,
  testResult: null,
  testedAt: now,
  preparationCompleted: 0,
  preparationTotal: 0,
  preparationFailed: 0,
  preparationStartedAt: null,
  preparationFinishedAt: null,
  preparationElapsedMs: 0,
  preparationSourceFingerprint: "prepared",
  preparationSourceGeneration: 0n,
  activatedAt: now,
  supersededAt: null,
  createdAt: now,
  updatedAt: now,
};

const prompt: StoredAiPromptBundleRevision = {
  id: promptId,
  featureKey: REPORT_ASSISTANT_FEATURE_KEY,
  revision: 1,
  baseRevisionId: null,
  coreContractVersion: prompts.coreContractVersion,
  composerVersion: prompts.composerVersion,
  servingContractVersion: prompts.servingContractVersion,
  lockedCoreSnapshot,
  promptContents: entry.defaultEditableInstructions,
  effectiveContentHash: prompts.contentHash,
  lifecycle: AiPromptBundleLifecycle.active,
  createdBy: "seed",
  createdAt: now,
  updatedAt: now,
  activatedAt: now,
  supersededAt: null,
};

function createRepository(
  input: Readonly<{
    promptOverride?: Partial<StoredAiPromptBundleRevision>;
  }> = {},
) {
  const transaction = {
    aiProviderControl: {
      findUnique: vi.fn().mockResolvedValue({
        enabled: true,
        activeConfiguration: provider,
      }),
    },
    aiFeaturePromptControl: {
      findUnique: vi.fn().mockResolvedValue({
        activeRevision: { ...prompt, ...input.promptOverride },
      }),
    },
  };
  const transactionRunner = vi.fn(
    (callback: (value: typeof transaction) => unknown) =>
      Promise.resolve(callback(transaction)),
  );
  const prisma = {
    $transaction: transactionRunner,
  } as unknown as PrismaService;
  return {
    repository: new AiRuntimeConfigurationRepository(prisma),
    transactionRunner,
  };
}

describe("AiRuntimeConfigurationRepository", () => {
  it("declares PrismaService for Nest runtime injection", () => {
    expect(
      Reflect.getMetadata(
        "design:paramtypes",
        AiRuntimeConfigurationRepository,
      ),
    ).toEqual([PrismaService]);
  });

  it("resolves one prompt/provider pair without evaluation or source-state reads under repeatable read", async () => {
    const harness = createRepository();

    const result = await harness.repository.resolveReportAssistant();

    expect(result).toMatchObject({
      featureKey: REPORT_ASSISTANT_FEATURE_KEY,
      promptRevisionId: promptId,
      coreContractVersion: prompts.coreContractVersion,
      provider: { id: providerId },
      prompts: { contentHash: prompts.contentHash },
    });
    expect(result?.provider).toEqual(provider);
    expect(harness.transactionRunner).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "RepeatableRead" },
    );
  });

  it("fails closed when the active revision belongs to a non-current serving contract", async () => {
    const harness = createRepository({
      promptOverride: { servingContractVersion: null },
    });

    await expect(
      harness.repository.resolveReportAssistant(),
    ).resolves.toBeNull();
  });

  it("fails closed when the durable prompt snapshot no longer composes", async () => {
    const harness = createRepository({
      promptOverride: { lockedCoreSnapshot: { planner: "only one slot" } },
    });
    await expect(
      harness.repository.resolveReportAssistant(),
    ).resolves.toBeNull();
  });
});
