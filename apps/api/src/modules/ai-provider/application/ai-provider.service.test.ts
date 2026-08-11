import type { Prisma } from "@prisma/client";
import { AiProviderLifecycle, AiProviderProfile } from "@prisma/client";
import { describe, expect, it, type Mock, vi } from "vitest";

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
} from "./ai-provider.service.js";

const KEY = "a".repeat(64);
const codec = new AesGcmCredentialCodec(KEY, 1);
const now = new Date("2026-08-10T00:00:00.000Z");
const revisionId = "11111111-1111-4111-8111-111111111111";
const activeId = "22222222-2222-4222-8222-222222222222";

const encrypted = codec.encrypt("secret-provider-key");

const revision = (
  id: string,
  overrides: Partial<StoredAiProviderRevision> = {},
): StoredAiProviderRevision => ({
  id,
  profile: AiProviderProfile.mistral,
  baseUrl: "https://api.mistral.ai/v1",
  endpointIdentity: "mistral:stable-endpoint",
  plannerModel: "planner",
  answerModel: "answer",
  embeddingModel: "embed",
  embeddingDimensions: 1024,
  semanticInputVersion: "report-assistant/v1",
  credentialCiphertext: encrypted.ciphertext,
  credentialNonce: encrypted.nonce,
  credentialTag: encrypted.tag,
  credentialKeyVersion: encrypted.keyVersion,
  credentialMaskedSuffix: encrypted.maskedSuffix,
  lifecycle: AiProviderLifecycle.draft,
  testResult: null,
  testedAt: null,
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
  ...overrides,
});

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
  capabilities: [
    "authentication",
    "planner_tool_call",
    "structured_answer",
    "token_usage",
    "batch_embeddings",
  ].map((capability) => ({ capability, status: "passed" as const })),
  testedAt: now.toISOString(),
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
      passed: boolean,
      embeddingDimensions: number | null,
      testedAt: Date,
      currentLifecycle: AiProviderLifecycle,
    ) => Promise<StoredAiProviderRevision>
  >;
  updateProgress: Mock<
    (
      id: string,
      progress: Readonly<Record<string, unknown>>,
    ) => Promise<StoredAiProviderRevision>
  >;
  activateRevision: Mock<(id: string, at: Date) => Promise<void>>;
  disable: Mock<() => Promise<void>>;
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
          passed: boolean,
          embeddingDimensions: number | null,
          testedAt: Date,
          currentLifecycle: AiProviderLifecycle,
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
      .fn<(id: string, at: Date) => Promise<void>>()
      .mockResolvedValue(undefined),
    disable: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
};

const tester: AiProviderCapabilityTester = {
  test: vi.fn().mockResolvedValue({
    result: passedResult,
    embeddingDimensions: 1024,
  }),
};

describe("AiProviderConfigurationService", () => {
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
        profile: "mistral",
        plannerModel: "planner",
        answerModel: "answer",
        embeddingModel: "embed",
        credential: "secret-provider-key",
      },
      "admin-1",
    );

    expect(result.credentialConfigured).toBe(true);
    expect(result.credentialMaskedSuffix).toContain("key");
    expect(JSON.stringify(events)).not.toContain("secret-provider-key");
    expect(JSON.stringify(events)).not.toContain(encrypted.ciphertext);
    const created = repository.createDraft.mock.calls[0]?.[0];
    expect(created?.credential.ciphertext).not.toContain("secret-provider-key");
    expect(created?.embeddingDimensions).toBeNull();
  });

  it("persists the embedding dimensions measured by the capability probe", async () => {
    const repository = repositoryFor({ draft: revision(revisionId) });
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      env,
      tester,
    );

    await service.test(revisionId, "admin-1");

    expect(repository.setTestResult).toHaveBeenCalledWith(
      revisionId,
      passedResult,
      true,
      1024,
      expect.any(Date),
      AiProviderLifecycle.draft,
    );
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

    await service.test(activeId, "admin-1");

    expect(repository.setTestResult).toHaveBeenCalledWith(
      activeId,
      passedResult,
      true,
      1024,
      expect.any(Date),
      AiProviderLifecycle.active,
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
          capabilities: [],
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

    await service.test(activeId, "admin-1");

    expect(repository.setTestResult).toHaveBeenCalledWith(
      activeId,
      expect.objectContaining({ status: "failed" }),
      false,
      null,
      expect.any(Date),
      AiProviderLifecycle.active,
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
      baseUrl: "https://api.mistral.ai/v1",
      plannerModel: "legacy-planner",
      answerModel: "legacy-answer",
      embeddingModel: "legacy-embed",
    });
    expect(created?.credential.ciphertext).not.toContain("legacy-secret");
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
