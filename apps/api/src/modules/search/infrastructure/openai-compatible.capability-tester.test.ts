import { describe, expect, it } from "vitest";

import type { ResolvedProviderProfile } from "../../ai-provider/index.js";
import { OpenAiCompatibleCapabilityTester } from "./openai-compatible.capability-tester.js";
import type { OpenAiCompatibleFetch } from "./openai-compatible.transport.js";

type CapabilityResult = Readonly<{
  status: string;
  capabilities: readonly Readonly<{ capability: string; status: string }>[];
}>;

const profile: ResolvedProviderProfile = {
  profile: "custom-openai-compatible",
  baseUrl: "https://approved.example.com/v1",
  endpointIdentity: "custom:approved",
  plannerModel: "planner",
  answerModel: "answer",
  embeddingModel: "embed",
  embeddingDimensions: 3,
  semanticInputVersion: "report-assistant/v1",
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

describe("OpenAiCompatibleCapabilityTester", () => {
  it("probes only synthetic planner, answer, and embedding contracts", async () => {
    const bodies: unknown[] = [];
    const headers: Headers[] = [];
    const tester = new OpenAiCompatibleCapabilityTester(
      1000,
      100,
      100,
      2,
      100,
      fetcherFor(passingResponses, bodies, headers),
    );
    const result = await tester.test(profile, "secret-provider-key");
    const capabilityResult = result.result as unknown as CapabilityResult;

    expect(capabilityResult.status).toBe("passed");
    expect(capabilityResult.capabilities).toEqual(
      expect.arrayContaining([
        { capability: "authentication", status: "passed" },
        { capability: "planner_tool_call", status: "passed" },
        { capability: "structured_answer", status: "passed" },
        { capability: "token_usage", status: "passed" },
        { capability: "batch_embeddings", status: "passed" },
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
});
