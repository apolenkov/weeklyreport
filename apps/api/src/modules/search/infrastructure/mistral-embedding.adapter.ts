import type {
  EmbeddingRequest,
  EmbeddingResponse,
} from "@mistralai/mistralai/models/components";

import type {
  EmbeddedDocument,
  EmbeddingDocument,
  EmbeddingPort,
  EmbeddingVector,
} from "../application/report-assistant.ports.js";
import {
  createMistralClient,
  type MistralClientConfig,
  MistralProtocolError,
  MistralProviderError,
} from "./mistral-planner.adapter.js";

export type MistralEmbeddingClient = Readonly<{
  create(
    request: EmbeddingRequest,
    options?: Readonly<{ timeoutMs?: number }>,
  ): Promise<EmbeddingResponse>;
}>;

export type MistralEmbeddingAdapterConfig = MistralClientConfig &
  Readonly<{
    model: string;
    dimensions: number;
    batchSize: number;
    tokenBudget: number;
  }>;

const CHARS_PER_ESTIMATED_TOKEN = 4;
export const MISTRAL_PROVIDER_NAME = "mistral" as const;

const validateConfig = (config: MistralEmbeddingAdapterConfig): void => {
  if (config.model.trim().length === 0) {
    throw new Error("MISTRAL_EMBEDDING_MODEL must be non-empty");
  }
  if (!Number.isInteger(config.dimensions) || config.dimensions < 1) {
    throw new Error("MISTRAL_EMBEDDING_DIMENSIONS must be positive");
  }
  if (!Number.isInteger(config.batchSize) || config.batchSize < 1) {
    throw new Error("REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE must be positive");
  }
  if (!Number.isInteger(config.tokenBudget) || config.tokenBudget < 1) {
    throw new Error("REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET must be positive");
  }
};

const estimatedTokens = (text: string): number =>
  Math.max(1, Math.ceil(text.length / CHARS_PER_ESTIMATED_TOKEN));

type DocumentBatch = readonly EmbeddingDocument[];

const appendDocument = (
  batches: readonly DocumentBatch[],
  document: EmbeddingDocument,
  config: MistralEmbeddingAdapterConfig,
): readonly DocumentBatch[] => {
  const last = batches[batches.length - 1];
  const lastTokens = last?.reduce(
    (total, item) => total + estimatedTokens(item.text),
    0,
  );
  const fitsCurrent =
    last !== undefined &&
    last.length < config.batchSize &&
    (lastTokens ?? 0) + estimatedTokens(document.text) <= config.tokenBudget;
  return fitsCurrent
    ? [...batches.slice(0, -1), [...last, document]]
    : [...batches, [document]];
};

const batchDocuments = (
  documents: readonly EmbeddingDocument[],
  config: MistralEmbeddingAdapterConfig,
): readonly DocumentBatch[] => {
  if (
    documents.some(({ text }) => estimatedTokens(text) > config.tokenBudget)
  ) {
    throw new Error("Embedding document exceeds the configured token budget");
  }
  return documents.reduce<readonly DocumentBatch[]>(
    (batches, document) => appendDocument(batches, document, config),
    [],
  );
};

const finiteVector = (
  value: readonly number[] | undefined,
  dimensions: number,
): EmbeddingVector => {
  if (value === undefined) {
    throw new MistralProtocolError(
      "Mistral returned an invalid embedding vector",
    );
  }
  if (
    value.length !== dimensions ||
    value.some((number) => !Number.isFinite(number))
  ) {
    throw new MistralProtocolError(
      "Mistral returned an invalid embedding vector",
    );
  }
  return value;
};

const requestBatch = async (
  client: MistralEmbeddingClient,
  documents: DocumentBatch,
  config: MistralEmbeddingAdapterConfig,
): Promise<readonly EmbeddingVector[]> => {
  const response = await (async () => {
    try {
      return await client.create(
        {
          model: config.model,
          inputs: documents.map(({ text }) => text),
          outputDimension: config.dimensions,
        },
        { timeoutMs: config.providerTimeoutMs },
      );
    } catch (error) {
      throw new MistralProviderError("embedding", error);
    }
  })();
  if (response.data.length !== documents.length) {
    throw new MistralProtocolError(
      "Mistral returned an incomplete embedding batch",
    );
  }
  const indexed = response.data.map((row) => {
    if (row.index === undefined) {
      throw new MistralProtocolError("Mistral omitted an embedding index");
    }
    return [row.index, finiteVector(row.embedding, config.dimensions)] as const;
  });
  const indices = indexed.map(([index]) => index);
  if (
    new Set(indices).size !== documents.length ||
    indices.some((index) => index < 0 || index >= documents.length)
  ) {
    throw new MistralProtocolError(
      "Mistral returned invalid embedding indices",
    );
  }
  return documents.map((_, index) => {
    const vector = indexed.find(([rowIndex]) => rowIndex === index)?.[1];
    if (vector === undefined) {
      throw new MistralProtocolError("Mistral omitted an embedding vector");
    }
    return vector;
  });
};

export const createMistralEmbeddingClient = async (
  config: MistralEmbeddingAdapterConfig,
): Promise<MistralEmbeddingClient> =>
  (await createMistralClient(config)).embeddings;

export class MistralEmbeddingAdapter implements EmbeddingPort {
  constructor(
    private readonly client: MistralEmbeddingClient,
    private readonly config: MistralEmbeddingAdapterConfig,
  ) {
    validateConfig(config);
  }

  async embedQuery(text: string): Promise<EmbeddingVector> {
    const documents = await this.embedDocuments([
      { contentHash: "query", text },
    ]);
    const vector = documents[0]?.vector;
    if (vector === undefined) {
      throw new MistralProtocolError("Mistral returned no query embedding");
    }
    return vector;
  }

  async embedDocuments(
    documents: readonly EmbeddingDocument[],
  ): Promise<readonly EmbeddedDocument[]> {
    const batches = batchDocuments(documents, this.config);
    const vectors = (
      await Promise.all(
        batches.map((batch) => requestBatch(this.client, batch, this.config)),
      )
    ).flat();
    if (vectors.length !== documents.length) {
      throw new MistralProtocolError("Mistral embedding batch count mismatch");
    }
    return documents.map(({ contentHash }, index) => {
      const vector = vectors[index];
      if (vector === undefined) {
        throw new MistralProtocolError("Mistral omitted an embedding vector");
      }
      return { contentHash, vector };
    });
  }
}
