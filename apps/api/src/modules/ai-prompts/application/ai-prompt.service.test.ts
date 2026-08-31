import {
  AiPromptBundleLifecycle,
  AiProviderLifecycle,
  AiProviderProfile,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { StoredAiProviderRevision } from "../../ai-provider/infrastructure/ai-provider.repository.js";
import type {
  AiPromptRepository,
  StoredAiFeaturePromptControl,
  StoredAiPromptBundleRevision,
} from "../infrastructure/ai-prompt.repository.js";
import {
  aiFeaturePromptCatalog,
  baselineReportAssistantPrompts,
} from "./ai-feature-prompt-catalog.js";
import { AiPromptService } from "./ai-prompt.service.js";
import { AiPromptConfigurationError } from "./ai-prompt.service-support.js";

const revisionId = "659b2767-0f86-41e2-b025-49730ca010e4";
const providerId = "759b2767-0f86-41e2-b025-49730ca010e4";
const now = new Date("2026-08-10T00:00:00.000Z");
const baseline = baselineReportAssistantPrompts();
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

const bundle = (
  lifecycle: AiPromptBundleLifecycle,
): StoredAiPromptBundleRevision => ({
  id: revisionId,
  featureKey: "lead-report-assistant",
  revision: 1,
  baseRevisionId: null,
  coreContractVersion: baseline.coreContractVersion,
  composerVersion: baseline.composerVersion,
  servingContractVersion: baseline.servingContractVersion,
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
    transition: vi.fn().mockResolvedValue(true),
    discardDisposable: vi.fn().mockResolvedValue(true),
    activate: vi.fn().mockResolvedValue(true),
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
  return {
    repository: promptRepository,
    service: new AiPromptService(
      promptRepository as unknown as AiPromptRepository,
      providerRepository as never,
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

  it("rejects drafts based on a non-current serving revision", async () => {
    const legacy = {
      ...bundle(AiPromptBundleLifecycle.active),
      servingContractVersion: null,
    };
    const harness = serviceFor({
      revision: legacy,
      control: control(legacy),
    });

    await expect(
      harness.service.draft(
        {
          featureKey: "lead-report-assistant",
          baseRevisionId: revisionId,
          promptContents: aiFeaturePromptCatalog.require(
            "lead-report-assistant",
          ).defaultEditableInstructions,
        },
        "admin-1",
      ),
    ).rejects.toBeInstanceOf(AiPromptConfigurationError);
    expect(harness.repository.createDraft).not.toHaveBeenCalled();
  });

  it("keeps a non-current active revision readable but unavailable for serving", async () => {
    const legacy = {
      ...bundle(AiPromptBundleLifecycle.active),
      servingContractVersion: null,
    };
    const harness = serviceFor({
      revision: legacy,
      control: control(legacy),
      provider: provider(),
    });

    const result = await harness.service.read("lead-report-assistant");

    expect(result.control.activeBundle?.servingStatus).toBe("incompatible");
    expect(result.control.availability).toBe("not_configured");
  });

  it("activates a structurally valid current revision", async () => {
    const candidate = bundle(AiPromptBundleLifecycle.validated);
    const harness = serviceFor({ revision: candidate });

    await expect(
      harness.service.activate(
        {
          featureKey: "lead-report-assistant",
          revisionId,
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({ lifecycle: "active" });
    expect(harness.repository.activate).toHaveBeenCalled();
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
});
