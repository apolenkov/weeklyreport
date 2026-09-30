import { searchPlanSchema } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import type { ResolvedCompositeProviderProfile } from "../../ai-provider/index.js";
import { OpenAiCompatibleCapabilityTester } from "./openai-compatible.capability-tester.js";
import type { OpenAiCompatibleFetch } from "./openai-compatible.transport.js";

type CapabilityResult = Readonly<{
  status: string;
  generation: Readonly<{
    status: string;
    capabilities: readonly Readonly<{ capability: string; status: string }>[];
  }>;
  embeddings: Readonly<{
    status: string;
    capabilities: readonly Readonly<{ capability: string; status: string }>[];
  }>;
}>;

const profile: ResolvedCompositeProviderProfile = {
  generation: {
    profile: "custom-openai-compatible",
    baseUrl: "https://approved.example.com/v1",
    endpointIdentity: "custom:approved",
    plannerModel: "planner",
    answerModel: "answer",
    reasoningMode: "provider_default",
    reasoningCustomValue: null,
  },
  embeddings: {
    mode: "reuse_generation",
    effective: {
      profile: "custom-openai-compatible",
      baseUrl: "https://approved.example.com/v1",
      endpointIdentity: "custom:approved",
      model: "embed",
      dimensions: 3,
      semanticInputVersion: "report-assistant/v1",
    },
  },
};

