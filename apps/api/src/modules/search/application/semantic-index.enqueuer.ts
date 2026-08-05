import type { SemanticIndexLocator } from "./semantic-index.source-loader.js";

export const SEMANTIC_INDEX_ENQUEUER = Symbol("SemanticIndexEnqueuer");

export interface SemanticIndexEnqueuer {
  enqueue(input: SemanticIndexLocator): Promise<void>;
}
