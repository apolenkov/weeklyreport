import {
  AiProviderLifecycle,
  AiProviderProfile,
  AiProviderReasoningMode,
} from "@prisma/client";
import { describe, expect, it, type Mock, vi } from "vitest";

import { createNullLogger } from "../../../lib/logger.js";
import { providerEndpointIdentity } from "../domain/provider-profile.js";
import type {
  AiProviderActivationReadiness,
  AiProviderConfigurationRepository,
  NewAiProviderRevision,
  StoredAiProviderControl,
  StoredAiProviderRevision,
} from "../infrastructure/ai-provider.repository.js";
import { AI_PROVIDER_TEST_SUITE_VERSION } from "../infrastructure/ai-provider-test.queue.js";
import { AesGcmCredentialCodec } from "../infrastructure/credential-codec.js";
import type { AiProviderCapabilityTester } from "./ai-provider.service.js";
import {
  AiProviderConfigurationError,
  AiProviderConfigurationService,
  AiProviderConflictError,
  AiProviderNotFoundError,
} from "./ai-provider.service.js";
import type { AiProviderPreparationCoordinator } from "./ai-provider.service-types.js";

const KEY = "a".repeat(64);
const codec = new AesGcmCredentialCodec(KEY, 1);
const now = new Date("2026-08-10T00:00:00.000Z");
const revisionId = "11111111-1111-4111-8111-111111111111";
const activeId = "22222222-2222-4222-8222-222222222222";

const encrypted = codec.encrypt("secret-provider-key", {
  revisionId,
  role: "generation",
});

const revision = (
  id: string,
  overrides: Partial<StoredAiProviderRevision> = {},
): StoredAiProviderRevision => {
  const credential = codec.encrypt("secret-provider-key", {
    revisionId: id,
    role: "generation",
  });
  return {
    id,
    generationProfile: AiProviderProfile.mistral,
    generationBaseUrl: "https://api.mistral.ai/v1",
    generationEndpointIdentity: "mistral:stable-endpoint",
    plannerModel: "planner",
    answerModel: "answer",
    embeddingModel: "embed",
    embeddingDimensions: 1024,
    semanticInputVersion: "report-assistant/v1",
    reasoningMode: AiProviderReasoningMode.provider_default,
    generationCredentialCiphertext: credential.ciphertext,
    generationCredentialNonce: credential.nonce,
    generationCredentialTag: credential.tag,
    generationCredentialKeyVersion: credential.keyVersion,
    generationCredentialMaskedSuffix: credential.maskedSuffix,
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
    lifecycle: AiProviderLifecycle.draft,
    testResult: passedResult,
    latestExecution: {
      id: "44444444-4444-4444-8444-444444444444",
      testSuiteVersion: AI_PROVIDER_TEST_SUITE_VERSION,
      state: "completed",
      outcome: "passed",
      failureCode: null,
      checks: [],
      requestedAt: now,
      startedAt: now,
      completedAt: now,
    },
    testedAt: now,
    preparationCompleted: 0,
    preparationTotal: 0,
    preparationFailed: 0,
    preparationStartedAt: null,
    preparationFinishedAt: null,
    preparationElapsedMs: 0,
    activatedAt: null,
    supersededAt: null,
    createdAt: now,
    updatedAt: now,
    reasoningCustomValue: overrides.reasoningCustomValue ?? null,
    ...overrides,
  };
};

const control = (
  active: StoredAiProviderRevision | null,
): StoredAiProviderControl => ({
  id: "singleton",
  activeConfigurationId: active?.id ?? null,
  enabled: active?.lifecycle === AiProviderLifecycle.active,
  createdAt: now,
  updatedAt: now,
  activeConfiguration: active,
  revisions: active ? [active] : [],
});

const env = {
  AI_PROVIDER_ALLOWED_ORIGINS: "https://api.mistral.ai,https://openrouter.ai",
  REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED: true,
  REPORT_ASSISTANT_INPUT_VERSION: "report-assistant/v1",
} as const;

const passedResult = {
  status: "passed" as const,
  generation: {
    status: "passed" as const,
    capabilities: [
      "authentication",
      "planner_tool_call",
      "structured_answer",
      "token_usage",
    ].map((capability) => ({ capability, status: "passed" as const })),
  },
  embeddings: {
    status: "passed" as const,
    capabilities: ["authentication", "batch_embeddings"].map((capability) => ({
      capability,
      status: "passed" as const,
    })),
  },
  testedAt: now.toISOString(),
};

