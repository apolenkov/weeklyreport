import { AiProviderLifecycle, AiProviderProfile } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type {
  StoredAiProviderControl,
  StoredAiProviderRevision,
} from "../../ai-provider/infrastructure/ai-provider.repository.js";
import { AesGcmCredentialCodec } from "../../ai-provider/infrastructure/credential-codec.js";
import { baselineReportAssistantPrompts } from "./ai-feature-prompt-catalog.js";
import {
  AiRuntimeNotConfiguredError,
  AiRuntimeResolver,
} from "./ai-runtime.resolver.js";
import type { SemanticEmbeddingRepository } from "./semantic-embedding.repository.js";
import type { SemanticIndexEnqueuer } from "./semantic-index.enqueuer.js";

const codec = new AesGcmCredentialCodec("a".repeat(64), 1);
const encrypted = codec.encrypt("provider-secret", {
  revisionId: "revision-1",
  role: "generation",
});
const now = new Date("2026-08-10T00:00:00.000Z");

const revision = (
  lifecycle: AiProviderLifecycle,
): StoredAiProviderRevision => ({
  id: "revision-1",
  generationProfile: AiProviderProfile.mistral,
  generationBaseUrl: "https://api.mistral.ai/v1",
  generationEndpointIdentity: "mistral:stable-endpoint",
  plannerModel: "planner-1",
  answerModel: "answer-1",
  embeddingModel: "embed-1",
  embeddingDimensions: 3,
  semanticInputVersion: "report-assistant/v1",
  reasoningMode: "provider_default",
  reasoningCustomValue: null,
  answerProtocol: "json_schema",
  generationCredentialCiphertext: encrypted.ciphertext,
  generationCredentialNonce: encrypted.nonce,
  generationCredentialTag: encrypted.tag,
  generationCredentialKeyVersion: encrypted.keyVersion,
  generationCredentialMaskedSuffix: encrypted.maskedSuffix,
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
  lifecycle,
  testResult: null,
  testedAt: null,
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
  REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS: 5000,
  REPORT_ASSISTANT_PLANNER_MAX_TOKENS: 100,
  REPORT_ASSISTANT_ANSWER_MAX_TOKENS: 100,
  REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE: 2,
  REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET: 100,
  REPORT_ASSISTANT_SIMILARITY_THRESHOLD: 0.55,
  REPORT_ASSISTANT_READ_THROUGH_LIMIT: 4,
} as const;

const createResolver = (active: StoredAiProviderRevision | null) => {
  const getControl = vi.fn().mockResolvedValue(control(active));
  const getRevision = vi.fn().mockResolvedValue(active);
  const repository = { getControl, getRevision };
  const semanticRepository: SemanticEmbeddingRepository = {
    findCachedHashes: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue(undefined),
    rank: vi.fn().mockResolvedValue([]),
  };
  const enqueuer = {
    enqueue: vi.fn().mockResolvedValue(undefined),
  } as unknown as SemanticIndexEnqueuer;
  return {
    resolver: new AiRuntimeResolver(
      repository as never,
      codec,
      semanticRepository,
      enqueuer,
      env,
    ),
    getControl,
    getRevision,
  };
};

describe("AiRuntimeResolver", () => {
  it("caches provider clients by immutable revision while rebuilding retrieval per snapshot", async () => {
    const active = revision(AiProviderLifecycle.active);
    const harness = createResolver(active);

    const first = await harness.resolver.resolveActive();
    const second = await harness.resolver.resolveActive();

    expect(first?.revisionId).toBe(active.id);
    expect(first?.model).toBe("mistral:answer-1");
    expect(first?.scope).toEqual({
      embeddingScopeIdentity: "embedding-identity",
      provider: "mistral:stable-endpoint",
      model: "embed-1",
      inputVersion: "report-assistant/v1",
      dimensions: 3,
    });
    expect(second?.planner).toBe(first?.planner);
    expect(second?.answerer).toBe(first?.answerer);
    expect(second?.semanticRetrieval).not.toBe(first?.semanticRetrieval);
    expect(harness.getControl).toHaveBeenCalledTimes(2);
  });

  it("does not resolve a disabled or non-active control and can resolve an exact retained revision", async () => {
    const retained = revision(AiProviderLifecycle.superseded);
    const disabled = createResolver(retained);

    await expect(disabled.resolver.resolveActive()).resolves.toBeNull();

    const exact = await disabled.resolver.resolveExact(retained.id);
    expect(exact.revisionId).toBe(retained.id);
    expect(disabled.getRevision).toHaveBeenCalledWith(retained.id);
  });

  it("does not reuse embedding-only clients for the active assistant", async () => {
    const active = revision(AiProviderLifecycle.active);
    const harness = createResolver(active);

    const exact = await harness.resolver.resolveExact(active.id);
    const assistant = await harness.resolver.resolveActive();

    expect(assistant?.planner).not.toBe(exact.planner);
    expect(assistant?.answerer).not.toBe(exact.answerer);
  });

  it("fails exact worker resolution when the revision no longer exists", async () => {
    const harness = createResolver(null);

    await expect(
      harness.resolver.resolveExact("missing"),
    ).rejects.toBeInstanceOf(AiRuntimeNotConfiguredError);
  });

  it("keeps exact embedding workers independent from answer protocol state", async () => {
    const retained = {
      ...revision(AiProviderLifecycle.superseded),
      answerProtocol: null,
    };
    const harness = createResolver(retained);

    const exact = await harness.resolver.resolveExact(retained.id);

    expect(exact.answerProtocol).toBe("json_object");
    expect(exact.embeddings).toBeDefined();
    expect(exact.planner).toBeDefined();
  });

  it("uses and caches code-owned prompts without stored prompt state", async () => {
    const active = revision(AiProviderLifecycle.active);
    const prompts = baselineReportAssistantPrompts();
    const resolveReportAssistant = vi.fn();
    const configurationRepository = { resolveReportAssistant };
    const resolver = new AiRuntimeResolver(
      {
        getControl: vi.fn().mockResolvedValue({
          enabled: true,
          activeConfiguration: active,
        }),
        getRevision: vi.fn(),
      } as never,
      codec,
      {
        findCachedHashes: vi.fn().mockResolvedValue([]),
        upsert: vi.fn().mockResolvedValue(undefined),
        rank: vi.fn().mockResolvedValue([]),
      },
      { enqueue: vi.fn().mockResolvedValue(undefined) },
      env,
      configurationRepository,
    );

    const first = await resolver.resolveActive();
    const second = await resolver.resolveActive();
    expect(first?.promptRevisionId).toBeNull();
    expect(first?.prompts).toEqual(prompts);
    expect(first).toMatchObject({
      reasoningMode: "provider_default",
      reasoningCustomValue: null,
      answerProtocol: "json_object",
    });
    expect(second?.planner).toBe(first?.planner);

    const changed = await resolver.resolveActive();
    expect(changed?.promptRevisionId).toBeNull();
    expect(changed?.planner).toBe(first?.planner);
    expect(resolveReportAssistant).not.toHaveBeenCalled();
  });
});
