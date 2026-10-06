import type { AiPromptContents } from "@customreport/shared";
import {
  AI_PROMPT_SLOT_CONTENT_LIMIT,
  AI_PROMPT_SLOT_KEYS,
} from "@customreport/shared";
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
  composePromptSet,
} from "./ai-feature-prompt-catalog.js";
import { AiPromptService } from "./ai-prompt.service.js";
import {
  AiPromptConfigurationError,
  AiPromptConflictError,
} from "./ai-prompt.service-support.js";

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
): StoredAiFeaturePromptControl => ({
  id: "959b2767-0f86-41e2-b025-49730ca010e4",
  featureKey: "lead-report-assistant",
  activeRevisionId:
    revision?.lifecycle === AiPromptBundleLifecycle.active ? revision.id : null,
  createdAt: now,
  updatedAt: now,
  activeRevision:
    revision?.lifecycle === AiPromptBundleLifecycle.active ? revision : null,
  latestRevision: revision,
  history: revision ? [revision] : [],
});

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
    activate: vi.fn<AiPromptRepository["activate"]>().mockResolvedValue(true),
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
  const audit = { record: vi.fn() };
  const metrics = { record: vi.fn() };
  return {
    repository: promptRepository,
    providerRepository,
    audit,
    metrics,
    service: new AiPromptService(
      promptRepository as unknown as AiPromptRepository,
      providerRepository as never,
      aiFeaturePromptCatalog,
      { audit, metrics },
    ),
  };
};

