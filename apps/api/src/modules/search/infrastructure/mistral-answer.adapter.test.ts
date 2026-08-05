import { describe, expect, it, vi } from "vitest";

import {
  MistralAnswerAdapter,
  type MistralAnswerAdapterConfig,
} from "./mistral-answer.adapter.js";
import type { MistralStructuredChatClient } from "./mistral-planner.adapter.js";
import {
  MistralProtocolError,
  MistralProviderError,
} from "./mistral-planner.adapter.js";

const config: MistralAnswerAdapterConfig = {
  apiKey: "test-only-placeholder",
  server: "eu",
  providerTimeoutMs: 5000,
  model: "mistral-medium-3-5",
  maxTokens: 512,
};

const input = {
  question: "What changed?",
  grounding: {
    aggregates: {
      totalCount: 0,
      byKind: [],
      byPeriod: [],
      byAuthor: [],
      groups: [],
      supportingStatusFacts: [],
    },
    evidence: [],
    truncated: false,
    estimatedTokens: 0,
  },
} as const;

const fakeClient = (parsed: unknown) => {
  const parse = vi
    .fn<MistralStructuredChatClient["parse"]>()
    .mockResolvedValue({
      choices: [{ message: { parsed } }],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
  return { client: { parse } satisfies MistralStructuredChatClient, parse };
};

describe("MistralAnswerAdapter", () => {
  it("uses Custom Structured Outputs and captures provider usage", async () => {
    const { client, parse } = fakeClient({
      answerMarkdown: "The answer [S1]",
      citedSourceIds: ["S1"],
      insufficientEvidence: false,
    });
    const adapter = new MistralAnswerAdapter(client, config);

    await expect(adapter.answer(input)).resolves.toEqual({
      answerMarkdown: "The answer [S1]",
      sourceIds: ["S1"],
      insufficientEvidence: false,
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });
    const request = parse.mock.calls[0]?.[0];
    expect(request?.model).toBe(config.model);
    expect(request?.responseFormat).toBeDefined();
    expect(parse.mock.calls[0]?.[1]).toEqual({ timeoutMs: 5000 });
  });

  it("uses the citation-repair prompt and fails closed on invalid structured output", async () => {
    const { client, parse } = fakeClient({
      answerMarkdown: "Repaired [S1]",
      citedSourceIds: ["S1"],
      insufficientEvidence: false,
    });
    const adapter = new MistralAnswerAdapter(client, config);

    await expect(
      adapter.repairAnswer({
        original: input,
        previousAnswer: {
          answerMarkdown: "Broken [S9]",
          sourceIds: ["S9"],
          insufficientEvidence: false,
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        },
        allowedSourceIds: ["S1"],
        issues: ["unknown_source"],
      }),
    ).resolves.toMatchObject({ sourceIds: ["S1"] });
    expect(parse.mock.calls[0]?.[0]?.messages[1]?.content).toContain(
      "Broken [S9]",
    );

    const malformed = fakeClient({ answerMarkdown: "missing fields" });
    await expect(
      new MistralAnswerAdapter(malformed.client, config).answer(input),
    ).rejects.toBeInstanceOf(MistralProtocolError);

    const failing: MistralStructuredChatClient = {
      parse: vi.fn().mockRejectedValue(new Error("network")),
    };
    await expect(
      new MistralAnswerAdapter(failing, config).answer(input),
    ).rejects.toBeInstanceOf(MistralProviderError);
  });
});
