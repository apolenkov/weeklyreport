import type { Prisma } from "@prisma/client";
import {
  AiProviderLifecycle,
  AiProviderProfile,
  AiProviderReasoningMode,
} from "@prisma/client";
import { describe, expect, it, type Mock, vi } from "vitest";

import { providerEndpointIdentity } from "../domain/provider-profile.js";
import type {
  NewAiProviderRevision,
  StoredAiProviderControl,
  StoredAiProviderRevision,
} from "../infrastructure/ai-provider.repository.js";
import { AesGcmCredentialCodec } from "../infrastructure/credential-codec.js";
import type { AiProviderCapabilityTester } from "./ai-provider.service.js";
import {
  AiProviderConfigurationError,
  AiProviderConfigurationService,
  AiProviderNotFoundError,
} from "./ai-provider.service.js";

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
    answerProtocol: "json_schema",
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
  REPORT_ASSISTANT_INPUT_VERSION: "report-assistant/v1",
  MISTRAL_API_KEY: undefined,
  MISTRAL_PLANNER_MODEL: undefined,
  MISTRAL_ANSWER_MODEL: undefined,
  MISTRAL_EMBEDDING_MODEL: undefined,
  MISTRAL_EMBEDDING_DIMENSIONS: undefined,
} as const;

const bootstrapEnv = {
  ...env,
  MISTRAL_API_KEY: "legacy-secret",
  MISTRAL_PLANNER_MODEL: "legacy-planner",
  MISTRAL_ANSWER_MODEL: "legacy-answer",
  MISTRAL_EMBEDDING_MODEL: "legacy-embed",
  MISTRAL_EMBEDDING_DIMENSIONS: 1024,
} as const;