describe("AiPromptService", () => {
  it("creates an immutable draft from the selected base", async () => {
    const base = bundle(AiPromptBundleLifecycle.active);
    const draft: StoredAiPromptBundleRevision = {
      ...bundle(AiPromptBundleLifecycle.draft),
      id: "859b2767-0f86-41e2-b025-49730ca010e4",
      revision: 2,
      baseRevisionId: base.id,
    };
    const harness = serviceFor({ revision: base });
    harness.repository.createDraft.mockResolvedValue(draft);
    const promptContents = aiFeaturePromptCatalog.require(
      "lead-report-assistant",
    ).defaultEditableInstructions;
    const result = await harness.service.draft(
      {
        featureKey: "lead-report-assistant",
        baseRevisionId: base.id,
        promptContents,
      },
      "admin-1",
    );
    expect(result).toMatchObject({
      id: draft.id,
      lifecycle: "draft",
      revision: 2,
      baseRevisionId: base.id,
    });
    expect(result.id).not.toBe(base.id);
    expect(harness.repository.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        featureKey: "lead-report-assistant",
        baseRevisionId: base.id,
        promptContents,
        createdBy: "admin-1",
      }),
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

  it("rejects an oversized schema-valid composition before persistence while a fitting draft succeeds", async () => {
    const entry = aiFeaturePromptCatalog.require("lead-report-assistant");
    const contentsFor = (tail: number): AiPromptContents =>
      Object.fromEntries(
        AI_PROMPT_SLOT_KEYS.map((slot) => [slot, "e".repeat(tail)]),
      ) as AiPromptContents;
    // Largest uniform tail length that still fits the canonical bundle cap.
    let fittingTail = 1;
    let high = AI_PROMPT_SLOT_CONTENT_LIMIT;
    while (fittingTail < high) {
      const mid = Math.ceil((fittingTail + high) / 2);
      try {
        composePromptSet(entry, contentsFor(mid), entry.lockedCore);
        fittingTail = mid;
      } catch {
        high = mid - 1;
      }
    }
    const base = bundle(AiPromptBundleLifecycle.active);
    const created: StoredAiPromptBundleRevision = {
      ...bundle(AiPromptBundleLifecycle.draft),
      id: "859b2767-0f86-41e2-b025-49730ca010e4",
      revision: 2,
      baseRevisionId: base.id,
    };
    const harness = serviceFor({ revision: base });
    harness.repository.createDraft.mockResolvedValue(created);

    // Every slot is individually schema-valid at the cap; the aggregate
    // serialized bundle still overflows.
    await expect(
      harness.service.draft(
        {
          featureKey: "lead-report-assistant",
          baseRevisionId: base.id,
          promptContents: contentsFor(AI_PROMPT_SLOT_CONTENT_LIMIT),
        },
        "admin-1",
      ),
    ).rejects.toBeInstanceOf(AiPromptConfigurationError);
    expect(harness.repository.createDraft).not.toHaveBeenCalled();
    expect(harness.audit.record).not.toHaveBeenCalled();
    expect(harness.metrics.record).not.toHaveBeenCalled();

    await expect(
      harness.service.draft(
        {
          featureKey: "lead-report-assistant",
          baseRevisionId: base.id,
          promptContents: contentsFor(fittingTail),
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({ lifecycle: "draft", revision: 2 });
    expect(harness.repository.createDraft).toHaveBeenCalledTimes(1);
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

  it.each([null, "report-assistant/editor-serving/v0"])(
    "keeps a valid historical core inspectable when serving is %s",
    async (servingContractVersion) => {
      const historicalCore = Object.fromEntries(
        baseline.slots.map(({ slot }) => [slot, `Legacy ${slot} core`]),
      );
      const legacy = {
        ...bundle(AiPromptBundleLifecycle.active),
        coreContractVersion: "report-assistant/core/v0",
        composerVersion: "report-assistant/composer/v1",
        servingContractVersion,
        lockedCoreSnapshot: historicalCore,
        effectiveContentHash: "f".repeat(64),
      };
      const harness = serviceFor({
        revision: legacy,
        control: control(legacy),
        provider: provider(),
      });

      const result = await harness.service.read("lead-report-assistant");

      expect(result.control.activeBundle?.servingStatus).toBe("incompatible");
      expect(result.control.activeBundle?.lockedCoreSnapshot).toEqual(
        historicalCore,
      );
      expect(
        result.control.activeBundle?.slots.map((slot) => slot.lockedCore),
      ).toEqual(baseline.slots.map(({ slot }) => `Legacy ${slot} core`));
      expect(result.control.history[0]?.servingStatus).toBe("incompatible");
      expect(result.control.availability).toBe("not_configured");
    },
  );

  it.each([
    {
      operation: "activate" as const,
      lifecycle: AiPromptBundleLifecycle.draft,
    },
    {
      operation: "restore" as const,
      lifecycle: AiPromptBundleLifecycle.superseded,
    },
  ])(
    "rejects $operation for a revision from a retired serving contract",
    async ({ operation, lifecycle }) => {
      const candidate = {
        ...bundle(lifecycle),
        servingContractVersion: "report-assistant/editor-serving/v0",
      };
      const harness = serviceFor({ revision: candidate });
      const input = {
        featureKey: "lead-report-assistant" as const,
        revisionId: candidate.id,
      };
      let failure: unknown;

      try {
        if (operation === "activate") {
          await harness.service.activate(input, "admin-1");
        } else {
          await harness.service.restore(input, "admin-1");
        }
      } catch (error) {
        failure = error;
      }

      expect(failure).toBeInstanceOf(AiPromptConfigurationError);
      expect(failure).toHaveProperty(
        "message",
        "This prompt revision belongs to a retired serving contract",
      );
      expect(harness.repository.activate).not.toHaveBeenCalled();
    },
  );

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
    expect(harness.audit.record).toHaveBeenCalledWith({
      event: "ai_prompt.activated",
      actorId: "admin-1",
      featureKey: "lead-report-assistant",
      revisionId: candidate.id,
      contentHash: candidate.effectiveContentHash,
      contractVersion: candidate.coreContractVersion,
    });
    expect(harness.metrics.record).toHaveBeenCalledWith({
      feature: "lead-report-assistant",
      operation: "activation",
      outcome: "passed",
    });
  });

  it("reports an activation conflict through the public service", async () => {
    const candidate = bundle(AiPromptBundleLifecycle.validated);
    const harness = serviceFor({ revision: candidate });
    harness.repository.activate.mockResolvedValue(false);

    await expect(
      harness.service.activate(
        {
          featureKey: "lead-report-assistant",
          revisionId: candidate.id,
        },
        "admin-1",
      ),
    ).rejects.toMatchObject({
      name: AiPromptConflictError.name,
      message: "Prompt activation lost a lifecycle race",
    });
    expect(harness.repository.activate).toHaveBeenCalled();
    expect(harness.audit.record).not.toHaveBeenCalled();
    expect(harness.metrics.record).not.toHaveBeenCalled();
  });

  it("activates a current draft without requiring a configured provider", async () => {
    const candidate = bundle(AiPromptBundleLifecycle.draft);
    const harness = serviceFor({ revision: candidate, provider: null });

    await expect(
      harness.service.activate(
        {
          featureKey: "lead-report-assistant",
          revisionId: candidate.id,
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({
      featureKey: "lead-report-assistant",
      revisionId: candidate.id,
      lifecycle: "active",
    });
    expect(harness.providerRepository.getControl).not.toHaveBeenCalled();
    const activation = harness.repository.activate.mock.lastCall?.[2];
    expect(harness.repository.activate).toHaveBeenCalledWith(
      "lead-report-assistant",
      candidate.id,
      {
        allowedLifecycle: activation?.allowedLifecycle,
        now: activation?.now,
        contract: { servingContractVersion: baseline.servingContractVersion },
      },
    );
    expect(activation?.allowedLifecycle).toContain(
      AiPromptBundleLifecycle.draft,
    );
    expect(activation?.now).toBeInstanceOf(Date);
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
    const candidate = bundle(AiPromptBundleLifecycle.failed);
    const harness = serviceFor({ revision: candidate });
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
    expect(harness.audit.record).toHaveBeenCalledWith({
      event: "ai_prompt.discarded",
      actorId: "admin-1",
      featureKey: "lead-report-assistant",
      revisionId,
      contentHash: candidate.effectiveContentHash,
      contractVersion: candidate.coreContractVersion,
    });
    expect(harness.metrics.record).toHaveBeenCalledWith({
      feature: "lead-report-assistant",
      operation: "discard",
      outcome: "passed",
    });
  });

  it("reports a discard conflict through the public service", async () => {
    const harness = serviceFor({
      revision: bundle(AiPromptBundleLifecycle.failed),
    });
    harness.repository.discardDisposable.mockResolvedValue(false);

    await expect(
      harness.service.discard(
        { featureKey: "lead-report-assistant", revisionId },
        "admin-1",
      ),
    ).rejects.toMatchObject({
      name: AiPromptConflictError.name,
      message: "AI prompt attempt could not be discarded",
    });
    expect(harness.repository.discardDisposable).toHaveBeenCalledWith(
      "lead-report-assistant",
      revisionId,
    );
    expect(harness.audit.record).not.toHaveBeenCalled();
    expect(harness.metrics.record).not.toHaveBeenCalled();
  });
});
