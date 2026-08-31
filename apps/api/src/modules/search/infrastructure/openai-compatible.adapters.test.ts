import { describe, expect, it } from "vitest";

import { baselineReportAssistantPrompts } from "../../ai-prompts/application/ai-feature-prompt-catalog.js";
import type {
  GroundedAnswerInput,
  PlannerInput,
} from "../application/report-assistant.ports.js";
import {
  OpenAiCompatibleEmbeddingAdapter,
  OpenAiCompatiblePlannerAdapter,
  reasoningRequestOptions,
} from "./openai-compatible.adapters.js";
import { OpenAiCompatibleAnswerAdapter } from "./openai-compatible.answer-adapter.js";
import {
  type OpenAiCompatibleFetch,
  OpenAiCompatibleProtocolError,
  OpenAiCompatibleTransport,
} from "./openai-compatible.transport.js";

const plannerInput: PlannerInput = {
  question: "What changed?",
  now: new Date("2026-08-10T00:00:00.000Z"),
  timeZone: "UTC",
};

const grounding: GroundedAnswerInput["grounding"] = {
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
};

const prompts = baselineReportAssistantPrompts();

const transportFor = (responses: readonly unknown[]) => {
  const bodies: unknown[] = [];
  const fetcher: OpenAiCompatibleFetch = (_input, init) => {
    const body =
      typeof init?.body === "string"
        ? init.body
        : JSON.stringify(init?.body ?? null);
    bodies.push(JSON.parse(body) as unknown);
    const response = responses[bodies.length - 1];
    return Promise.resolve(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  };
  return {
    transport: new OpenAiCompatibleTransport({
      baseUrl: "https://ai.example.com/v1",
      credential: "secret",
      timeoutMs: 1000,
      fetcher,
    }),
    bodies,
  };
};

const transportForHttp = (
  responses: readonly Readonly<{ status: number; body: unknown }>[],
) => {
  const bodies: unknown[] = [];
  const fetcher: OpenAiCompatibleFetch = (_input, init) => {
    const body = typeof init?.body === "string" ? init.body : "null";
    bodies.push(JSON.parse(body) as unknown);
    const response = responses[bodies.length - 1];
    return Promise.resolve(
      new Response(JSON.stringify(response?.body ?? null), {
        status: response?.status ?? 500,
        headers: { "content-type": "application/json" },
      }),
    );
  };
  return {
    transport: new OpenAiCompatibleTransport({
      baseUrl: "https://ai.example.com/v1",
      credential: "secret",
      timeoutMs: 1000,
      fetcher,
    }),
    bodies,
  };
};

describe("OpenAI-compatible report assistant adapters", () => {
  it("maps provider reasoning without arbitrary request fields", () => {
    expect(
      reasoningRequestOptions({
        profile: "mistral",
        mode: "provider_default",
        customValue: null,
      }),
    ).toEqual({});
    expect(
      reasoningRequestOptions({
        profile: "openrouter",
        mode: "off",
        customValue: null,
      }),
    ).toEqual({ reasoning: { effort: "none" } });
    expect(
      reasoningRequestOptions({
        profile: "custom-openai-compatible",
        mode: "custom",
        customValue: "deep",
      }),
    ).toEqual({ reasoningEffort: "deep" });
    expect(
      reasoningRequestOptions({
        profile: "mistral",
        mode: "off",
        customValue: null,
      }),
    ).toEqual({ reasoningEffort: "none" });
  });

  it("forces exactly one search tool and disables parallel tool calls", async () => {
    const harness = transportFor([
      {
        choices: [
          {
            message: {
              tool_calls: [
                {
                  function: {
                    name: "search_report_entries",
                    arguments: "{}",
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      },
    ]);
    const planner = new OpenAiCompatiblePlannerAdapter(harness.transport, {
      model: "planner",
      maxTokens: 100,
      prompts,
    });

    await expect(planner.plan(plannerInput)).resolves.toEqual({});
    const body = harness.bodies[0] as {
      tools: readonly { function?: { name?: string; strict?: boolean } }[];
      tool_choice: { function: { name: string } };
      parallel_tool_calls: boolean;
    };
    expect(body.tools).toHaveLength(1);
    expect(body.tools[0]?.function).toMatchObject({
      name: "search_report_entries",
    });
    expect(body.tools[0]?.function).not.toHaveProperty("strict");
    expect(body.tool_choice).toEqual({
      type: "function",
      function: { name: "search_report_entries" },
    });
    expect(body.parallel_tool_calls).toBe(false);
  });

  it("stops after one same-protocol retry when tool generation stays invalid", async () => {
    const toolFailure = {
      status: 400,
      body: { error: { code: "tool_use_failed" } },
    };
    const harness = transportForHttp([toolFailure, toolFailure, toolFailure]);
    const planner = new OpenAiCompatiblePlannerAdapter(harness.transport, {
      model: "planner",
      maxTokens: 100,
      prompts,
    });

    await expect(planner.plan(plannerInput)).rejects.toMatchObject({
      providerCode: "tool_use_failed",
    });
    expect(harness.bodies).toHaveLength(2);
    expect(harness.bodies[1]).toMatchObject({ temperature: 0.2 });
    expect(harness.bodies).toSatisfy((bodies: unknown[]) =>
      bodies.every(
        (body) => !(body as Record<string, unknown>).response_format,
      ),
    );
  });

  it("requires strict structured answers and normalizes usage", async () => {
    const harness = transportFor([
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                answerMarkdown: "Answer",
                citedSourceIds: ["S1"],
                insufficientEvidence: false,
              }),
            },
          },
        ],
        usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
      },
    ]);
    const answerer = new OpenAiCompatibleAnswerAdapter(harness.transport, {
      model: "answer",
      maxTokens: 100,
      prompts,
    });

    await expect(
      answerer.answer({ question: "Question", grounding }),
    ).resolves.toMatchObject({
      answerMarkdown: "Answer",
      sourceIds: ["S1"],
      usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 },
    });
    expect(harness.bodies[0]).toMatchObject({
      response_format: {
        type: "json_object",
      },
    });
  });

  it("preserves provider embedding ordering across bounded batches", async () => {
    const harness = transportFor([
      {
        data: [
          { index: 1, embedding: [0, 1] },
          { index: 0, embedding: [1, 0] },
        ],
      },
      { data: [{ index: 0, embedding: [1, 1] }] },
    ]);
    const embeddings = new OpenAiCompatibleEmbeddingAdapter(harness.transport, {
      model: "embed",
      dimensions: 2,
      batchSize: 2,
      tokenBudget: 100,
    });

    await expect(
      embeddings.embedDocuments([
        { contentHash: "a", text: "first" },
        { contentHash: "b", text: "second" },
        { contentHash: "c", text: "third" },
      ]),
    ).resolves.toEqual([
      { contentHash: "a", vector: [1, 0] },
      { contentHash: "b", vector: [0, 1] },
      { contentHash: "c", vector: [1, 1] },
    ]);
    expect(harness.bodies).toHaveLength(2);
  });

  it("rejects unsupported planner tool responses and invalid vectors", async () => {
    const plannerHarness = transportFor([
      {
        choices: [{ message: { tool_calls: [] } }],
      },
    ]);
    const planner = new OpenAiCompatiblePlannerAdapter(
      plannerHarness.transport,
      {
        model: "planner",
        maxTokens: 100,
        prompts,
      },
    );
    await expect(planner.plan(plannerInput)).rejects.toBeInstanceOf(
      OpenAiCompatibleProtocolError,
    );

    const embeddingHarness = transportFor([
      { data: [{ index: 0, embedding: [Number.NaN, 1] }] },
    ]);
    const embeddings = new OpenAiCompatibleEmbeddingAdapter(
      embeddingHarness.transport,
      { model: "embed", dimensions: 2, batchSize: 1, tokenBudget: 100 },
    );
    await expect(
      embeddings.embedDocuments([{ contentHash: "a", text: "first" }]),
    ).rejects.toBeInstanceOf(OpenAiCompatibleProtocolError);
  });
});
