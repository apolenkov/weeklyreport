import type {
  EmbeddedDocument,
  EmbeddingDocument,
  EmbeddingPort,
  EmbeddingVector,
} from "../application/report-assistant.ports.js";
import {
  OpenAiCompatibleProtocolError,
  OpenAiCompatibleTransport,
} from "./openai-compatible.transport.js";

const TEXT_TOKEN_DIVISOR = 4;

export type OpenAiCompatibleEmbeddingConfig = Readonly<{
  model: string;
  dimensions: number;
  batchSize: number;
  tokenBudget: number;
}>;

const estimatedTokens = (text: string): number =>
  Math.max(1, Math.ceil(text.length / TEXT_TOKEN_DIVISOR));

const documentBatches = (
  documents: readonly EmbeddingDocument[],
  config: OpenAiCompatibleEmbeddingConfig,
): readonly (readonly EmbeddingDocument[])[] => {
  if (
    documents.some(({ text }) => estimatedTokens(text) > config.tokenBudget)
  ) {
    throw new Error("Embedding document exceeds the configured token budget");
  }
  return documents.reduce<readonly (readonly EmbeddingDocument[])[]>(
    (batches, document) => {
      const last = batches.at(-1);
      const lastTokens = last?.reduce(
        (total, item) => total + estimatedTokens(item.text),
        0,
      );
      const fits =
        last !== undefined &&
        last.length < config.batchSize &&
        (lastTokens ?? 0) + estimatedTokens(document.text) <=
          config.tokenBudget;
      return fits
        ? [...batches.slice(0, -1), [...last, document]]
        : [...batches, [document]];
    },
    [],
  );
};

const INVALID_EMBEDDING_VECTOR =
  "Provider returned an invalid embedding vector";

const finiteVector = (value: unknown, dimensions: number): EmbeddingVector => {
  if (!Array.isArray(value) || value.length !== dimensions) {
    throw new OpenAiCompatibleProtocolError(INVALID_EMBEDDING_VECTOR);
  }
  const vector = value.map((number) => {
    if (typeof number !== "number" || !Number.isFinite(number)) {
      throw new OpenAiCompatibleProtocolError(INVALID_EMBEDDING_VECTOR);
    }
    return number;
  });
  // Cosine distance is undefined for a zero vector, so it can never rank:
  // refuse it as a protocol failure rather than caching or preparing it.
  if (!vector.some((component) => component !== 0)) {
    throw new OpenAiCompatibleProtocolError(INVALID_EMBEDDING_VECTOR);
  }
  return vector;
};

const embedBatch = async (
  transport: OpenAiCompatibleTransport,
  documents: readonly EmbeddingDocument[],
  config: OpenAiCompatibleEmbeddingConfig,
  signal?: AbortSignal,
): Promise<readonly EmbeddingVector[]> => {
  const response = await transport.embeddings(
    config.model,
    documents.map(({ text }) => text),
    signal,
  );
  const rows = response.data ?? [];
  if (rows.length !== documents.length) {
    throw new OpenAiCompatibleProtocolError(
      "Provider returned an incomplete embedding batch",
    );
  }
  const indexed = rows.map((row) => {
    if (
      typeof row.index !== "number" ||
      !Number.isInteger(row.index) ||
      row.index < 0 ||
      row.index >= documents.length
    ) {
      throw new OpenAiCompatibleProtocolError(
        "Provider returned invalid embedding indices",
      );
    }
    return [row.index, finiteVector(row.embedding, config.dimensions)] as const;
  });
  if (new Set(indexed.map(([index]) => index)).size !== documents.length) {
    throw new OpenAiCompatibleProtocolError(
      "Provider returned duplicate embedding indices",
    );
  }
  return documents.map((_, index) => {
    const row = indexed.find(([rowIndex]) => rowIndex === index);
    if (!row)
      throw new OpenAiCompatibleProtocolError(
        "Provider omitted an embedding vector",
      );
    return row[1];
  });
};

export class OpenAiCompatibleEmbeddingAdapter implements EmbeddingPort {
  constructor(
    private readonly transport: OpenAiCompatibleTransport,
    private readonly config: OpenAiCompatibleEmbeddingConfig,
  ) {
    if (config.model.trim().length === 0)
      throw new Error("Embedding model is required");
    if (!Number.isInteger(config.dimensions) || config.dimensions < 1) {
      throw new Error("Embedding dimensions must be positive");
    }
    if (!Number.isInteger(config.batchSize) || config.batchSize < 1) {
      throw new Error("Embedding batch size must be positive");
    }
    if (!Number.isInteger(config.tokenBudget) || config.tokenBudget < 1) {
      throw new Error("Embedding token budget must be positive");
    }
  }

  async embedQuery(
    text: string,
    signal?: AbortSignal,
  ): Promise<EmbeddingVector> {
    const documents = await this.embedDocuments(
      [{ contentHash: "query", text }],
      signal,
    );
    const vector = documents[0]?.vector;
    if (!vector)
      throw new OpenAiCompatibleProtocolError(
        "Provider returned no query embedding",
      );
    return vector;
  }

  async embedDocuments(
    documents: readonly EmbeddingDocument[],
    signal?: AbortSignal,
  ): Promise<readonly EmbeddedDocument[]> {
    signal?.throwIfAborted();
    const batches = documentBatches(documents, this.config);
    const vectors = (
      await Promise.all(
        batches.map((batch) =>
          embedBatch(this.transport, batch, this.config, signal),
        ),
      )
    ).flat();
    signal?.throwIfAborted();
    if (vectors.length !== documents.length) {
      throw new OpenAiCompatibleProtocolError(
        "Provider embedding batch count mismatch",
      );
    }
    return documents.map(({ contentHash }, index) => {
      const vector = vectors[index];
      if (!vector)
        throw new OpenAiCompatibleProtocolError(
          "Provider omitted an embedding vector",
        );
      return { contentHash, vector };
    });
  }
}
