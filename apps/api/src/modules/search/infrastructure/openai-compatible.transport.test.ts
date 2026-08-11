import { describe, expect, it } from "vitest";

import { ReportAssistantProviderError } from "../application/report-assistant.ports.js";
import {
  type OpenAiCompatibleFetch,
  OpenAiCompatibleProtocolError,
  OpenAiCompatibleTransport,
} from "./openai-compatible.transport.js";

const config = (fetcher: OpenAiCompatibleFetch) => ({
  baseUrl: "https://ai.example.com/v1",
  credential: "secret",
  timeoutMs: 1000,
  fetcher,
});

describe("OpenAiCompatibleTransport", () => {
  it("uses bounded POST requests with redirects disabled and normalizes usage", async () => {
    const fetcher: OpenAiCompatibleFetch = (_input, init) => {
      expect(init?.method).toBe("POST");
      expect(init?.redirect).toBe("error");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [],
            usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    };
    const transport = new OpenAiCompatibleTransport(config(fetcher));

    const response = await transport.chat(
      {
        model: "planner",
        maxTokens: 10,
        messages: [{ role: "user", content: "hello" }],
      },
      "planner",
    );

    expect(response.usage).toEqual({
      prompt_tokens: 1,
      completion_tokens: 2,
      total_tokens: 3,
    });
  });

  it("classifies rate limits as retryable without returning provider bodies", async () => {
    const fetcher: OpenAiCompatibleFetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({ error: { message: "secret provider body" } }),
          {
            status: 429,
          },
        ),
      );
    const transport = new OpenAiCompatibleTransport(config(fetcher));

    await expect(
      transport.chat(
        { model: "planner", maxTokens: 10, messages: [] },
        "planner",
      ),
    ).rejects.toMatchObject({
      statusCode: 429,
      retryable: true,
    });
  });

  it("keeps non-retryable provider failures technical and body-free", async () => {
    const fetcher: OpenAiCompatibleFetch = () =>
      Promise.resolve(
        new Response(JSON.stringify({ error: { message: "secret body" } }), {
          status: 400,
        }),
      );
    const transport = new OpenAiCompatibleTransport(config(fetcher));

    await expect(
      transport.chat(
        { model: "planner", maxTokens: 10, messages: [] },
        "planner",
      ),
    ).rejects.toMatchObject({
      constructor: ReportAssistantProviderError,
      statusCode: 400,
      retryable: false,
    });
    await expect(
      transport.chat(
        { model: "planner", maxTokens: 10, messages: [] },
        "planner",
      ),
    ).rejects.not.toThrow("secret body");
  });

  it("rejects malformed successful provider payloads", async () => {
    const fetcher: OpenAiCompatibleFetch = () =>
      Promise.resolve(new Response(JSON.stringify(null), { status: 200 }));
    const transport = new OpenAiCompatibleTransport(config(fetcher));

    await expect(
      transport.chat(
        { model: "planner", maxTokens: 10, messages: [] },
        "planner",
      ),
    ).rejects.toBeInstanceOf(OpenAiCompatibleProtocolError);
  });
});
