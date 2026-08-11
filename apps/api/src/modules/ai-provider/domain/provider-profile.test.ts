import { describe, expect, it } from "vitest";

import {
  builtInProviderEndpoints,
  embeddingScopeChanged,
  normalizeProviderBaseUrl,
  providerEndpointIdentity,
  ProviderUrlPolicyError,
  resolveProviderProfile,
} from "./provider-profile";

const draft = {
  profile: "custom-openai-compatible" as const,
  baseUrl: "https://ai.example.com/v1/",
  plannerModel: "planner-1",
  answerModel: "answer-1",
  embeddingModel: "embed-1",
  embeddingDimensions: 3,
  credential: "secret",
};

describe("provider profile policy", () => {
  it("normalizes safe URLs and derives a stable non-secret identity", () => {
    const resolved = resolveProviderProfile(
      draft,
      "https://ai.example.com,https://api.mistral.ai,https://openrouter.ai",
      "1",
    );
    expect(resolved.baseUrl).toBe("https://ai.example.com/v1");
    expect(resolved.endpointIdentity).toBe(
      providerEndpointIdentity("custom-openai-compatible", resolved.baseUrl),
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
        profile,
        baseUrl: undefined,
      },
      "https://api.mistral.ai,https://openrouter.ai",
      "1",
    );

    expect(resolved).toMatchObject({ profile, baseUrl });
  });

  it.each([
    "https://user:pass@ai.example.com/v1",
    "https://ai.example.com/v1?target=internal",
    "https://ai.example.com/v1#fragment",
    "https://not-allowed.example.com/v1",
  ])("rejects unsafe or disallowed endpoint %s", (baseUrl) => {
    expect(() =>
      resolveProviderProfile(
        { ...draft, baseUrl },
        "https://ai.example.com",
        "1",
      ),
    ).toThrow(ProviderUrlPolicyError);
  });

  it("does not rebuild when only credential or generation model changes", () => {
    const left = resolveProviderProfile(draft, "https://ai.example.com", "1");
    const right = resolveProviderProfile(
      { ...draft, answerModel: "answer-2", credential: "new-secret" },
      "https://ai.example.com",
      "1",
    );
    expect(embeddingScopeChanged(left, right)).toBe(false);
    expect(
      embeddingScopeChanged(left, { ...right, embeddingDimensions: 4 }),
    ).toBe(true);
  });
});
