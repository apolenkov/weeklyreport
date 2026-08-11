import { describe, expect, it } from "vitest";

import {
  aiProviderAvailabilityReadSchema,
  aiProviderConfigurationReadSchema,
  aiProviderControlReadSchema,
  aiProviderDraftSchema,
  aiProviderPreparationProgressSchema,
} from "./ai-provider-configuration";

const draft = {
  profile: "custom-openai-compatible" as const,
  baseUrl: "https://ai.example.com/v1",
  plannerModel: "planner-1",
  answerModel: "answer-1",
  embeddingModel: "embed-1",
  credential: "secret-value",
};

describe("ai provider contracts", () => {
  it("rejects unknown draft fields and incomplete custom endpoints", () => {
    expect(
      aiProviderDraftSchema.safeParse({ ...draft, extra: true }).success,
    ).toBe(false);
    expect(
      aiProviderDraftSchema.safeParse({ ...draft, embeddingDimensions: 3 })
        .success,
    ).toBe(false);
    expect(
      aiProviderDraftSchema.safeParse({ ...draft, baseUrl: undefined }).success,
    ).toBe(false);
  });

  it("rejects custom endpoints on built-in profiles", () => {
    expect(
      aiProviderDraftSchema.safeParse({
        ...draft,
        profile: "mistral",
      }).success,
    ).toBe(false);
  });

  it("accepts a masked read without accepting secret fields", () => {
    const result = aiProviderConfigurationReadSchema.safeParse({
      id: "659b2767-0f86-41e2-b025-49730ca010e4",
      profile: "mistral",
      lifecycle: "active",
      baseUrl: "https://api.mistral.ai/v1",
      plannerModel: "planner-1",
      answerModel: "answer-1",
      embeddingModel: "embed-1",
      embeddingDimensions: 3,
      semanticInputVersion: "1",
      credentialConfigured: true,
      credentialMaskedSuffix: "••••alue",
      testResult: null,
      progress: { completed: 0, total: 0, failed: 0, elapsedMs: 0 },
      createdAt: "2026-08-10T00:00:00.000Z",
      updatedAt: "2026-08-10T00:00:00.000Z",
      activatedAt: null,
      ciphertext: "must-not-be-returned",
    }).success;
    expect(result).toBe(false);
  });

  it("bounds preparation progress", () => {
    expect(
      aiProviderPreparationProgressSchema.safeParse({
        revisionId: "659b2767-0f86-41e2-b025-49730ca010e4",
        completed: 4,
        total: 3,
        failed: 0,
        elapsedMs: 1,
        startedAt: null,
        finishedAt: null,
      }).success,
    ).toBe(false);
  });

  it("keeps availability intentionally metadata-free", () => {
    expect(
      aiProviderAvailabilityReadSchema.safeParse({
        availability: "not_configured",
        profile: "mistral",
      }).success,
    ).toBe(false);
  });

  it("requires an explicit revision collection on the admin control read", () => {
    expect(
      aiProviderControlReadSchema.safeParse({
        enabled: false,
        availability: "not_configured",
        activeRevisionId: null,
        active: null,
        revisions: [],
        unexpected: true,
      }).success,
    ).toBe(false);
  });
});