interface RepositoryHarness {
  getControl: Mock<() => Promise<StoredAiProviderControl | null>>;
  getRevision: Mock<(id: string) => Promise<StoredAiProviderRevision | null>>;
  createDraft: Mock<
    (input: NewAiProviderRevision) => Promise<StoredAiProviderRevision>
  >;
  setTestResult: Mock<AiProviderConfigurationRepository["setTestResult"]>;
  updateProgress: Mock<
    (
      id: string,
      progress: Readonly<Record<string, unknown>>,
    ) => Promise<StoredAiProviderRevision>
  >;
  activateRevision: Mock<
    (
      id: string,
      at: Date,
      readiness: AiProviderActivationReadiness,
    ) => Promise<boolean>
  >;
  disable: Mock<() => Promise<void>>;
  discardDisposable: Mock<(id: string) => Promise<boolean>>;
}

const repositoryFor = (values: {
  control?: StoredAiProviderControl | null;
  draft?: StoredAiProviderRevision;
}): RepositoryHarness => {
  const draft = values.draft ?? revision(revisionId);
  return {
    getControl: vi
      .fn<() => Promise<StoredAiProviderControl | null>>()
      .mockResolvedValue(values.control ?? null),
    getRevision: vi
      .fn<(id: string) => Promise<StoredAiProviderRevision | null>>()
      .mockResolvedValue(draft),
    createDraft: vi
      .fn<(input: NewAiProviderRevision) => Promise<StoredAiProviderRevision>>()
      .mockResolvedValue(draft),
    setTestResult: vi
      .fn<AiProviderConfigurationRepository["setTestResult"]>()
      .mockResolvedValue(
        revision(draft.id, {
          ...draft,
          lifecycle: AiProviderLifecycle.validated,
          testResult: passedResult,
          testedAt: now,
        }),
      ),
    updateProgress: vi
      .fn<
        (
          id: string,
          progress: Readonly<Record<string, unknown>>,
        ) => Promise<StoredAiProviderRevision>
      >()
      .mockResolvedValue(draft),
    activateRevision: vi
      .fn<
        (
          id: string,
          at: Date,
          readiness: AiProviderActivationReadiness,
        ) => Promise<boolean>
      >()
      .mockResolvedValue(true),
    disable: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    discardDisposable: vi
      .fn<(id: string) => Promise<boolean>>()
      .mockResolvedValue(true),
  };
};

const tester: AiProviderCapabilityTester = {
  test: vi.fn().mockResolvedValue({
    result: passedResult,
    embeddingDimensions: 1024,
  }),
};

