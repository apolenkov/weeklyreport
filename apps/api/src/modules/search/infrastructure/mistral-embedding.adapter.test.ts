import type { EmbeddingResponse } from "@mistralai/mistralai/models/components";
import { describe, expect, it, vi } from "vitest";

import {
  MistralEmbeddingAdapter,
  type MistralEmbeddingAdapterConfig,
  type MistralEmbeddingClient,
} from "./mistral-embedding.adapter.js";
import {
  MistralProtocolError,
  MistralProviderError,
} from "./mistral-planner.adapter.js";

const config: MistralEmbeddingAdapterConfig = {
  apiKey: "test-only-placeholder",
  server: "eu",
  providerTimeoutMs: 5000,
  model: "mistral-embed",
  dimensions: 3,
  batchSize: 2,
  tokenBudget: 20,
};

const response = (inputs: readonly string[]): EmbeddingResponse => ({
  id: "embedding-id",
  object: "list",
  model: config.model,
  usage: { promptTokens: 1, completionTokens: 0, totalTokens: 1 },
  data: inputs
    .map((_, index) => ({
      object: "embedding",
      index,
      embedding: [index + 0.1, index + 0.2, index + 0.3],
    }))
    .reverse(),
});

const clientWith = (implementation: MistralEmbeddingClient["create"]) => {
  const create = vi.fn<MistralEmbeddingClient["create"]>(implementation);
  return { client: { create } satisfies MistralEmbeddingClient, create };
};

describe("MistralEmbeddingAdapter", () => {
  it("batches documents, preserves document order, and sends dimensions and timeout", async () => {
    const { client, create } = clientWith((request) => {
      const inputs = Array.isArray(request.inputs)
        ? request.inputs
        : [request.inputs];
      return Promise.resolve(response(inputs));
    });
    const adapter = new MistralEmbeddingAdapter(client, config);

    await expect(
      adapter.embedDocuments([
        { contentHash: "hash-1", text: "one" },
        { contentHash: "hash-2", text: "two" },
        { contentHash: "hash-3", text: "three" },
      ]),
    ).resolves.toEqual([
      { contentHash: "hash-1", vector: [0.1, 0.2, 0.3] },
      { contentHash: "hash-2", vector: [1.1, 1.2, 1.3] },
      { contentHash: "hash-3", vector: [0.1, 0.2, 0.3] },
    ]);
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      model: config.model,
      outputDimension: config.dimensions,
    });
    expect(create.mock.calls[0]?.[1]).toEqual({ timeoutMs: 5000 });
  });

  it("uses the same validated path for query embeddings and rejects invalid provider output", async () => {
    const { client } = clientWith((request) => {
      const inputs = Array.isArray(request.inputs)
        ? request.inputs
        : [request.inputs];
      return Promise.resolve(response(inputs));
    });
    const adapter = new MistralEmbeddingAdapter(client, config);

    await expect(adapter.embedQuery("release blocker")).resolves.toEqual([
      0.1, 0.2, 0.3,
    ]);

    const malformed = clientWith(() =>
      Promise.resolve({
        ...response(["one"]),
        data: [{ index: 0, embedding: [Number.NaN] }],
      }),
    );
    await expect(
      new MistralEmbeddingAdapter(malformed.client, config).embedQuery("x"),
    ).rejects.toBeInstanceOf(MistralProtocolError);

    const failing = clientWith(async () =>
      Promise.reject(new Error("network")),
    );
    await expect(
      new MistralEmbeddingAdapter(failing.client, config).embedQuery("x"),
    ).rejects.toBeInstanceOf(MistralProviderError);
  });
});
