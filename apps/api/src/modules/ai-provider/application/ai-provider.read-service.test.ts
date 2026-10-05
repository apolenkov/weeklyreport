import {
  AiProviderLifecycle,
  AiProviderProfile,
  AiProviderReasoningMode,
} from "@prisma/client";
import { describe, expect, it } from "vitest";

import type {
  StoredAiProviderControl,
  StoredAiProviderRevision,
} from "../infrastructure/ai-provider.repository.js";
import { AesGcmCredentialCodec } from "../infrastructure/credential-codec.js";
import { AiProviderConfigurationService } from "./ai-provider.service.js";

const codec = new AesGcmCredentialCodec("a".repeat(64), 1);
const now = new Date("2026-08-10T00:00:00.000Z");

const storedRevision = (
  id: string,
  lifecycle: AiProviderLifecycle,
  preparationFinishedAt: Date | null = null,
): StoredAiProviderRevision => ({
  id,
  generationProfile: AiProviderProfile.mistral,
  generationBaseUrl: "https://api.mistral.ai/v1",
  generationEndpointIdentity: "mistral:api",
  plannerModel: "planner",
  answerModel: "answer",
  reasoningMode: AiProviderReasoningMode.provider_default,
  reasoningCustomValue: null,
  generationCredentialCiphertext: "ciphertext-secret",
  generationCredentialNonce: "nonce-secret",
  generationCredentialTag: "tag-secret",
  generationCredentialKeyVersion: 1,
  generationCredentialMaskedSuffix: "••••cret",
  embeddingMode: "reuse_generation",
  embeddingProfile: null,
  embeddingBaseUrl: null,
  embeddingEndpointIdentity: null,
  embeddingModel: "embed",
  embeddingDimensions: 1024,
  embeddingCredentialCiphertext: null,
  embeddingCredentialNonce: null,
  embeddingCredentialTag: null,
  embeddingCredentialKeyVersion: null,
  embeddingCredentialMaskedSuffix: null,
  semanticInputVersion: "report-assistant/v1",
  generationCompatibilityIdentity: "generation-identity",
  embeddingScopeIdentity: "embedding-identity",
  compositeTestIdentity: "composite-identity",
  lifecycle,
  testResult: null,
  latestExecution: null,
  testedAt: null,
  preparationCompleted: 0,
  preparationTotal: 0,
  preparationFailed: 0,
  preparationStartedAt: null,
  preparationFinishedAt,
  preparationElapsedMs: 0,
  preparationSourceFingerprint: null,
  preparationSourceGeneration: null,
  activatedAt: null,
  supersededAt: null,
  createdAt: now,
  updatedAt: now,
});

const control = (): StoredAiProviderControl => {
  const active = storedRevision(
    "11111111-1111-4111-8111-111111111111",
    AiProviderLifecycle.active,
    now,
  );
  const historical = storedRevision(
    "22222222-2222-4222-8222-222222222222",
    AiProviderLifecycle.superseded,
  );
  return {
    id: "singleton",
    activeConfigurationId: active.id,
    enabled: true,
    createdAt: now,
    updatedAt: now,
    activeConfiguration: active,
    revisions: [active, historical],
  };
};

describe("AiProviderConfigurationService read boundary", () => {
  it("omits encrypted credential material from active and retained revisions", async () => {
    const repository = {
      getControl: () => Promise.resolve(control()),
    };
    const service = new AiProviderConfigurationService(
      repository as never,
      codec,
      {
        AI_PROVIDER_ALLOWED_ORIGINS: "https://api.mistral.ai",
        REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED: true,
        REPORT_ASSISTANT_INPUT_VERSION: "report-assistant/v1",
      },
    );

    const result = await service.read();
    const serialized = JSON.stringify(result);

    expect(result.active?.generation).toEqual({
      profile: "mistral",
      baseUrl: "https://api.mistral.ai/v1",
      plannerModel: "planner",
      answerModel: "answer",
      reasoningMode: "provider_default",
      reasoningCustomValue: null,
      credentialConfigured: true,
      credentialMaskedSuffix: "••••cret",
    });
    expect(result.revisions).toHaveLength(2);
    expect(result.active?.progress.finishedAt).toEqual(now);
    expect(result.revisions[1]?.progress.finishedAt).toBeNull();
    expect(serialized).not.toContain("ciphertext-secret");
    expect(serialized).not.toContain("nonce-secret");
    expect(serialized).not.toContain("tag-secret");
    expect(serialized).not.toContain("generationCredential");
    expect(serialized).not.toContain("embeddingCredential");
  });

  describe("runtime failure", () => {
    const failure = {
      outcome: "provider_response_incomplete" as const,
      occurredAt: "2026-08-10T01:00:00.000Z",
    };
    const readWith = (activatedAt: Date | null, lastFailure: unknown) => {
      const base = control();
      const stored = {
        ...base,
        activeConfiguration: base.activeConfiguration && {
          ...base.activeConfiguration,
          activatedAt,
        },
      };
      return new AiProviderConfigurationService(
        { getControl: () => Promise.resolve(stored) } as never,
        codec,
        {
          AI_PROVIDER_ALLOWED_ORIGINS: "https://api.mistral.ai",
          REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED: true,
          REPORT_ASSISTANT_INPUT_VERSION: "report-assistant/v1",
        },
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          lastFailure: () => Promise.resolve(lastFailure),
          recordFailure: () => Promise.resolve(),
          recordSuccess: () => Promise.resolve(),
        } as never,
      ).read();
    };

    it("exposes a failure recorded after the active revision was activated", async () => {
      const result = await readWith(now, failure);
      expect(result.runtimeFailure).toEqual(failure);
    });

    it("hides a failure that predates the current activation", async () => {
      const result = await readWith(
        new Date("2026-08-10T02:00:00.000Z"),
        failure,
      );
      expect(result.runtimeFailure).toBeNull();
    });

    it("reports no failure when none is stored", async () => {
      const result = await readWith(now, null);
      expect(result.runtimeFailure).toBeNull();
    });
  });
});