describe("AiProviderConfigurationService", () => {
  it("discards a failed revision and records only safe metadata", async () => {
    const events: Record<string, unknown>[] = [];
    const repository = repositoryFor({
      draft: revision(revisionId, { lifecycle: AiProviderLifecycle.failed }),
    });
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      tester,
      undefined,
      {
        ...createNullLogger(),
        info: (_message, event) => events.push({ ...event }),
      },
    );

    await expect(service.discard(revisionId, "admin-1")).resolves.toEqual({
      discarded: true,
    });
    expect(repository.discardDisposable).toHaveBeenCalledWith(revisionId);
    expect(events).toContainEqual(
      expect.objectContaining({
        event: "ai_provider.discarded",
        actorId: "admin-1",
        revisionId,
      }),
    );
    expect(JSON.stringify(events)).not.toContain("secret-provider-key");
  });

  it("refuses to discard a protected revision", async () => {
    const repository = repositoryFor({
      draft: revision(revisionId, {
        lifecycle: AiProviderLifecycle.superseded,
      }),
    });
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      tester,
    );

    await expect(service.discard(revisionId, "admin-1")).rejects.toBeInstanceOf(
      AiProviderConfigurationError,
    );
    expect(repository.discardDisposable).not.toHaveBeenCalled();
  });

  it("reports a missing revision without attempting a delete", async () => {
    const repository = repositoryFor({});
    repository.getRevision.mockResolvedValue(null);
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      tester,
    );

    await expect(service.discard(revisionId, "admin-1")).rejects.toBeInstanceOf(
      AiProviderNotFoundError,
    );
    expect(repository.discardDisposable).not.toHaveBeenCalled();
  });

  it("reports a controlled failure when the lifecycle changes before delete", async () => {
    const repository = repositoryFor({});
    repository.discardDisposable.mockResolvedValue(false);
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      tester,
    );

    await expect(service.discard(revisionId, "admin-1")).rejects.toThrow(
      "AI provider attempt could not be discarded",
    );
  });

  it("returns availability without exposing configuration metadata", async () => {
    const repository = repositoryFor({ control: null });
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      tester,
    );

    await expect(service.availability()).resolves.toEqual({
      availability: "not_configured",
    });
  });

  it("reports AI unavailable when runtime outbound approval is withdrawn", async () => {
    const repository = repositoryFor({
      control: control(
        revision(revisionId, { lifecycle: AiProviderLifecycle.active }),
      ),
    });
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      { ...env, REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED: false },
      tester,
    );

    await expect(service.availability()).resolves.toEqual({
      availability: "not_configured",
    });
    expect(repository.getControl).not.toHaveBeenCalled();
  });

  it("stores a draft with encrypted credentials and emits only safe audit fields", async () => {
    const events: Record<string, unknown>[] = [];
    const repository = repositoryFor({ draft: revision(revisionId) });
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      tester,
      undefined,
      {
        ...createNullLogger(),
        info: (_message, event) => events.push({ ...event }),
      },
    );

    const result = await service.save(
      {
        generation: {
          profile: "mistral",
          plannerModel: "planner",
          answerModel: "answer",
          reasoningMode: "provider_default",
          credential: "secret-provider-key",
        },
        embeddings: { mode: "reuse_generation", model: "embed" },
      },
      "admin-1",
    );

    expect(result.generation.credentialConfigured).toBe(true);
    expect(result.generation.credentialMaskedSuffix).toContain("key");
    expect(JSON.stringify(events)).not.toContain("secret-provider-key");
    expect(JSON.stringify(events)).not.toContain(encrypted.ciphertext);
    const created = repository.createDraft.mock.calls[0]?.[0];
    expect(created?.generation.credential.ciphertext).not.toContain(
      "secret-provider-key",
    );
    expect(created?.embeddings.dimensions).toBeNull();
  });

  it("saves Groq generation with Jina embeddings without running capability probes", async () => {
    const repository = repositoryFor({ draft: revision(revisionId) });
    const capabilityTester: AiProviderCapabilityTester = {
      test: vi.fn().mockResolvedValue({
        result: passedResult,
        embeddingDimensions: 1024,
      }),
    };
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      {
        ...env,
        AI_PROVIDER_ALLOWED_ORIGINS: "https://api.groq.com,https://api.jina.ai",
      },
      capabilityTester,
    );

    await expect(
      service.save(
        {
          generation: {
            profile: "groq",
            plannerModel: "qwen/qwen3.6-27b",
            answerModel: "qwen/qwen3.6-27b",
            reasoningMode: "provider_default",
            credential: "generation-secret",
          },
          embeddings: {
            mode: "separate",
            profile: "jina",
            model: "jina-embeddings-v5-text-small",
            credential: "embedding-secret",
          },
        },
        "admin-1",
      ),
    ).resolves.toBeDefined();
    expect(repository.createDraft).toHaveBeenCalledOnce();
    expect(capabilityTester.test).not.toHaveBeenCalled();
  });

  it("retains credentials from an inactive base revision", async () => {
    const embeddingCredential = codec.encrypt("embedding-secret", {
      revisionId,
      role: "embeddings",
    });
    const source = revision(revisionId, {
      generationProfile: AiProviderProfile.groq,
      generationBaseUrl: "https://api.groq.com/openai/v1",
      generationEndpointIdentity: providerEndpointIdentity(
        "groq",
        "https://api.groq.com/openai/v1",
      ),
      plannerModel: "qwen/qwen3.6-27b",
      answerModel: "qwen/qwen3.6-27b",
      embeddingMode: "separate",
      embeddingProfile: AiProviderProfile.jina,
      embeddingBaseUrl: "https://api.jina.ai/v1",
      embeddingEndpointIdentity: providerEndpointIdentity(
        "jina",
        "https://api.jina.ai/v1",
      ),
      embeddingCredentialCiphertext: embeddingCredential.ciphertext,
      embeddingCredentialNonce: embeddingCredential.nonce,
      embeddingCredentialTag: embeddingCredential.tag,
      embeddingCredentialKeyVersion: embeddingCredential.keyVersion,
      embeddingCredentialMaskedSuffix: embeddingCredential.maskedSuffix,
    });
    const repository = repositoryFor({ draft: source, control: null });
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      {
        ...env,
        AI_PROVIDER_ALLOWED_ORIGINS: "https://api.groq.com,https://api.jina.ai",
      },
      tester,
    );

    await service.save(
      {
        baseRevisionId: revisionId,
        generation: {
          profile: "groq",
          plannerModel: "qwen/qwen3.6-27b",
          answerModel: "qwen/qwen3.6-27b",
          reasoningMode: "provider_default",
        },
        embeddings: {
          mode: "separate",
          profile: "jina",
          model: "jina-embeddings-v5-text-small",
        },
      },
      "admin-1",
    );

    const created = repository.createDraft.mock.calls[0]?.[0];
    expect(created).toBeDefined();
    if (!created) throw new Error("Expected a created provider draft");
    expect(
      codec.decrypt(created.generation.credential, {
        revisionId: created.id,
        role: "generation",
      }),
    ).toBe("secret-provider-key");
    if (created.embeddings.mode !== "separate") {
      throw new Error("Expected a separate embeddings connection");
    }
    expect(
      codec.decrypt(created.embeddings.credential, {
        revisionId: created.id,
        role: "embeddings",
      }),
    ).toBe("embedding-secret");
  });

  it("persists the embedding dimensions measured by the capability probe", async () => {
    const repository = repositoryFor({ draft: revision(revisionId) });
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      tester,
    );

    await service.executeTest(revisionId);

    const recorded = repository.setTestResult.mock.lastCall?.[0];
    expect(repository.setTestResult).toHaveBeenCalledWith({
      id: revisionId,
      result: passedResult,
      status: "passed",
      embeddingDimensions: 1024,
      testedAt: recorded?.testedAt,
      currentLifecycle: AiProviderLifecycle.draft,
      generationCompatibilityIdentity:
        recorded?.generationCompatibilityIdentity,
      embeddingScopeIdentity: recorded?.embeddingScopeIdentity,
      compositeTestIdentity: recorded?.compositeTestIdentity,
    });
    expect(recorded?.testedAt).toBeInstanceOf(Date);
    expect(recorded?.generationCompatibilityIdentity).toBeTypeOf("string");
    expect(recorded?.embeddingScopeIdentity).toBeTypeOf("string");
    expect(recorded?.compositeTestIdentity).toBeTypeOf("string");
  });

  it("keeps an active revision active when its capability retest passes", async () => {
    const active = revision(activeId, {
      lifecycle: AiProviderLifecycle.active,
    });
    const repository = repositoryFor({
      control: control(active),
      draft: active,
    });
    repository.getRevision.mockResolvedValue(active);
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      tester,
    );

    await service.executeTest(activeId);

    const recorded = repository.setTestResult.mock.lastCall?.[0];
    expect(repository.setTestResult).toHaveBeenCalledWith({
      id: activeId,
      result: passedResult,
      status: "passed",
      embeddingDimensions: 1024,
      testedAt: recorded?.testedAt,
      currentLifecycle: AiProviderLifecycle.active,
      generationCompatibilityIdentity:
        recorded?.generationCompatibilityIdentity,
      embeddingScopeIdentity: recorded?.embeddingScopeIdentity,
      compositeTestIdentity: recorded?.compositeTestIdentity,
    });
    expect(recorded?.testedAt).toBeInstanceOf(Date);
    expect(recorded?.generationCompatibilityIdentity).toBeTypeOf("string");
    expect(recorded?.embeddingScopeIdentity).toBeTypeOf("string");
    expect(recorded?.compositeTestIdentity).toBeTypeOf("string");
  });

  it("keeps an active revision active when its capability retest fails", async () => {
    const active = revision(activeId, {
      lifecycle: AiProviderLifecycle.active,
    });
    const repository = repositoryFor({
      control: control(active),
      draft: active,
    });
    repository.getRevision.mockResolvedValue(active);
    const failedTester: AiProviderCapabilityTester = {
      test: vi.fn().mockResolvedValue({
        result: {
          status: "failed",
          generation: {
            status: "failed",
            capabilities: [
              {
                capability: "planner_tool_call",
                status: "failed",
                failureCode: "tool_use_failed",
              },
            ],
          },
          embeddings: { status: "passed", capabilities: [] },
          testedAt: now.toISOString(),
        },
        embeddingDimensions: null,
      }),
    };
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      failedTester,
    );

    await service.executeTest(activeId);

    const recorded = repository.setTestResult.mock.lastCall?.[0];
    expect(repository.setTestResult).toHaveBeenCalledWith({
      id: activeId,
      result: recorded?.result,
      status: "failed",
      embeddingDimensions: null,
      testedAt: recorded?.testedAt,
      currentLifecycle: AiProviderLifecycle.active,
      generationCompatibilityIdentity:
        recorded?.generationCompatibilityIdentity,
      embeddingScopeIdentity: recorded?.embeddingScopeIdentity,
      compositeTestIdentity: recorded?.compositeTestIdentity,
    });
    expect(recorded?.result).toMatchObject({ status: "failed" });
    expect(recorded?.testedAt).toBeInstanceOf(Date);
    expect(recorded?.generationCompatibilityIdentity).toBeTypeOf("string");
    expect(recorded?.embeddingScopeIdentity).toBeTypeOf("string");
    expect(recorded?.compositeTestIdentity).toBeTypeOf("string");
  });

  it("rejects embedding-scope activation when preparation is unavailable", async () => {
    const active = revision(activeId, {
      lifecycle: AiProviderLifecycle.active,
      embeddingModel: "old-embed",
    });
    const candidate = revision(revisionId, {
      lifecycle: AiProviderLifecycle.validated,
      embeddingModel: "new-embed",
    });
    const repository = repositoryFor({
      control: control(active),
      draft: candidate,
    });
    repository.getRevision.mockResolvedValue(candidate);
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      tester,
    );

    await expect(
      service.activate(revisionId, "admin-1"),
    ).rejects.toBeInstanceOf(AiProviderConfigurationError);
    expect(repository.activateRevision).not.toHaveBeenCalled();
  });

  it("blocks activation when outbound report-data approval is absent", async () => {
    const candidate = revision(revisionId, {
      lifecycle: AiProviderLifecycle.validated,
    });
    const repository = repositoryFor({ draft: candidate });
    repository.getRevision.mockResolvedValue(candidate);
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      { ...env, REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED: false },
      tester,
    );

    await expect(service.activate(revisionId, "admin-1")).rejects.toThrow(
      "Outbound report-data approval is required",
    );
    expect(repository.getControl).not.toHaveBeenCalled();
    expect(repository.activateRevision).not.toHaveBeenCalled();
  });

  it("activates without prompt compatibility checks", async () => {
    const active = revision(activeId, {
      lifecycle: AiProviderLifecycle.active,
    });
    const candidate = revision(revisionId, {
      lifecycle: AiProviderLifecycle.validated,
      embeddingModel: "new-embed",
    });
    const repository = repositoryFor({
      control: control(active),
      draft: candidate,
    });
    repository.getRevision.mockResolvedValueOnce(candidate).mockResolvedValue(
      revision(revisionId, {
        ...candidate,
        lifecycle: AiProviderLifecycle.preparing,
        preparationCompleted: 0,
        preparationTotal: 0,
        preparationFailed: 0,
        preparationFinishedAt: now,
        preparationSourceFingerprint: "source-fingerprint",
        preparationSourceGeneration: 0n,
      }),
    );
    const preparation = {
      prepare: vi.fn().mockResolvedValue({
        completed: 0,
        total: 0,
        failed: 0,
        elapsedMs: 0,
        sourceFingerprint: "source-fingerprint",
        sourceGeneration: 0n,
      }),
    };
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      tester,
      preparation,
    );

    await expect(
      service.activate(revisionId, "admin-1"),
    ).resolves.toBeDefined();
    expect(preparation.prepare).toHaveBeenCalledOnce();
    expect(repository.activateRevision).toHaveBeenCalledOnce();
  });

  it("uses the passing capability result as activation evidence", async () => {
    const candidate = revision(revisionId, {
      lifecycle: AiProviderLifecycle.validated,
    });
    const repository = repositoryFor({ draft: candidate });
    repository.getRevision.mockResolvedValueOnce(candidate).mockResolvedValue(
      revision(revisionId, {
        ...candidate,
        lifecycle: AiProviderLifecycle.preparing,
        preparationCompleted: 0,
        preparationTotal: 0,
        preparationFailed: 0,
        preparationFinishedAt: now,
        preparationSourceFingerprint: "source-fingerprint",
        preparationSourceGeneration: 0n,
      }),
    );
    const preparation = {
      prepare: vi.fn().mockResolvedValue({
        completed: 0,
        total: 0,
        failed: 0,
        elapsedMs: 0,
        sourceFingerprint: "source-fingerprint",
        sourceGeneration: 0n,
      }),
    };
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      tester,
      preparation,
    );

    await expect(
      service.activate(revisionId, "admin-1"),
    ).resolves.toBeDefined();
    expect(preparation.prepare).toHaveBeenCalledOnce();
    expect(repository.activateRevision).toHaveBeenCalledOnce();
  });

  it.each(["activate", "restore"] as const)(
    "%s keeps the old active pointer when preparation reports failed vectors",
    async (operation) => {
      const events: Record<string, unknown>[] = [];
      const active = revision(activeId, {
        lifecycle: AiProviderLifecycle.active,
      });
      const candidate = revision(revisionId, {
        lifecycle: AiProviderLifecycle.validated,
        embeddingModel: "new-embed",
      });
      const repository = repositoryFor({
        control: control(active),
        draft: candidate,
      });
      repository.getRevision.mockResolvedValue(candidate);
      repository.updateProgress
        .mockResolvedValueOnce(
          revision(revisionId, {
            ...candidate,
            lifecycle: AiProviderLifecycle.preparing,
          }),
        )
        .mockResolvedValueOnce(
          revision(revisionId, {
            ...candidate,
            lifecycle: AiProviderLifecycle.failed,
            preparationTotal: 2,
            preparationFailed: 1,
          }),
        );
      const preparation = {
        prepare: vi.fn().mockResolvedValue({
          completed: 1,
          total: 2,
          failed: 1,
          elapsedMs: 20,
        }),
      };
      const service = new AiProviderConfigurationService(
        repository as never,
        codec,
        env,
        tester,
        preparation,
        {
          ...createNullLogger(),
          info: (_message, event) => events.push({ ...event }),
        },
      );

      const result = await service[operation](revisionId, "admin-1");

      expect(events.map((event) => event.event)).toEqual([
        "ai_provider.activation_requested",
        "ai_provider.activation_failed",
      ]);
      expect(result.activeRevisionId).toBe(activeId);
      expect(repository.activateRevision).not.toHaveBeenCalled();
      expect(repository.updateProgress).toHaveBeenLastCalledWith(
        revisionId,
        expect.objectContaining({ lifecycle: AiProviderLifecycle.failed }),
      );
    },
  );

  it.each(["activate", "restore"] as const)(
    "%s persists observed preparation counters when preparation rejects after progress",
    async (operation) => {
      const events: Record<string, unknown>[] = [];
      const active = revision(activeId, {
        lifecycle: AiProviderLifecycle.active,
      });
      const candidate = revision(revisionId, {
        lifecycle: AiProviderLifecycle.validated,
        embeddingModel: "new-embed",
      });
      const repository = repositoryFor({
        control: control(active),
        draft: candidate,
      });
      repository.getRevision.mockResolvedValue(candidate);
      const preparation = {
        prepare: vi
          .fn<AiProviderPreparationCoordinator["prepare"]>()
          .mockImplementation(async (_prepared, _previous, onProgress) => {
            await onProgress?.({
              completed: 4,
              total: 10,
              failed: 6,
              elapsedMs: 20,
            });
            throw new Error("queue unavailable");
          }),
      };
      const service = new AiProviderConfigurationService(
        repository as never,
        codec,
        env,
        tester,
        preparation,
        {
          ...createNullLogger(),
          info: (_message, event) => events.push({ ...event }),
        },
      );

      const result = await service[operation](revisionId, "admin-1");

      expect(events.map((event) => event.event)).toEqual([
        "ai_provider.activation_requested",
        "ai_provider.activation_failed",
      ]);
      expect(result.activeRevisionId).toBe(activeId);
      expect(repository.activateRevision).not.toHaveBeenCalled();
      expect(repository.updateProgress).toHaveBeenLastCalledWith(
        revisionId,
        expect.objectContaining({
          completed: 4,
          total: 10,
          failed: 6,
          lifecycle: AiProviderLifecycle.failed,
        }),
      );
    },
  );

  const auditFailureScenarios = [
    {
      name: "embedding preparation is not configured",
      expectedError: "Embedding preparation is not configured",
      expectedErrorClass: AiProviderConfigurationError,
      configure: (
        repository: RepositoryHarness,
        candidate: StoredAiProviderRevision,
      ) => {
        repository.getRevision.mockResolvedValue(candidate);
        return undefined;
      },
      activation: "not-called" as const,
    },
    {
      name: "preparation evidence is incomplete",
      expectedError: "Semantic preparation evidence is incomplete",
      expectedErrorClass: AiProviderConfigurationError,
      configure: (
        repository: RepositoryHarness,
        candidate: StoredAiProviderRevision,
      ) => {
        repository.getRevision.mockResolvedValue(candidate);
        return {
          prepare: vi.fn().mockResolvedValue({
            completed: 10,
            total: 10,
            failed: 0,
            elapsedMs: 20,
          }),
        };
      },
      activation: "not-called" as const,
    },
    {
      name: "the revision disappears mid-activation",
      expectedError: "AI provider revision disappeared during activation",
      expectedErrorClass: AiProviderConfigurationError,
      configure: (
        repository: RepositoryHarness,
        candidate: StoredAiProviderRevision,
        operation: "activate" | "restore",
      ) => {
        const readsBeforeRevalidation = operation === "restore" ? 2 : 1;
        let reads = 0;
        repository.getRevision.mockImplementation(() => {
          reads += 1;
          return Promise.resolve(
            reads <= readsBeforeRevalidation ? candidate : null,
          );
        });
        return {
          prepare: vi.fn().mockResolvedValue({
            completed: 10,
            total: 10,
            failed: 0,
            elapsedMs: 20,
          }),
        };
      },
      activation: "not-called" as const,
    },
    {
      name: "sources change after preparation",
      expectedError: "Report sources changed after embedding preparation",
      expectedErrorClass: AiProviderConfigurationError,
      configure: (
        repository: RepositoryHarness,
        candidate: StoredAiProviderRevision,
      ) => {
        const prepared = revision(revisionId, {
          ...candidate,
          preparationCompleted: 10,
          preparationTotal: 10,
          preparationFailed: 0,
          preparationFinishedAt: now,
          preparationSourceFingerprint: "prepared-source",
          preparationSourceGeneration: 3n,
        });
        repository.getRevision
          .mockResolvedValueOnce(candidate)
          .mockResolvedValue(prepared);
        return {
          prepare: vi.fn().mockResolvedValue({
            completed: 10,
            total: 10,
            failed: 0,
            elapsedMs: 20,
          }),
          currentSourceFingerprint: vi.fn().mockResolvedValue("changed-source"),
        };
      },
      activation: "not-called" as const,
    },
    {
      name: "activation loses a lifecycle race",
      expectedError: "AI provider activation lost a lifecycle race",
      expectedErrorClass: AiProviderConflictError,
      configure: (
        repository: RepositoryHarness,
        candidate: StoredAiProviderRevision,
      ) => {
        const prepared = revision(revisionId, {
          ...candidate,
          preparationCompleted: 10,
          preparationTotal: 10,
          preparationFailed: 0,
          preparationFinishedAt: now,
          preparationSourceFingerprint: "prepared-source",
          preparationSourceGeneration: 3n,
        });
        repository.getRevision
          .mockResolvedValueOnce(candidate)
          .mockResolvedValue(prepared);
        repository.activateRevision.mockResolvedValue(false);
        return {
          prepare: vi.fn().mockResolvedValue({
            completed: 10,
            total: 10,
            failed: 0,
            elapsedMs: 20,
          }),
          currentSourceFingerprint: vi
            .fn()
            .mockResolvedValue("prepared-source"),
        };
      },
      activation: "called" as const,
    },
  ] as const;

  const auditFailureCases = auditFailureScenarios.flatMap((scenario) =>
    (["activate", "restore"] as const).map((operation) => ({
      ...scenario,
      operation,
    })),
  );

  it.each(auditFailureCases)(
    "$operation audits $name with a terminal failure event",
    async ({
      operation,
      configure,
      expectedError,
      expectedErrorClass,
      activation,
    }) => {
      const events: Record<string, unknown>[] = [];
      const active = revision(activeId, {
        lifecycle: AiProviderLifecycle.active,
      });
      const candidate = revision(revisionId, {
        lifecycle: AiProviderLifecycle.validated,
        embeddingModel: "new-embed",
      });
      const repository = repositoryFor({
        control: control(active),
        draft: candidate,
      });
      const preparation = configure(repository, candidate, operation);
      const service = new AiProviderConfigurationService(
        repository as never,
        codec,
        env,
        tester,
        preparation,
        {
          ...createNullLogger(),
          info: (_message, event) => events.push({ ...event }),
        },
      );

      const attempt = service[operation](revisionId, "admin-1");
      await expect(attempt).rejects.toThrow(expectedError);
      await expect(attempt).rejects.toThrow(expectedErrorClass);

      expect(events).toEqual([
        {
          event: "ai_provider.activation_requested",
          actorId: "admin-1",
          revisionId,
          profile: "mistral",
        },
        {
          event: "ai_provider.activation_failed",
          actorId: "admin-1",
          revisionId,
          profile: "mistral",
        },
      ]);
      if (activation === "called") {
        expect(repository.activateRevision).toHaveBeenCalledOnce();
      } else {
        expect(repository.activateRevision).not.toHaveBeenCalled();
      }
    },
  );

  it.each(["activate", "restore"] as const)(
    "%s reuses current readiness without preparing embeddings",
    async (operation) => {
      const events: Record<string, unknown>[] = [];
      const preparedAt = new Date("2026-08-14T06:18:05.000Z");
      const active = revision(activeId, {
        lifecycle: AiProviderLifecycle.active,
        preparationCompleted: 120,
        preparationTotal: 120,
        preparationFailed: 0,
        preparationStartedAt: new Date("2026-08-14T06:18:03.000Z"),
        preparationFinishedAt: preparedAt,
        preparationElapsedMs: 2000,
        preparationSourceFingerprint: "current-source",
        preparationSourceGeneration: 7n,
      });
      const candidate = revision(revisionId, {
        lifecycle: AiProviderLifecycle.validated,
        plannerModel: "new-planner",
        embeddingScopeIdentity: active.embeddingScopeIdentity,
      });
      const repository = repositoryFor({
        control: control(active),
        draft: candidate,
      });
      repository.getRevision.mockResolvedValue(candidate);
      const preparation = {
        prepare: vi.fn(),
        currentSourceFingerprint: vi
          .fn()
          .mockRejectedValue(new Error("must not inspect current sources")),
      };
      const service = new AiProviderConfigurationService(
        repository as never,
        codec,
        env,
        tester,
        preparation,
        {
          ...createNullLogger(),
          info: (_message, event) => events.push({ ...event }),
        },
      );

      await expect(
        service[operation](revisionId, "admin-1"),
      ).resolves.toBeDefined();
      expect(events.map((event) => event.event)).toEqual([
        "ai_provider.activation_requested",
        "ai_provider.activation_succeeded",
        ...(operation === "restore" ? ["ai_provider.restored"] : []),
      ]);
      expect(preparation.prepare).not.toHaveBeenCalled();
      expect(preparation.currentSourceFingerprint).not.toHaveBeenCalled();
      expect(repository.updateProgress).not.toHaveBeenCalled();
      expect(repository.activateRevision).toHaveBeenCalledWith(
        revisionId,
        expect.any(Date),
        {
          mode: "reuse_active_scope",
          activeRevisionId: activeId,
          sourceFingerprint: "current-source",
          sourceGeneration: 7n,
        },
      );
    },
  );

  it("resumes activation after embedding preparation completed", async () => {
    const candidate = revision(revisionId, {
      lifecycle: AiProviderLifecycle.preparing,
      preparationCompleted: 120,
      preparationTotal: 120,
      preparationFailed: 0,
      preparationStartedAt: new Date("2026-08-14T06:18:03.000Z"),
      preparationFinishedAt: new Date("2026-08-14T06:18:05.000Z"),
      preparationSourceFingerprint: "source-fingerprint",
      preparationSourceGeneration: 0n,
    });
    const repository = repositoryFor({ control: null, draft: candidate });
    repository.getRevision.mockResolvedValue(candidate);
    const preparation = {
      prepare: vi.fn().mockResolvedValue({
        completed: 120,
        total: 120,
        failed: 0,
        elapsedMs: 2000,
      }),
    };
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      tester,
      preparation,
    );

    await expect(
      service.activate(revisionId, "admin-1"),
    ).resolves.toBeDefined();
    expect(preparation.prepare).not.toHaveBeenCalled();
    expect(repository.activateRevision).toHaveBeenCalledWith(
      revisionId,
      expect.any(Date),
      {
        mode: "prepared",
        sourceFingerprint: "source-fingerprint",
        sourceGeneration: 0n,
      },
    );
  });

  it("re-prepares instead of failing forever when sources changed after preparation", async () => {
    const candidate = revision(revisionId, {
      lifecycle: AiProviderLifecycle.preparing,
      preparationCompleted: 120,
      preparationTotal: 120,
      preparationFailed: 0,
      preparationStartedAt: new Date("2026-08-14T06:18:03.000Z"),
      preparationFinishedAt: new Date("2026-08-14T06:18:05.000Z"),
      preparationSourceFingerprint: "prepared-source",
      preparationSourceGeneration: 0n,
    });
    const repository = repositoryFor({ control: null, draft: candidate });
    repository.getRevision.mockResolvedValue(candidate);
    const preparation = {
      prepare: vi.fn().mockResolvedValue({
        completed: 120,
        total: 120,
        failed: 0,
        elapsedMs: 2000,
      }),
      // Stale on the freshness probe, current again after re-preparation.
      currentSourceFingerprint: vi
        .fn()
        .mockResolvedValueOnce("changed-source")
        .mockResolvedValue("prepared-source"),
    };
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      tester,
      preparation,
    );

    await expect(
      service.activate(revisionId, "admin-1"),
    ).resolves.toBeDefined();
    expect(preparation.prepare).toHaveBeenCalledOnce();
    expect(repository.activateRevision).toHaveBeenCalledOnce();
  });
});
