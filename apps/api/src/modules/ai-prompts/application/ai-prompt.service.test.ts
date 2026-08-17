import {
  AiPromptBundleLifecycle,
  AiProviderLifecycle,
  AiProviderProfile,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { StoredAiProviderRevision } from "../../ai-provider/infrastructure/ai-provider.repository.js";
import {
  aiFeaturePromptCatalog,
  baselineReportAssistantPrompts,
} from "../../search/application/ai-feature-prompt-catalog.js";
import type {
  AiPromptRepository,
  StoredAiFeaturePromptControl,
  StoredAiPromptBundleRevision,
  StoredAiPromptEvaluation,
} from "../infrastructure/ai-prompt.repository.js";
import { AiPromptSyntheticEvaluator } from "./ai-prompt.evaluator.js";
import { AiPromptService } from "./ai-prompt.service.js";
import { AiPromptConfigurationError } from "./ai-prompt.service-support.js";

const revisionId = "659b2767-0f86-41e2-b025-49730ca010e4";
const providerId = "759b2767-0f86-41e2-b025-49730ca010e4";
const now = new Date("2026-08-10T00:00:00.000Z");
const baseline = baselineReportAssistantPrompts();
const evaluatorVersion = aiFeaturePromptCatalog.require(
  "lead-report-assistant",
).evaluatorVersion;
const lockedCoreSnapshot = Object.fromEntries(
  baseline.slots.map(({ slot, lockedCore }) => [slot, lockedCore]),
);

const provider = (
  overrides: Partial<StoredAiProviderRevision> = {},
): StoredAiProviderRevision => ({
  id: providerId,
  generationProfile: AiProviderProfile.mistral,
  generationBaseUrl: "https://api.mistral.ai/v1",
  generationEndpointIdentity: "mistral:api",
  plannerModel: "planner",
  answerModel: "answer",
  embeddingModel: "embed",
  embeddingDimensions: 1024,
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
  ...overrides,
});

const evaluation = (
  outcome: "passed" | "failed" | "inconclusive" = "passed",
): StoredAiPromptEvaluation => ({
  id: "859b2767-0f86-41e2-b025-49730ca010e4",
  featureKey: "lead-report-assistant",
  promptRevisionId: revisionId,
  generationCompatibilityIdentity: "generation-identity",
  contentHash: baseline.contentHash,
  contractVersion: baseline.coreContractVersion,
  evaluatorVersion,
  checks: [
    {
      code: "protocol_shape",
      status: outcome,
      passedCount: outcome === "passed" ? 1 : 0,
      failedCount: outcome === "passed" ? 0 : 1,
    },
  ],
  outcome,
  evaluatedAt: now,
});

const bundle = (
  lifecycle: AiPromptBundleLifecycle,
  latestEvaluation: StoredAiPromptEvaluation | null = null,
): StoredAiPromptBundleRevision => ({
  id: revisionId,
  featureKey: "lead-report-assistant",
  revision: 1,
  baseRevisionId: null,
  coreContractVersion: baseline.coreContractVersion,
  composerVersion: baseline.composerVersion,
  lockedCoreSnapshot,
  promptContents: baseline.slots.reduce(
    (values, slot) => ({ ...values, [slot.slot]: slot.promptContents }),
    {},
  ),
  effectiveContentHash: baseline.contentHash,
  lifecycle,
  createdBy: "admin-1",
  createdAt: now,
  updatedAt: now,
  activatedAt: lifecycle === AiPromptBundleLifecycle.active ? now : null,
  supersededAt: lifecycle === AiPromptBundleLifecycle.superseded ? now : null,
  latestEvaluation,
});

const control = (
  revision: StoredAiPromptBundleRevision | null,
): StoredAiFeaturePromptControl =>
  ({
    id: "959b2767-0f86-41e2-b025-49730ca010e4",
    featureKey: "lead-report-assistant",
    activeRevisionId:
      revision?.lifecycle === AiPromptBundleLifecycle.active
        ? revision.id
        : null,
    createdAt: now,
    updatedAt: now,
    activeRevision:
      revision?.lifecycle === AiPromptBundleLifecycle.active ? revision : null,
    latestRevision: revision,
  }) as StoredAiFeaturePromptControl;

const serviceFor = (values: {
  revision?: StoredAiPromptBundleRevision;
  control?: StoredAiFeaturePromptControl | null;
  provider?: StoredAiProviderRevision | null;
  evaluatorOutcome?: "passed" | "failed" | "inconclusive";
  storedEvaluation?: StoredAiPromptEvaluation | null;
}) => {
  const storedRevision =
    values.revision ?? bundle(AiPromptBundleLifecycle.draft);
  const promptRepository = {
    getControl: vi
      .fn()
      .mockResolvedValue(
        values.control === undefined ? control(storedRevision) : values.control,
      ),
    getRevision: vi.fn().mockResolvedValue(storedRevision),
    createDraft: vi.fn().mockResolvedValue(storedRevision),
    recordEvaluation: vi
      .fn()
      .mockImplementation(
        (input: { outcome: StoredAiPromptEvaluation["outcome"] }) =>
          Promise.resolve(evaluation(input.outcome)),
      ),
    findEvaluation: vi.fn().mockResolvedValue(values.storedEvaluation ?? null),
    transition: vi.fn().mockResolvedValue(true),
    discardDisposable: vi.fn().mockResolvedValue(true),
    activate: vi.fn().mockResolvedValue(true),
    bootstrap: vi
      .fn()
      .mockResolvedValue(bundle(AiPromptBundleLifecycle.active)),
  };
  const providerRepository = {
    getControl: vi.fn().mockResolvedValue(
      values.provider === null
        ? null
        : {
            enabled: true,
            activeConfiguration: values.provider ?? provider(),
          },
    ),
  };
  const evaluatorOutcome = values.evaluatorOutcome ?? "passed";
  const evaluate = vi.fn().mockResolvedValue({
    outcome: evaluatorOutcome,
    checks: [
      {
        code: "protocol_shape",
        status: evaluatorOutcome,
        passedCount: evaluatorOutcome === "passed" ? 1 : 0,
        failedCount: evaluatorOutcome === "passed" ? 0 : 1,
      },
    ],
  });
  const evaluator = new AiPromptSyntheticEvaluator({ evaluate });
  return {
    evaluate,
    repository: promptRepository,
    service: new AiPromptService(
      promptRepository as unknown as AiPromptRepository,
      providerRepository as never,
      evaluator,
      aiFeaturePromptCatalog,
    ),
  };
};

describe("AiPromptService", () => {
  it("creates an immutable draft from the selected base", async () => {
    const harness = serviceFor({
      revision: bundle(AiPromptBundleLifecycle.active),
    });

    const result = await harness.service.draft(
      {
        featureKey: "lead-report-assistant",
        baseRevisionId: revisionId,
        promptContents: baseline.slots.reduce(
          (values, slot) => ({
            ...values,
            [slot.slot]: slot.promptContents,
          }),
          {},
        ) as never,
      },
      "admin-1",
    );

    expect(result.lifecycle).toBe("active");
    expect(harness.repository.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({ baseRevisionId: revisionId }),
    );
  });

  it("records evaluation against the exact active provider and transitions the candidate", async () => {
    const candidate = bundle(AiPromptBundleLifecycle.draft);
    const harness = serviceFor({ revision: candidate });

    await harness.service.executeEvaluation({
      featureKey: "lead-report-assistant",
      revisionId,
    });

    expect(harness.repository.recordEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({
        promptRevisionId: revisionId,
        generationCompatibilityIdentity: "generation-identity",
        contentHash: baseline.contentHash,
      }),
    );
    expect(harness.repository.transition).toHaveBeenCalledWith(
      "lead-report-assistant",
      revisionId,
      [AiPromptBundleLifecycle.draft, AiPromptBundleLifecycle.failed],
      AiPromptBundleLifecycle.validated,
    );
  });

  it("requires a current passing evaluation before activation", async () => {
    const candidate = bundle(AiPromptBundleLifecycle.validated, evaluation());
    const harness = serviceFor({
      revision: candidate,
      storedEvaluation: evaluation(),
    });

    await expect(
      harness.service.activate(
        {
          featureKey: "lead-report-assistant",
          revisionId,
          evaluationId: "859b2767-0f86-41e2-b025-49730ca010e4",
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({ lifecycle: "active" });
    expect(harness.repository.activate).toHaveBeenCalled();
  });

  it("preserves inconclusive provider compatibility as a three-state result", async () => {
    const active = bundle(AiPromptBundleLifecycle.active);
    const harness = serviceFor({
      revision: active,
      control: control(active),
      evaluatorOutcome: "inconclusive",
    });

    await expect(
      harness.service.evaluateProviderCompatibility(provider()),
    ).resolves.toMatchObject({
      status: "inconclusive",
      features: [
        expect.objectContaining({
          featureKey: "lead-report-assistant",
          outcome: "inconclusive",
        }),
      ],
    });
  });

  it("reuses exact passing compatibility evidence without another provider call", async () => {
    const active = bundle(AiPromptBundleLifecycle.active);
    const harness = serviceFor({
      revision: active,
      control: control(active),
      storedEvaluation: evaluation("passed"),
    });

    await expect(
      harness.service.evaluateProviderCompatibility(provider()),
    ).resolves.toMatchObject({ status: "passed" });
    expect(harness.evaluate).not.toHaveBeenCalled();
    expect(harness.repository.recordEvaluation).not.toHaveBeenCalled();
  });

  it("retries non-passing compatibility evidence and promotes a pass", async () => {
    const active = bundle(AiPromptBundleLifecycle.active);
    const harness = serviceFor({
      revision: active,
      control: control(active),
      storedEvaluation: evaluation("failed"),
      evaluatorOutcome: "passed",
    });

    await expect(
      harness.service.evaluateProviderCompatibility(provider()),
    ).resolves.toMatchObject({ status: "passed" });
    expect(harness.evaluate).toHaveBeenCalledOnce();
    expect(harness.repository.recordEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "passed" }),
    );
  });

  it("reuses the provider revision passing snapshot when shared evidence was downgraded", async () => {
    const active = bundle(AiPromptBundleLifecycle.active);
    const previouslyPassed = provider({
      testResult: {
        status: "passed",
        generation: {
          status: "passed",
          answerProtocol: "json_schema",
          capabilities: [],
          featureCompatibility: [
            {
              featureKey: "lead-report-assistant",
              promptRevisionId: revisionId,
              contentHash: baseline.contentHash,
              evaluatorVersion,
              outcome: "passed",
              checks: evaluation("passed").checks,
            },
          ],
        },
        embeddings: { status: "passed", capabilities: [] },
        testedAt: now.toISOString(),
      },
    });
    const harness = serviceFor({
      revision: active,
      control: control(active),
      provider: previouslyPassed,
      storedEvaluation: evaluation("failed"),
      evaluatorOutcome: "failed",
    });

    await expect(
      harness.service.evaluateProviderCompatibility(provider()),
    ).resolves.toMatchObject({ status: "passed" });
    expect(harness.evaluate).not.toHaveBeenCalled();
    expect(harness.repository.recordEvaluation).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "passed" }),
    );
  });

  it("verifies the immutable provider snapshot instead of mutable shared evidence", async () => {
    const active = bundle(AiPromptBundleLifecycle.active);
    const harness = serviceFor({
      revision: active,
      control: control(active),
      storedEvaluation: evaluation("failed"),
    });
    const compatible = provider({
      testResult: {
        status: "passed",
        generation: {
          status: "passed",
          answerProtocol: "json_schema",
          capabilities: [],
          featureCompatibility: [
            {
              featureKey: "lead-report-assistant",
              promptRevisionId: revisionId,
              contentHash: baseline.contentHash,
              evaluatorVersion,
              outcome: "passed",
              checks: evaluation("passed").checks,
            },
          ],
        },
        embeddings: { status: "passed", capabilities: [] },
        testedAt: now.toISOString(),
      },
    });

    await expect(
      harness.service.verifyProviderCompatibility(compatible),
    ).resolves.toBe(true);
    expect(harness.repository.findEvaluation).not.toHaveBeenCalled();
  });

  it("refuses protected prompt discard", async () => {
    const harness = serviceFor({
      revision: bundle(AiPromptBundleLifecycle.active),
    });

    await expect(
      harness.service.discard(
        { featureKey: "lead-report-assistant", revisionId },
        "admin-1",
      ),
    ).rejects.toBeInstanceOf(AiPromptConfigurationError);
    expect(harness.repository.discardDisposable).not.toHaveBeenCalled();
  });

  it("discards a failed prompt attempt", async () => {
    const harness = serviceFor({
      revision: bundle(AiPromptBundleLifecycle.failed),
    });
    harness.repository.discardDisposable.mockResolvedValue(true);

    await expect(
      harness.service.discard(
        { featureKey: "lead-report-assistant", revisionId },
        "admin-1",
      ),
    ).resolves.toMatchObject({ discarded: true });
    expect(harness.repository.discardDisposable).toHaveBeenCalledWith(
      "lead-report-assistant",
      revisionId,
    );
  });

  it("bootstraps once and leaves existing prompt controls untouched", async () => {
    const harness = serviceFor({ control: null });
    harness.repository.bootstrap
      .mockResolvedValueOnce(bundle(AiPromptBundleLifecycle.active))
      .mockResolvedValueOnce(null);

    await expect(harness.service.bootstrap()).resolves.toMatchObject({
      lifecycle: "active",
    });
    harness.repository.getControl.mockResolvedValue(
      control(bundle(AiPromptBundleLifecycle.active)),
    );
    await expect(harness.service.bootstrap()).resolves.toBeNull();
    expect(harness.repository.bootstrap).toHaveBeenCalledTimes(2);
  });
});
