import { describe, expect, it } from "vitest";

import {
  builtInProviderEndpoints,
  embeddingScopeChanged,
  endpointSupportsRole,
  normalizeProviderBaseUrl,
  providerEndpointIdentity,
  ProviderUrlPolicyError,
  resolveProviderProfile,
} from "./provider-profile";

const draft = {
  generation: {
    profile: "custom-openai-compatible" as const,
    baseUrl: "https://ai.example.com/v1/",
    plannerModel: "planner-1",
    answerModel: "answer-1",
    reasoningMode: "provider_default" as const,
    credential: "generation-secret",
  },
  embeddings: {
    mode: "reuse_generation" as const,
    model: "embed-1",
  },
};

describe("provider profile policy", () => {
  it("enforces role-specific profile eligibility", () => {
    expect(endpointSupportsRole("groq", "generation")).toBe(true);
    expect(endpointSupportsRole("groq", "embeddings")).toBe(false);
    expect(endpointSupportsRole("jina", "generation")).toBe(false);
    expect(endpointSupportsRole("jina", "embeddings")).toBe(true);
  });

  it("requires both fixed origins for Groq generation with Jina embeddings", () => {
    const splitDraft = {
      generation: {
        ...draft.generation,
        profile: "groq" as const,
        baseUrl: undefined,
      },
      embeddings: {
        mode: "separate" as const,
        profile: "jina" as const,
        baseUrl: undefined,
        model: "jina-embeddings-v5-text-small",
        credential: "embedding-secret",
      },
    };
    const bothOrigins = "https://api.groq.com,https://api.jina.ai";
    const resolved = resolveProviderProfile(splitDraft, bothOrigins, "1");

    expect(resolved.generation.baseUrl).toBe(builtInProviderEndpoints.groq);
    expect(resolved.embeddings.effective.baseUrl).toBe(
      builtInProviderEndpoints.jina,
    );
    expect(() =>
      resolveProviderProfile(splitDraft, "https://api.groq.com", "1"),
    ).toThrow(ProviderUrlPolicyError);
    expect(() =>
      resolveProviderProfile(splitDraft, "https://api.jina.ai", "1"),
    ).toThrow(ProviderUrlPolicyError);
  });

  it("normalizes safe URLs and derives a stable non-secret identity", () => {
    const resolved = resolveProviderProfile(
      draft,
      "https://ai.example.com,https://api.mistral.ai,https://openrouter.ai",
      "1",
    );
    expect(resolved.generation.baseUrl).toBe("https://ai.example.com/v1");
    expect(resolved.generation.endpointIdentity).toBe(
      providerEndpointIdentity(
        "custom-openai-compatible",
        resolved.generation.baseUrl,
      ),
    );
    expect(normalizeProviderBaseUrl(builtInProviderEndpoints.mistral)).toBe(
      builtInProviderEndpoints.mistral,
    );
  });

  it.each([
    ["mistral" as const, builtInProviderEndpoints.mistral],
    ["openrouter" as const, builtInProviderEndpoints.openrouter],
  ])("resolves the fixed endpoint for %s", (profile, baseUrl) => {
    const resolved = resolveProviderProfile(
      {
        ...draft,
        generation: { ...draft.generation, profile, baseUrl: undefined },
      },
      "https://api.mistral.ai,https://openrouter.ai",
      "1",
    );
    expect(resolved.generation).toMatchObject({ profile, baseUrl });
  });

  it.each([
    "https://user:pass@ai.example.com/v1",
    "https://ai.example.com/v1?target=internal",
    "https://ai.example.com/v1#fragment",
    "https://not-allowed.example.com/v1",
  ])("rejects unsafe or disallowed endpoint %s", (baseUrl) => {
    expect(() =>
      resolveProviderProfile(
        { ...draft, generation: { ...draft.generation, baseUrl } },
        "https://ai.example.com",
        "1",
      ),
    ).toThrow(ProviderUrlPolicyError);
  });

  it("does not rebuild embeddings when generation changes", () => {
    const left = resolveProviderProfile(draft, "https://ai.example.com", "1");
    const right = resolveProviderProfile(
      {
        ...draft,
        generation: {
          ...draft.generation,
          answerModel: "answer-2",
          credential: "new-secret",
        },
      },
      "https://ai.example.com",
      "1",
    );
    expect(
      embeddingScopeChanged(
        left.embeddings.effective,
        right.embeddings.effective,
      ),
    ).toBe(false);
    expect(
      embeddingScopeChanged(left.embeddings.effective, {
        ...right.embeddings.effective,
        dimensions: 4,
      }),
    ).toBe(true);
  });
});
