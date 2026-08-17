import {
  AiPromptBundleLifecycle,
  AiProviderLifecycle,
  AiProviderProfile,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  aiFeaturePromptCatalog,
  baselineReportAssistantPrompts,
  REPORT_ASSISTANT_FEATURE_KEY,
} from "./ai-feature-prompt-catalog.js";
import { AiRuntimeConfigurationRepository } from "./ai-runtime-configuration.repository.js";

const providerId = "a0000000-0000-4000-8000-000000000901";
const promptId = "a0000000-0000-4000-8000-000000000902";
const now = new Date("2026-08-11T00:00:00.000Z");
const prompts = baselineReportAssistantPrompts();
const entry = aiFeaturePromptCatalog.require(REPORT_ASSISTANT_FEATURE_KEY);
const lockedCoreSnapshot = Object.fromEntries(
  prompts.slots.map(({ slot, lockedCore }) => [slot, lockedCore]),
);

const provider = {
  id: providerId,
  profile: AiProviderProfile.mistral,
  baseUrl: "https://api.mistral.ai/v1",
  endpointIdentity: "mistral:stable-endpoint",
  plannerModel: "planner",
  answerModel: "answer",
  embeddingModel: "embed",
  embeddingDimensions: 3,
  semanticInputVersion: "report-assistant/v1",
  reasoningMode: "provider_default",
  reasoningCustomValue: null,
  answerProtocol: "json_schema",
  generationCompatibilityIdentity: "generation-identity",
  credentialCiphertext: "ciphertext",
  credentialNonce: "nonce",
  credentialTag: "tag",
  credentialKeyVersion: 1,
  credentialMaskedSuffix: "••••abcd",
  lifecycle: AiProviderLifecycle.active,
  testResult: null,
  testedAt: now,
  preparationCompleted: 0,
  preparationTotal: 0,
  preparationFailed: 0,
  preparationStartedAt: null,
  preparationFinishedAt: null,
  preparationElapsedMs: 0,
  activatedAt: now,
  supersededAt: null,
  createdAt: now,
  updatedAt: now,
};

const prompt = {
  id: promptId,
  featureKey: REPORT_ASSISTANT_FEATURE_KEY,
  revision: 1,
  baseRevisionId: null,
  coreContractVersion: prompts.coreContractVersion,
  composerVersion: prompts.composerVersion,
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

const evaluation = {
  id: "a0000000-0000-4000-8000-000000000903",
  outcome: "passed" as const,
};

function createRepository(input: Readonly<{ evaluation: unknown }>) {
  const transaction = {
    aiProviderControl: {
      findUnique: vi.fn().mockResolvedValue({
        enabled: true,
        activeConfiguration: provider,
      }),
    },
    aiFeaturePromptControl: {
      findUnique: vi.fn().mockResolvedValue({
        activeRevision: prompt,
      }),
    },
    aiPromptEvaluation: {
      findUnique: vi.fn().mockResolvedValue(input.evaluation),
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
    evaluationFindUnique: transaction.aiPromptEvaluation.findUnique,
  };
}

describe("AiRuntimeConfigurationRepository", () => {
  it("resolves one prompt/provider pair under repeatable read", async () => {
    const harness = createRepository({ evaluation });

    const result = await harness.repository.resolveReportAssistant();

    expect(result).toMatchObject({
      featureKey: REPORT_ASSISTANT_FEATURE_KEY,
      promptRevisionId: promptId,
      coreContractVersion: prompts.coreContractVersion,
      provider: { id: providerId },
      prompts: { contentHash: prompts.contentHash },
    });
    expect(harness.transactionRunner).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: "RepeatableRead" },
    );
    expect(harness.evaluationFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          promptRevisionId_generationCompatibilityIdentity_contentHash_contractVersion_evaluatorVersion:
            {
              promptRevisionId: promptId,
              generationCompatibilityIdentity: "generation-identity",
              contentHash: prompt.effectiveContentHash,
              contractVersion: prompt.coreContractVersion,
              evaluatorVersion: "report-assistant/evaluator/v2",
            },
        },
      }),
    );
  });

  it("returns no runtime when the exact passing evaluation is absent", async () => {
    const harness = createRepository({ evaluation: null });

    await expect(
      harness.repository.resolveReportAssistant(),
    ).resolves.toBeNull();
  });

  it("fails closed when the durable prompt snapshot no longer composes", async () => {
    const invalidPrompt = {
      ...prompt,
      lockedCoreSnapshot: { planner: "only one slot" },
    };
    const transaction = {
      aiProviderControl: {
        findUnique: vi.fn().mockResolvedValue({
          enabled: true,
          activeConfiguration: provider,
        }),
      },
      aiFeaturePromptControl: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ activeRevision: invalidPrompt }),
      },
      aiPromptEvaluation: {
        findUnique: vi.fn().mockResolvedValue(evaluation),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback: (value: typeof transaction) => unknown) =>
        Promise.resolve(callback(transaction)),
      ),
    } as unknown as PrismaService;

    await expect(
      new AiRuntimeConfigurationRepository(prisma).resolveReportAssistant(),
    ).resolves.toBeNull();
  });
});
