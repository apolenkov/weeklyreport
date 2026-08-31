import type { SearchCandidate } from "../domain/report-retrieval.types.js";
import type { SemanticCandidateKind } from "../domain/semantic-input.js";

export const SEMANTIC_INDEX_SOURCE_LOADER = Symbol(
  "SEMANTIC_INDEX_SOURCE_LOADER",
);

export type SemanticIndexLocator = Readonly<{
  source: "live" | "snapshot";
  reportId: string;
  sectionId: string;
  occurrenceId: string;
  recordKind: SemanticCandidateKind;
  recordId: string;
  expectedContentHash: string;
}>;

export interface SemanticIndexSourceLoader {
  load(input: SemanticIndexLocator): Promise<SearchCandidate | null>;
}