const passedResult = {
  status: "passed" as const,
  generation: {
    status: "passed" as const,
    answerProtocol: "json_schema" as const,
    capabilities: [
      "authentication",
      "planner_tool_call",
      "structured_answer",
      "token_usage",
    ].map((capability) => ({ capability, status: "passed" as const })),
    featureCompatibility: [],
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

const passedPromptCompatibility = {
  featureKey: "lead-report-assistant" as const,
  promptRevisionId: "33333333-3333-4333-8333-333333333333",
  contentHash: "a".repeat(64),
  evaluatorVersion: "report-assistant/evaluator/v1",
  outcome: "passed" as const,
  checks: [
    {
      code: "protocol_shape",
      status: "passed" as const,
      passedCount: 1,
      failedCount: 0,
    },
  ],
};

interface RepositoryHarness {
  getControl: Mock<() => Promise<StoredAiProviderControl | null>>;
  getRevision: Mock<(id: string) => Promise<StoredAiProviderRevision | null>>;
  hasAnyConfiguration: Mock<() => Promise<boolean>>;
  createDraft: Mock<
    (input: NewAiProviderRevision) => Promise<StoredAiProviderRevision>
  >;
  setTestResult: Mock<
    (
      id: string,
      result: Prisma.InputJsonValue,
      status: "passed" | "failed" | "inconclusive",
      embeddingDimensions: number | null,
      testedAt: Date,
      currentLifecycle: AiProviderLifecycle,
      identities?: Readonly<{
        generationCompatibilityIdentity: string;
        embeddingScopeIdentity: string;
        compositeTestIdentity: string;
      }>,
    ) => Promise<StoredAiProviderRevision>
  >;
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
      options?: Readonly<{
        promptEvaluatorVersions?: Readonly<Record<string, string>>;
      }>,
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
    hasAnyConfiguration: vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValue(true),
    createDraft: vi
      .fn<(input: NewAiProviderRevision) => Promise<StoredAiProviderRevision>>()
      .mockResolvedValue(draft),
    setTestResult: vi
      .fn<
        (
          id: string,
          result: Prisma.InputJsonValue,
          status: "passed" | "failed" | "inconclusive",
          embeddingDimensions: number | null,
          testedAt: Date,
          currentLifecycle: AiProviderLifecycle,
          identities?: Readonly<{
            generationCompatibilityIdentity: string;
            embeddingScopeIdentity: string;
            compositeTestIdentity: string;
          }>,
        ) => Promise<StoredAiProviderRevision>
      >()
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
          options?: Readonly<{
            promptEvaluatorVersions?: Readonly<Record<string, string>>;
          }>,
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
      { record: (event) => events.push({ ...event }) },
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

  it("stores a draft with encrypted credentials and emits only safe audit fields", async () => {
    const events: Record<string, unknown>[] = [];
    const repository = repositoryFor({ draft: revision(revisionId) });
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      tester,
      undefined,
      { record: (event) => events.push({ ...event }) },
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

    expect(repository.setTestResult).toHaveBeenCalledWith(
      revisionId,
      passedResult,
      "passed",
      1024,
      expect.any(Date),
      AiProviderLifecycle.draft,
      expect.any(Object),
    );
  });

  it("does not couple provider testing to stored prompt compatibility", async () => {
    const repository = repositoryFor({ draft: revision(revisionId) });
    const promptCompatibility = {
      evaluate: vi.fn().mockResolvedValue({
        status: "passed",
        features: [passedPromptCompatibility],
      }),
      verify: vi.fn().mockResolvedValue(true),
    };
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      tester,
      undefined,
      undefined,
      undefined,
      promptCompatibility,
    );

    await service.executeTest(revisionId);

    expect(promptCompatibility.evaluate).not.toHaveBeenCalled();
    const testResult = repository.setTestResult.mock.calls[0]?.[1];
    expect(testResult).toMatchObject({
      status: "passed",
      generation: { featureCompatibility: [] },
    });
  });

  it("keeps provider validation passed when optional prompt diagnostics are inconclusive", async () => {
    const repository = repositoryFor({ draft: revision(revisionId) });
    const inconclusiveFeature = {
      ...passedPromptCompatibility,
      outcome: "inconclusive" as const,
      checks: [
        {
          code: "protocol_shape",
          status: "inconclusive" as const,
          passedCount: 0,
          failedCount: 1,
        },
      ],
    };
    const promptCompatibility = {
      evaluate: vi.fn().mockResolvedValue({
        status: "inconclusive" as const,
        features: [inconclusiveFeature],
      }),
      verify: vi.fn().mockResolvedValue(false),
    };
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      tester,
      undefined,
      undefined,
      undefined,
      promptCompatibility,
    );

    await service.executeTest(revisionId);

    const call = repository.setTestResult.mock.calls[0];
    expect(call?.[0]).toBe(revisionId);
    expect(call?.[1]).toMatchObject({
      status: "passed",
      generation: {
        status: "passed",
        featureCompatibility: [],
      },
      embeddings: { status: "passed" },
    });
    expect(call?.[2]).toBe("passed");
    expect(call?.[3]).toBe(1024);
    expect(call?.[4]).toBeInstanceOf(Date);
    expect(call?.[5]).toBe(AiProviderLifecycle.draft);
    expect(call?.[6]).toBeDefined();
    expect(promptCompatibility.evaluate).not.toHaveBeenCalled();
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

    expect(repository.setTestResult).toHaveBeenCalledWith(
      activeId,
      passedResult,
      "passed",
      1024,
      expect.any(Date),
      AiProviderLifecycle.active,
      expect.any(Object),
    );
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
            answerProtocol: null,
            capabilities: [
              {
                capability: "planner_tool_call",
                status: "failed",
                failureCode: "tool_use_failed",
              },
            ],
            featureCompatibility: [],
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

    expect(repository.setTestResult).toHaveBeenCalledWith(
      activeId,
      expect.objectContaining({ status: "failed" }),
      "failed",
      null,
      expect.any(Date),
      AiProviderLifecycle.active,
      expect.any(Object),
    );
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

  it("activates without consulting stale prompt compatibility", async () => {
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
      prepare: vi.fn().mockResolvedValue({
        completed: 0,
        total: 0,
        failed: 0,
        elapsedMs: 0,
      }),
    };
    const promptCompatibility = {
      evaluate: vi.fn(),
      verify: vi.fn().mockResolvedValue(false),
    };
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      tester,
      preparation,
      undefined,
      undefined,
      promptCompatibility,
    );

    await expect(
      service.activate(revisionId, "admin-1"),
    ).resolves.toBeDefined();
    expect(promptCompatibility.verify).not.toHaveBeenCalled();
    expect(preparation.prepare).toHaveBeenCalledOnce();
    expect(repository.activateRevision).toHaveBeenCalledOnce();
  });

  it("uses the passing capability result as activation evidence", async () => {
    const candidate = revision(revisionId, {
      lifecycle: AiProviderLifecycle.validated,
      answerProtocol: null,
    });
    const repository = repositoryFor({ draft: candidate });
    repository.getRevision.mockResolvedValue(candidate);
    const preparation = {
      prepare: vi.fn().mockResolvedValue({
        completed: 0,
        total: 0,
        failed: 0,
        elapsedMs: 0,
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

  it("keeps the old active pointer when preparation reports failed vectors", async () => {
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
    );

    const result = await service.activate(revisionId, "admin-1");

    expect(result.activeRevisionId).toBe(activeId);
    expect(repository.activateRevision).not.toHaveBeenCalled();
    expect(repository.updateProgress).toHaveBeenLastCalledWith(
      revisionId,
      expect.objectContaining({ lifecycle: AiProviderLifecycle.failed }),
    );
  });

  it("resumes activation after embedding preparation completed", async () => {
    const candidate = revision(revisionId, {
      lifecycle: AiProviderLifecycle.preparing,
      preparationCompleted: 120,
      preparationTotal: 120,
      preparationFailed: 0,
      preparationStartedAt: new Date("2026-08-14T06:18:03.000Z"),
      preparationFinishedAt: new Date("2026-08-14T06:18:05.000Z"),
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
    );
  });

  it("bootstraps complete legacy Mistral settings once and stores only encrypted credentials", async () => {
    const repository = repositoryFor({ control: null });
    repository.hasAnyConfiguration
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      bootstrapEnv,
      tester,
    );

    await service.bootstrap("system");
    await service.bootstrap("system");

    expect(repository.createDraft).toHaveBeenCalledTimes(1);
    const created = repository.createDraft.mock.calls[0]?.[0];
    expect(created).toMatchObject({
      generation: { baseUrl: "https://api.mistral.ai/v1" },
      plannerModel: "legacy-planner",
      answerModel: "legacy-answer",
      embeddings: { model: "legacy-embed" },
    });
    expect(created?.generation.credential.ciphertext).not.toContain(
      "legacy-secret",
    );
    expect(repository.setTestResult).toHaveBeenCalledTimes(1);
    expect(repository.activateRevision).toHaveBeenCalledTimes(1);
  });

  it("leaves an empty database unconfigured when the legacy settings are incomplete", async () => {
    const repository = repositoryFor({ control: null });
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      tester,
    );

    await service.bootstrap("system");

    expect(repository.createDraft).not.toHaveBeenCalled();
    expect(repository.setTestResult).not.toHaveBeenCalled();
    expect(repository.activateRevision).not.toHaveBeenCalled();
  });
});
