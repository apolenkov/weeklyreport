import type { SemanticEmbeddingScope } from "./semantic-embedding.repository.js";
import type { SemanticIndexLocator } from "./semantic-index.source-loader.js";

export const SEMANTIC_INDEX_ENQUEUER = Symbol("SemanticIndexEnqueuer");

export type SemanticIndexRuntimeContext = Readonly<{
  configurationRevisionId: string;
  scope: SemanticEmbeddingScope;
}>;

export interface SemanticIndexEnqueuer {
  enqueue(
    input: SemanticIndexLocator,
    context: SemanticIndexRuntimeContext,
  ): Promise<void>;
}
