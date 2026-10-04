import { describe, expect, it, vi } from "vitest";

import { ReportAssistantProviderError } from "../application/report-assistant.ports.js";
import { MAX_PROVIDER_RESPONSE_BYTES } from "./openai-compatible.response-body.js";
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

const streamedResponse = (
  chunks: readonly Uint8Array[],
  init?: ResponseInit,
): Response =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    init,
  );

describe("OpenAiCompatibleTransport", () => {
  it("uses bounded POST requests without sampling overrides and normalizes usage", async () => {
    const fetcher: OpenAiCompatibleFetch = (_input, init) => {
      expect(init?.method).toBe("POST");
      expect(init?.redirect).toBe("error");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      const body = init?.body;
      expect(typeof body).toBe("string");
      if (typeof body !== "string") throw new Error("Expected JSON body");
      expect(JSON.parse(body)).not.toHaveProperty("temperature");
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
    const fetcher = vi
      .fn<OpenAiCompatibleFetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: "rate_limit_exceeded" } }),
          { status: 429, headers: { "retry-after": "0" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [], usage: {} }), {
          status: 200,
        }),
      );
    const transport = new OpenAiCompatibleTransport(config(fetcher));

    await expect(
      transport.chat(
        { model: "planner", maxTokens: 10, messages: [] },
        "planner",
      ),
    ).resolves.toMatchObject({ choices: [] });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("fails fast with a retryable error when the provider is unreachable", async () => {
    const fetcher = vi
      .fn<OpenAiCompatibleFetch>()
      .mockRejectedValue(new TypeError("fetch failed"));
    const transport = new OpenAiCompatibleTransport(config(fetcher));

    await expect(
      transport.chat(
        { model: "planner", maxTokens: 10, messages: [] },
        "planner",
      ),
    ).rejects.toMatchObject({
      constructor: ReportAssistantProviderError,
      statusCode: undefined,
      retryable: true,
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("gives up after one request timeout instead of waiting it out three times", async () => {
    const fetcher = vi.fn<OpenAiCompatibleFetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("timed out", "TimeoutError")),
          );
        }),
    );
    const transport = new OpenAiCompatibleTransport({
      ...config(fetcher),
      timeoutMs: 20,
    });

    await expect(
      transport.chat(
        { model: "planner", maxTokens: 10, messages: [] },
        "planner",
      ),
    ).rejects.toMatchObject({ retryable: true, statusCode: undefined });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("preserves a long Retry-After and does not retry before its reset", async () => {
    const fetcher = vi
      .fn<OpenAiCompatibleFetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: "rate_limit_exceeded" } }),
          { status: 429, headers: { "retry-after": "42" } },
        ),
      );
    const transport = new OpenAiCompatibleTransport(config(fetcher));

    await expect(
      transport.chat(
        { model: "planner", maxTokens: 10, messages: [] },
        "planner",
      ),
    ).rejects.toMatchObject({
      constructor: ReportAssistantProviderError,
      statusCode: 429,
      retryAfterMs: 42_000,
    });
    expect(fetcher).toHaveBeenCalledOnce();
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

  it("preserves OpenRouter typed error metadata without provider messages", async () => {
    const fetcher: OpenAiCompatibleFetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            error: {
              code: 400,
              message: "sensitive provider detail",
              metadata: {
                error_type: "invalid_request",
                provider_code: "unsupported_reasoning_effort",
              },
            },
          }),
          { status: 400 },
        ),
      );
    const transport = new OpenAiCompatibleTransport(config(fetcher));

    await expect(
      transport.chat(
        { model: "planner", maxTokens: 10, messages: [] },
        "planner",
      ),
    ).rejects.toMatchObject({
      providerCode: "unsupported_reasoning_effort",
      statusCode: 400,
    });
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

  it("rejects an oversized declared response with a safe classified error", async () => {
    const fetcher: OpenAiCompatibleFetch = () =>
      Promise.resolve(
        new Response("{}", {
          status: 400,
          headers: {
            "content-length": String(MAX_PROVIDER_RESPONSE_BYTES + 1),
          },
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
      providerCode: "provider_response_too_large",
    });
  });

  it("does not retry an oversized 503 response", async () => {
    const fetcher = vi.fn<OpenAiCompatibleFetch>().mockResolvedValue(
      new Response("{}", {
        status: 503,
        headers: {
          "content-length": String(MAX_PROVIDER_RESPONSE_BYTES + 1),
        },
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
      statusCode: 503,
      retryable: false,
      providerCode: "provider_response_too_large",
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("cancels a chunked response when it exceeds the byte limit", async () => {
    let cancelled = false;
    const fetcher: OpenAiCompatibleFetch = () =>
      Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              controller.enqueue(new Uint8Array(MAX_PROVIDER_RESPONSE_BYTES));
              controller.enqueue(new Uint8Array(1));
            },
            cancel() {
              cancelled = true;
            },
          }),
          { status: 200 },
        ),
      );
    const transport = new OpenAiCompatibleTransport(config(fetcher));

    await expect(
      transport.embeddings("embedder", ["hello"]),
    ).rejects.toMatchObject({
      constructor: ReportAssistantProviderError,
      statusCode: 200,
      retryable: false,
      providerCode: "provider_response_too_large",
    });
    expect(cancelled).toBe(true);
  });

  it("accepts a response exactly at the byte limit", async () => {
    const prefix = '{"data":[],"padding":"';
    const suffix = '"}';
    const body = `${prefix}${"x".repeat(
      MAX_PROVIDER_RESPONSE_BYTES - prefix.length - suffix.length,
    )}${suffix}`;
    const bytes = new TextEncoder().encode(body);
    expect(bytes.byteLength).toBe(MAX_PROVIDER_RESPONSE_BYTES);
    const fetcher: OpenAiCompatibleFetch = () =>
      Promise.resolve(
        streamedResponse([bytes], {
          status: 200,
          headers: { "content-length": String(MAX_PROVIDER_RESPONSE_BYTES) },
        }),
      );
    const transport = new OpenAiCompatibleTransport(config(fetcher));

    await expect(transport.embeddings("embedder", ["hello"])).resolves.toEqual(
      expect.objectContaining({ data: [] }),
    );
  });
});