const passingResponses: readonly unknown[] = [
  {
    choices: [
      {
        message: {
          tool_calls: [
            {
              function: { name: "search_report_entries", arguments: "{}" },
            },
          ],
        },
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  },
  {
    choices: [
      {
        message: {
          content: JSON.stringify({
            answerMarkdown: "Synthetic answer",
            citedSourceIds: [],
            insufficientEvidence: false,
          }),
        },
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  },
  {
    data: [
      { index: 1, embedding: [0, 1, 0] },
      { index: 0, embedding: [1, 0, 0] },
    ],
    usage: { total_tokens: 2 },
  },
];

const fetcherFor =
  (
    responses: readonly unknown[],
    bodies: unknown[],
    headers: Headers[],
  ): OpenAiCompatibleFetch =>
  (_input, init) => {
    const body =
      typeof init?.body === "string"
        ? init.body
        : JSON.stringify(init?.body ?? null);
    bodies.push(JSON.parse(body) as unknown);
    headers.push(new Headers(init?.headers));
    const responseBody = responses[bodies.length - 1];
    return Promise.resolve(
      new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  };

const responseFetcherFor =
  (
    responses: readonly Readonly<{ status: number; body: unknown }>[],
    bodies: unknown[],
  ): OpenAiCompatibleFetch =>
  (_input, init) => {
    const body =
      typeof init?.body === "string"
        ? init.body
        : JSON.stringify(init?.body ?? null);
    bodies.push(JSON.parse(body) as unknown);
    const response = responses[bodies.length - 1];
    if (!response) throw new Error("missing synthetic response");
    return Promise.resolve(
      new Response(JSON.stringify(response.body), {
        status: response.status,
        headers: { "content-type": "application/json" },
      }),
    );
  };

describe("OpenAiCompatibleCapabilityTester", () => {
  it("probes only synthetic planner, answer, and embedding contracts", async () => {
    const bodies: unknown[] = [];
    const headers: Headers[] = [];
    const tester = new OpenAiCompatibleCapabilityTester(
      {
        timeoutMs: 1000,
        plannerMaxTokens: 100,
        answerMaxTokens: 100,
        embeddingBatchSize: 2,
        embeddingTokenBudget: 100,
      },
      fetcherFor(passingResponses, bodies, headers),
    );
    const result = await tester.test(profile, {
      generation: "secret-provider-key",
      embeddings: "secret-provider-key",
    });
    const capabilityResult = result.result as unknown as CapabilityResult;

    expect(capabilityResult.status).toBe("passed");
    expect(capabilityResult.generation.capabilities).toEqual(
      expect.arrayContaining([
        { capability: "authentication", status: "passed" },
        { capability: "structured_planner", status: "passed" },
        { capability: "structured_answer", status: "passed" },
        { capability: "token_usage", status: "passed" },
      ]),
    );
    expect(capabilityResult.embeddings.capabilities).toEqual(
      expect.arrayContaining([
        { capability: "authentication", status: "passed" },
        { capability: "batch_embeddings", status: "passed" },
        { capability: "token_usage", status: "passed" },
      ]),
    );
    expect(bodies).toHaveLength(3);
    expect(bodies[2]).toEqual({
      model: "embed",
      input: ["Synthetic document A", "Synthetic document B"],
    });
    expect(result.embeddingDimensions).toBe(3);
    expect(JSON.stringify(bodies)).not.toContain("secret-provider-key");
    expect(JSON.stringify(bodies)).toContain("Synthetic");
    expect(
      headers.every(
        (value) => value.get("authorization") === "Bearer secret-provider-key",
      ),
    ).toBe(true);
  });

  it("rejects embeddings that omit required token usage", async () => {
    const bodies: unknown[] = [];
    const tester = new OpenAiCompatibleCapabilityTester(
      {
        timeoutMs: 1000,
        plannerMaxTokens: 100,
        answerMaxTokens: 100,
        embeddingBatchSize: 2,
        embeddingTokenBudget: 100,
      },
      fetcherFor(
        [
          passingResponses[0],
          passingResponses[1],
          {
            data: [
              { index: 0, embedding: [1, 0, 0] },
              { index: 1, embedding: [0, 1, 0] },
            ],
          },
        ],
        bodies,
        [],
      ),
    );

    const result = await tester.test(profile, {
      generation: "secret-provider-key",
      embeddings: "secret-provider-key",
    });

    expect(result.embeddingDimensions).toBeNull();
    expect(result.result).toMatchObject({
      status: "failed",
      embeddings: {
        status: "failed",
        capabilities: [
          {
            capability: "token_usage",
            status: "failed",
            failureCode: "OpenAiCompatibleProtocolError",
          },
        ],
      },
    });
  });

  it("accepts a valid search plan and rejects an incompatible planner shape", async () => {
    const validPlan = searchPlanSchema.parse({
      retrieval: { mode: "structured" },
    });
    const makeResult = async (plannerArguments: unknown) => {
      const bodies: unknown[] = [];
      const tester = new OpenAiCompatibleCapabilityTester(
        {
          timeoutMs: 1000,
          plannerMaxTokens: 100,
          answerMaxTokens: 100,
          embeddingBatchSize: 2,
          embeddingTokenBudget: 100,
        },
        fetcherFor(
          [
            {
              choices: [
                {
                  message: {
                    tool_calls: [
                      {
                        function: {
                          name: "search_report_entries",
                          arguments: JSON.stringify(plannerArguments),
                        },
                      },
                    ],
                  },
                },
              ],
              usage: {
                prompt_tokens: 1,
                completion_tokens: 1,
                total_tokens: 2,
              },
            },
            passingResponses[1],
            passingResponses[2],
          ],
          bodies,
          [],
        ),
      );
      return tester.test(profile, {
        generation: "secret-provider-key",
        embeddings: "secret-provider-key",
      });
    };

    await expect(makeResult({})).resolves.toMatchObject({
      result: expect.objectContaining({
        status: "passed",
        generation: expect.objectContaining({
          status: "passed",
        }) as unknown as Record<string, unknown>,
      }) as unknown as Record<string, unknown>,
    });
    await expect(makeResult(validPlan)).resolves.toMatchObject({
      result: expect.objectContaining({
        status: "passed",
        generation: expect.objectContaining({
          status: "passed",
        }) as unknown as Record<string, unknown>,
      }) as unknown as Record<string, unknown>,
    });
    await expect(makeResult({ unexpected: true })).resolves.toMatchObject({
      result: expect.objectContaining({
        generation: expect.objectContaining({
          status: "failed",
        }) as unknown as Record<string, unknown>,
      }) as unknown as Record<string, unknown>,
    });
  });

  it("applies the exact reasoning configuration to planner and answer probes", async () => {
    const bodies: unknown[] = [];
    const headers: Headers[] = [];
    const tester = new OpenAiCompatibleCapabilityTester(
      {
        timeoutMs: 1000,
        plannerMaxTokens: 100,
        answerMaxTokens: 100,
        embeddingBatchSize: 2,
        embeddingTokenBudget: 100,
      },
      fetcherFor(passingResponses, bodies, headers),
    );

    await tester.test(
      {
        ...profile,
        generation: { ...profile.generation, profile: "openrouter" },
      },
      { generation: "secret-provider-key", embeddings: "secret-provider-key" },
      {
        reasoningMode: "custom",
        reasoningCustomValue: "high",
      },
    );

    expect(bodies[0]).toMatchObject({ reasoning: { effort: "high" } });
    expect(bodies[1]).toMatchObject({ reasoning: { effort: "high" } });
  });

  it("keeps separate generation and embedding connections in their own lanes", async () => {
    const requests: {
      url: string;
      authorization: string | null;
    }[] = [];
    const composite: ResolvedCompositeProviderProfile = {
      generation: {
        profile: "groq",
        baseUrl: "https://api.groq.com/openai/v1",
        endpointIdentity: "groq:approved",
        plannerModel: "planner",
        answerModel: "answer",
        reasoningMode: "provider_default",
        reasoningCustomValue: null,
      },
      embeddings: {
        mode: "separate",
        connection: {
          profile: "jina",
          baseUrl: "https://api.jina.ai/v1",
          endpointIdentity: "jina:approved",
        },
        effective: {
          profile: "jina",
          baseUrl: "https://api.jina.ai/v1",
          endpointIdentity: "jina:approved",
          model: "jina-embeddings-v3",
          dimensions: null,
          semanticInputVersion: "report-assistant/v1",
        },
      },
    };
    const tester = new OpenAiCompatibleCapabilityTester(
      {
        timeoutMs: 1000,
        plannerMaxTokens: 100,
        answerMaxTokens: 100,
        embeddingBatchSize: 2,
        embeddingTokenBudget: 100,
      },
      (input, init) => {
        requests.push({
          url: input,
          authorization: new Headers(init?.headers).get("authorization"),
        });
        const body = passingResponses[requests.length - 1];
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
        );
      },
    );

    const result = await tester.test(composite, {
      generation: "generation-secret",
      embeddings: "embedding-secret",
    });

    expect(result.result).toMatchObject({ status: "passed" });
    expect(requests.map(({ url }) => url)).toEqual([
      "https://api.groq.com/openai/v1/chat/completions",
      "https://api.groq.com/openai/v1/chat/completions",
      "https://api.jina.ai/v1/embeddings",
    ]);
    expect(requests.map(({ authorization }) => authorization)).toEqual([
      "Bearer generation-secret",
      "Bearer generation-secret",
      "Bearer embedding-secret",
    ]);
  });

  it("fails the answer capability when fixed JSON mode is rejected", async () => {
    const bodies: unknown[] = [];
    const tester = new OpenAiCompatibleCapabilityTester(
      {
        timeoutMs: 1000,
        plannerMaxTokens: 100,
        answerMaxTokens: 100,
        embeddingBatchSize: 2,
        embeddingTokenBudget: 100,
      },
      responseFetcherFor(
        [
          { status: 200, body: passingResponses[0] },
          {
            status: 400,
            body: { error: { code: "response_format_not_supported" } },
          },
          { status: 200, body: passingResponses[2] },
        ],
        bodies,
      ),
    );

    const result = await tester.test(profile, {
      generation: "secret-provider-key",
      embeddings: "secret-provider-key",
    });
    const capabilityResult = result.result as unknown as CapabilityResult;
    expect(capabilityResult.generation.status).toBe("failed");
    expect(capabilityResult.embeddings.status).toBe("passed");
    expect(bodies).toHaveLength(3);
    expect(bodies[1]).toMatchObject({
      response_format: { type: "json_object" },
    });
  });

  it("does not negotiate after an authentication failure", async () => {
    const bodies: unknown[] = [];
    const tester = new OpenAiCompatibleCapabilityTester(
      {
        timeoutMs: 1000,
        plannerMaxTokens: 100,
        answerMaxTokens: 100,
        embeddingBatchSize: 2,
        embeddingTokenBudget: 100,
      },
      responseFetcherFor(
        [
          { status: 200, body: passingResponses[0] },
          { status: 401, body: { error: { code: "invalid_api_key" } } },
          { status: 200, body: passingResponses[2] },
        ],
        bodies,
      ),
    );

    const result = await tester.test(profile, {
      generation: "secret-provider-key",
      embeddings: "secret-provider-key",
    });
    const capabilityResult = result.result as unknown as CapabilityResult;
    expect(capabilityResult.status).toBe("failed");
    expect(capabilityResult.generation.status).toBe("failed");
    expect(capabilityResult.generation.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          capability: "structured_answer",
          status: "failed",
        }),
      ]),
    );
    expect(capabilityResult.embeddings).toEqual({
      status: "failed",
      capabilities: [],
    });
    expect(bodies).toHaveLength(2);
  });

  it("stops after a planner rate limit so the worker can classify it as inconclusive", async () => {
    const bodies: unknown[] = [];
    const tester = new OpenAiCompatibleCapabilityTester(
      {
        timeoutMs: 1000,
        plannerMaxTokens: 100,
        answerMaxTokens: 100,
        embeddingBatchSize: 2,
        embeddingTokenBudget: 100,
      },
      responseFetcherFor(
        [
          {
            status: 429,
            body: { error: { code: "rate_limit_exceeded" } },
          },
          {
            status: 429,
            body: { error: { code: "rate_limit_exceeded" } },
          },
          {
            status: 429,
            body: { error: { code: "rate_limit_exceeded" } },
          },
        ],
        bodies,
      ),
    );

    const result = await tester.test(profile, {
      generation: "secret-provider-key",
      embeddings: "secret-provider-key",
    });
    expect(result.result).toMatchObject({
      status: "inconclusive",
      generation: {
        status: "inconclusive",
        capabilities: [
          {
            capability: "structured_planner",
            status: "inconclusive",
            failureCode: "rate_limit_exceeded",
          },
        ],
      },
      embeddings: { status: "inconclusive", capabilities: [] },
    });
    expect(bodies).toHaveLength(3);
  });

  it("retries invalid generated tool calls with deterministic sampling", async () => {
    const bodies: unknown[] = [];
    const tester = new OpenAiCompatibleCapabilityTester(
      {
        timeoutMs: 1000,
        plannerMaxTokens: 100,
        answerMaxTokens: 100,
        embeddingBatchSize: 2,
        embeddingTokenBudget: 100,
      },
      responseFetcherFor(
        [
          {
            status: 400,
            body: { error: { code: "tool_use_failed" } },
          },
          { status: 200, body: passingResponses[0] },
          { status: 200, body: passingResponses[1] },
          { status: 200, body: passingResponses[2] },
        ],
        bodies,
      ),
    );

    const result = await tester.test(profile, {
      generation: "secret-provider-key",
      embeddings: "secret-provider-key",
    });

    expect(result.result).toMatchObject({
      status: "passed",
      generation: { status: "passed" },
    });
    expect(bodies).toHaveLength(4);
    expect(bodies[0]).not.toHaveProperty("temperature");
    expect(bodies[1]).toMatchObject({ temperature: 0.2 });
  });

  it("rejects planning when the forced tool and its single retry fail", async () => {
    const bodies: unknown[] = [];
    const toolFailure = {
      status: 400,
      body: { error: { code: "tool_use_failed" } },
    };
    const tester = new OpenAiCompatibleCapabilityTester(
      {
        timeoutMs: 1000,
        plannerMaxTokens: 100,
        answerMaxTokens: 100,
        embeddingBatchSize: 2,
        embeddingTokenBudget: 100,
      },
      responseFetcherFor([toolFailure, toolFailure, toolFailure], bodies),
    );

    const result = await tester.test(profile, {
      generation: "secret-provider-key",
      embeddings: "secret-provider-key",
    });
    const capabilityResult = result.result as unknown as CapabilityResult;

    expect(capabilityResult).toMatchObject({
      status: "failed",
      generation: { status: "failed" },
    });
    expect(capabilityResult.generation.capabilities).toContainEqual(
      expect.objectContaining({
        capability: "structured_planner",
        status: "failed",
      }),
    );
    expect(bodies).toHaveLength(3);
    expect(bodies.slice(0, 2)).toSatisfy((requests: unknown[]) =>
      requests.every(
        (body) => !(body as Record<string, unknown>).response_format,
      ),
    );
  });
});
