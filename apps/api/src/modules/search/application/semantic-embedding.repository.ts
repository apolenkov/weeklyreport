import type { EmbeddingVector } from "./report-assistant.ports.js";

export type SemanticEmbeddingScope = Readonly<{
  provider: string;
  embeddingScopeIdentity: string;
  model: string;
  inputVersion: string;
  dimensions: number;
}>;

export type SemanticEmbeddingRecord = SemanticEmbeddingScope &
  Readonly<{
    contentHash: string;
    vector: EmbeddingVector;
  }>;

export type SemanticEmbeddingRankQuery = SemanticEmbeddingScope &
  Readonly<{
    queryVector: EmbeddingVector;
    allowedContentHashes: readonly string[];
    similarityThreshold: number;
    limit: number;
  }>;

export type SemanticEmbeddingMatch = Readonly<{
  contentHash: string;
  similarity: number;
}>;

export interface SemanticEmbeddingRepository {
  findCachedHashes(
    scope: SemanticEmbeddingScope,
    contentHashes: readonly string[],
  ): Promise<readonly string[]>;
  upsert(input: SemanticEmbeddingRecord): Promise<void>;
  rank(
    input: SemanticEmbeddingRankQuery,
  ): Promise<readonly SemanticEmbeddingMatch[]>;
}
