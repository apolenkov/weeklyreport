import {
  AiPromptBundleLifecycle,
  AiPromptEvaluationOutcome,
  AiProviderLifecycle,
  AiProviderProfile,
} from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../../test-utils/prisma-test-helper.js";
import {
  aiFeaturePromptCatalog,
  baselineReportAssistantPrompts,
} from "../../search/application/ai-feature-prompt-catalog.js";
import { AiPromptRepository } from "./ai-prompt.repository.js";

const prisma = createTestPrisma();
const repository = new AiPromptRepository(prisma as unknown as PrismaService);
const featureKey = "lead-report-assistant" as const;
const providerId = "a0000000-0000-4000-8000-000000000901";
const now = new Date("2026-08-11T00:00:00.000Z");

const baseline = baselineReportAssistantPrompts();
const lockedCoreSnapshot = Object.fromEntries(
  baseline.slots.map(({ slot, lockedCore }) => [slot, lockedCore]),
);

const createProvider = async (): Promise<void> => {
  await prisma.aiProviderConfiguration.create({
    data: {
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
      answerProtocol: "json_schema",
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
      generationCompatibilityIdentity: "generation-identity",
      embeddingScopeIdentity: "embedding-identity",
      compositeTestIdentity: "composite-identity",
      lifecycle: AiProviderLifecycle.active,
      activatedAt: now,
    },
  });
  await prisma.aiProviderControl.create({
    data: {
      id: "singleton",
      activeConfigurationId: providerId,
      enabled: true,
    },
  });
};

const bootstrap = async () =>
  repository.bootstrap({
    featureKey,
    coreContractVersion: baseline.coreContractVersion,
    composerVersion: baseline.composerVersion,
    lockedCoreSnapshot: lockedCoreSnapshot,
    promptContents: baseline.slots.reduce(
      (instructions, slot) => ({
        ...instructions,
        [slot.slot]: slot.promptContents,
      }),
      {},
    ),
    effectiveContentHash: baseline.contentHash,
    createdBy: "seed",
  });

const createDraft = async (baseRevisionId: string, suffix: string) => {
  const entry = aiFeaturePromptCatalog.require(featureKey);
  const editable = {
    ...entry.defaultEditableInstructions,
    planner: `${entry.defaultEditableInstructions.planner} ${suffix}`,
  };
  const composed = entry.compose(editable);
  return repository.createDraft({
    featureKey,
    baseRevisionId,
    coreContractVersion: composed.coreContractVersion,
    composerVersion: composed.composerVersion,
    lockedCoreSnapshot: lockedCoreSnapshot,
    promptContents: editable,
    effectiveContentHash: composed.contentHash,
    createdBy: "admin-1",
  });
};

describe("AI prompt control-plane database states", () => {
  beforeEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  it("bootstraps idempotently and allocates concurrent feature-local revisions", async () => {
    const first = await bootstrap();
    const second = await bootstrap();

    if (!first) throw new Error("Prompt baseline was not created");
    expect(typeof first.id).toBe("string");
    expect(first).toMatchObject({
      lifecycle: AiPromptBundleLifecycle.active,
      revision: 1,
    });
    expect(second).toBeNull();

    const drafts = await Promise.all([
      createDraft(first.id, "candidate-a"),
      createDraft(first.id, "candidate-b"),
    ]);
    expect(drafts.map(({ revision }) => revision).sort()).toEqual([2, 3]);
    await expect(
      prisma.aiFeaturePromptControl.findUnique({ where: { featureKey } }),
    ).resolves.toMatchObject({ activeRevisionId: first.id });
  });

  it("promotes exact compatibility evidence to passed without later downgrade", async () => {
    const active = await bootstrap();
    if (!active) throw new Error("Prompt baseline was not created");
    const record = (outcome: AiPromptEvaluationOutcome) =>
      repository.recordEvaluation({
        featureKey,
        promptRevisionId: active.id,
        generationCompatibilityIdentity: "generation-identity",
        contentHash: active.effectiveContentHash,
        contractVersion: active.coreContractVersion,
        evaluatorVersion: "report-assistant/evaluator/v2",
        checks: [
          {
            code: "protocol_shape",
            status: outcome,
            passedCount: outcome === AiPromptEvaluationOutcome.passed ? 1 : 0,
            failedCount: outcome === AiPromptEvaluationOutcome.passed ? 0 : 1,
          },
        ],
        outcome,
        evaluatedAt: now,
      });

    await expect(
      record(AiPromptEvaluationOutcome.failed),
    ).resolves.toMatchObject({ outcome: AiPromptEvaluationOutcome.failed });
    await expect(
      record(AiPromptEvaluationOutcome.passed),
    ).resolves.toMatchObject({ outcome: AiPromptEvaluationOutcome.passed });
    await expect(
      record(AiPromptEvaluationOutcome.failed),
    ).resolves.toMatchObject({ outcome: AiPromptEvaluationOutcome.passed });
  });

  it("rechecks the provider pair during activation and preserves history on discard", async () => {
    const active = await bootstrap();
    if (!active) throw new Error("Prompt baseline was not created");
    await createProvider();
    const candidate = await createDraft(active.id, "candidate");
    const evaluation = await repository.recordEvaluation({
      featureKey,
      promptRevisionId: candidate.id,
      generationCompatibilityIdentity: "generation-identity",
      contentHash: candidate.effectiveContentHash,
      contractVersion: candidate.coreContractVersion,
      evaluatorVersion: "report-assistant/evaluator/v1",
      checks: [
        {
          code: "protocol_shape",
          status: "passed",
          passedCount: 1,
          failedCount: 0,
        },
      ],
      outcome: AiPromptEvaluationOutcome.passed,
      evaluatedAt: now,
    });
    await repository.transition(
      featureKey,
      candidate.id,
      [AiPromptBundleLifecycle.draft],
      AiPromptBundleLifecycle.validated,
    );

    await expect(
      repository.activate(
        featureKey,
        candidate.id,
        [AiPromptBundleLifecycle.validated],
        now,
        {
          generationCompatibilityIdentity: "generation-identity",
          contentHash: candidate.effectiveContentHash,
          contractVersion: candidate.coreContractVersion,
          evaluatorVersion: "report-assistant/evaluator/v1",
          evaluationId: evaluation.id,
        },
      ),
    ).resolves.toBe(true);
    await expect(
      prisma.aiFeaturePromptControl.findUnique({ where: { featureKey } }),
    ).resolves.toMatchObject({ activeRevisionId: candidate.id });
    await expect(
      prisma.aiPromptBundleRevision.findUnique({
        where: { id: active.id },
        select: { lifecycle: true },
      }),
    ).resolves.toEqual({ lifecycle: AiPromptBundleLifecycle.superseded });

    const disposable = await createDraft(candidate.id, "discard-me");
    await expect(
      repository.discardDisposable(featureKey, disposable.id),
    ).resolves.toBe(true);
    await expect(
      prisma.aiPromptBundleRevision.findUnique({
        where: { id: disposable.id },
      }),
    ).resolves.toBeNull();
    await expect(
      prisma.aiFeaturePromptControl.findUnique({ where: { featureKey } }),
    ).resolves.toMatchObject({ activeRevisionId: candidate.id });
  });
});
