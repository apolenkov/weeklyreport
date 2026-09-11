import { describe, expect, it } from "vitest";

import {
  AI_PROVIDER_PROFILE_CAPABILITIES,
  aiProviderAvailabilityReadSchema,
  aiProviderCapabilityTestResultSchema,
  aiProviderConfigurationReadSchema,
  aiProviderControlReadSchema,
  aiProviderDiscardResultSchema,
  aiProviderDraftSchema,
  aiProviderPreparationProgressSchema,
} from "./ai-provider-configuration";

const draft = {
  generation: {
    profile: "custom-openai-compatible" as const,
    baseUrl: "https://ai.example.com/v1",
    plannerModel: "planner-1",
    answerModel: "answer-1",
    reasoningMode: "provider_default" as const,
    credential: "secret-value",
  },
  embeddings: { mode: "reuse_generation" as const, model: "embed-1" },
};

const builtInGeneration = (profile: "jina" | "groq") => {
  const { baseUrl: _baseUrl, ...generation } = draft.generation;
  return { ...generation, profile };
};

const validGroqWithJina = {
  generation: builtInGeneration("groq"),
  embeddings: {
    mode: "separate" as const,
    profile: "jina" as const,
    model: "embed-1",
  },
};

describe("ai provider contracts", () => {
  it("accepts an explicit base revision for credential retention", () => {
    expect(
      aiProviderDraftSchema.safeParse({
        ...draft,
        baseRevisionId: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(true);
  });

  it("accepts compatible composite provider pairs and credential retention intent", () => {
    expect(
      aiProviderDraftSchema.safeParse({
        generation: {
          profile: "groq",
          plannerModel: "planner-1",
          answerModel: "answer-1",
          reasoningMode: "provider_default",
        },
        embeddings: {
          mode: "separate",
          profile: "jina",
          model: "jina-embeddings-v3",
        },
      }).success,
    ).toBe(true);
    expect(
      aiProviderDraftSchema.safeParse({
        generation: {
          profile: "mistral",
          plannerModel: "planner-1",
          answerModel: "answer-1",
          reasoningMode: "off",
          credential: "secret-value",
        },
        embeddings: { mode: "reuse_generation", model: "mistral-embed" },
      }).success,
    ).toBe(true);
  });

  it("rejects role-incompatible provider pairs before provider work", () => {
    expect(aiProviderDraftSchema.safeParse(validGroqWithJina).success).toBe(
      true,
    );
    const cases = [
      {
        input: {
          ...validGroqWithJina,
          generation: {
            ...validGroqWithJina.generation,
            profile: "jina" as const,
          },
        },
        path: ["generation", "profile"],
      },
      {
        input: {
          ...validGroqWithJina,
          embeddings: {
            ...validGroqWithJina.embeddings,
            profile: "groq" as const,
          },
        },
        path: ["embeddings", "profile"],
      },
      {
        input: {
          ...validGroqWithJina,
          embeddings: {
            mode: "reuse_generation" as const,
            model: validGroqWithJina.embeddings.model,
          },
        },
        path: ["embeddings", "mode"],
      },
    ];

    cases.forEach(({ input, path }) => {
      const result = aiProviderDraftSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toContainEqual(
          expect.objectContaining({ path }),
        );
      }
    });
  });

  it("accepts only the explicit discard result", () => {
    expect(
      aiProviderDiscardResultSchema.safeParse({ discarded: true }).success,
    ).toBe(true);
    expect(
      aiProviderDiscardResultSchema.safeParse({ discarded: false }).success,
    ).toBe(false);
  });

  it("accepts only bounded provider capability results", () => {
    expect(
      aiProviderCapabilityTestResultSchema.safeParse({
        status: "passed",
        generation: {
          status: "passed",
          capabilities: [{ capability: "structured_answer", status: "passed" }],
        },
        embeddings: { status: "passed", capabilities: [] },
        testedAt: null,
      }).success,
    ).toBe(true);
    expect(
      aiProviderCapabilityTestResultSchema.safeParse({
        status: "passed",
        generation: {
          status: "passed",
          capabilities: [],
          unexpected: true,
        },
        embeddings: { status: "passed", capabilities: [] },
        testedAt: null,
      }).success,
    ).toBe(false);
  });

  it("accepts independent three-state lane results", () => {
    expect(
      aiProviderCapabilityTestResultSchema.safeParse({
        status: "inconclusive",
        generation: {
          status: "passed",
          capabilities: [
            { capability: "structured_planner", status: "passed" },
          ],
        },
        embeddings: { status: "passed", capabilities: [] },
        testedAt: null,
      }).success,
    ).toBe(true);
  });
  it("rejects unknown draft fields and incomplete custom endpoints", () => {
    expect(
      aiProviderDraftSchema.safeParse({ ...draft, extra: true }).success,
    ).toBe(false);
    expect(
      aiProviderDraftSchema.safeParse({
        ...draft,
        generation: { ...draft.generation, reasoningMode: "raw" },
      }).success,
    ).toBe(false);
    expect(
      aiProviderDraftSchema.safeParse({
        ...draft,
        generation: { ...draft.generation, reasoningMode: "custom" },
      }).success,
    ).toBe(false);
    expect(
      aiProviderDraftSchema.safeParse({
        ...draft,
        generation: {
          ...draft.generation,
          reasoningMode: "custom",
          reasoningCustomValue: " ",
        },
      }).success,
    ).toBe(false);
    expect(
      aiProviderDraftSchema.safeParse({
        ...draft,
        generation: {
          ...draft.generation,
          reasoningMode: "custom",
          reasoningCustomValue: "deep",
        },
      }).success,
    ).toBe(true);
    expect(
      aiProviderDraftSchema.safeParse({
        ...draft,
        generation: {
          ...draft.generation,
          legacyField: "must-not-be-accepted",
        },
      }).success,
    ).toBe(false);
    expect(
      aiProviderDraftSchema.safeParse({
        ...draft,
        embeddings: { ...draft.embeddings, dimensions: 3 },
      }).success,
    ).toBe(false);
    expect(
      aiProviderDraftSchema.safeParse({
        ...draft,
        generation: { ...draft.generation, baseUrl: undefined },
      }).success,
    ).toBe(false);
  });

  it("rejects custom endpoints on built-in profiles", () => {
    expect(
      aiProviderDraftSchema.safeParse({
        ...draft,
        generation: { ...draft.generation, profile: "mistral" },
      }).success,
    ).toBe(false);
  });

  it("accepts a masked read without accepting secret fields", () => {
    const result = aiProviderConfigurationReadSchema.safeParse({
      id: "659b2767-0f86-41e2-b025-49730ca010e4",
      lifecycle: "active",
      generation: {
        profile: "mistral",
        baseUrl: "https://api.mistral.ai/v1",
        plannerModel: "planner-1",
        answerModel: "answer-1",
        reasoningMode: "provider_default",
        reasoningCustomValue: null,
        credentialConfigured: true,
        credentialMaskedSuffix: "••••alue",
      },
      embeddings: {
        mode: "reuse_generation",
        model: "embed-1",
        dimensions: 3,
      },
      generationCompatibilityIdentity: "generation:v1:test",
      semanticInputVersion: "1",
      testResult: null,
      progress: { completed: 0, total: 0, failed: 0, elapsedMs: 0 },
      createdAt: "2026-08-10T00:00:00.000Z",
      updatedAt: "2026-08-10T00:00:00.000Z",
      activatedAt: null,
      ciphertext: "must-not-be-returned",
    }).success;
    expect(result).toBe(false);
  });

  it("accepts a separately masked embedding read", () => {
    expect(
      aiProviderConfigurationReadSchema.safeParse({
        id: "659b2767-0f86-41e2-b025-49730ca010e4",
        lifecycle: "draft",
        generation: {
          profile: "groq",
          baseUrl: "https://api.groq.com/openai/v1",
          plannerModel: "planner-1",
          answerModel: "answer-1",
          reasoningMode: "off",
          reasoningCustomValue: null,
          credentialConfigured: true,
          credentialMaskedSuffix: "••••gkey",
        },
        embeddings: {
          mode: "separate",
          profile: "jina",
          baseUrl: "https://api.jina.ai/v1",
          model: "jina-embeddings-v3",
          dimensions: null,
          credentialConfigured: true,
          credentialMaskedSuffix: "••••jkey",
        },
        generationCompatibilityIdentity: "generation:v1:test",
        semanticInputVersion: "1",
        testResult: null,
        progress: { completed: 0, total: 0, failed: 0, elapsedMs: 0 },
        createdAt: "2026-08-10T00:00:00.000Z",
        updatedAt: "2026-08-10T00:00:00.000Z",
        activatedAt: null,
      }).success,
    ).toBe(true);
  });

  it("accepts the fixed short-secret mask and rejects unsafe mask metadata", () => {
    const activeRead = {
      id: "659b2767-0f86-41e2-b025-49730ca010e4",
      lifecycle: "active",
      generation: {
        profile: "mistral",
        baseUrl: "https://api.mistral.ai/v1",
        plannerModel: "planner-1",
        answerModel: "answer-1",
        reasoningMode: "provider_default",
        reasoningCustomValue: null,
        credentialConfigured: true,
        credentialMaskedSuffix: "••••",
      },
      embeddings: {
        mode: "reuse_generation",
        model: "embed-1",
        dimensions: 3,
      },
      generationCompatibilityIdentity: "generation:v1:test",
      semanticInputVersion: "1",
      testResult: null,
      progress: { completed: 0, total: 0, failed: 0, elapsedMs: 0 },
      createdAt: "2026-08-10T00:00:00.000Z",
      updatedAt: "2026-08-10T00:00:00.000Z",
      activatedAt: "2026-08-10T00:00:00.000Z",
    };

    expect(
      aiProviderConfigurationReadSchema.safeParse(activeRead).success,
    ).toBe(true);
    expect(
      aiProviderConfigurationReadSchema.safeParse({
        ...activeRead,
        generation: {
          ...activeRead.generation,
          credentialMaskedSuffix: "abc",
        },
      }).success,
    ).toBe(false);
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
    const baseline = {
      enabled: false,
      availability: "not_configured" as const,
      activeRevisionId: null,
      profileCapabilities: AI_PROVIDER_PROFILE_CAPABILITIES,
      active: null,
      revisions: [],
    };
    expect(aiProviderControlReadSchema.safeParse(baseline).success).toBe(true);

    const { revisions: _revisions, ...withoutRevisions } = baseline;
    const result = aiProviderControlReadSchema.safeParse(withoutRevisions);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(
        expect.objectContaining({ path: ["revisions"] }),
      );
    }
  });

  it("rejects unknown fields on the admin control read", () => {
    expect(
      aiProviderControlReadSchema.safeParse({
        enabled: false,
        availability: "not_configured",
        activeRevisionId: null,
        profileCapabilities: AI_PROVIDER_PROFILE_CAPABILITIES,
        active: null,
        revisions: [],
        unexpected: true,
      }).success,
    ).toBe(false);
  });
});
