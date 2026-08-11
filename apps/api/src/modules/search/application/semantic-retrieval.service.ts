import type { SearchCandidate } from "../domain/report-retrieval.types.js";
import {
  buildSemanticInput,
  type SemanticInput,
} from "../domain/semantic-input.js";
import type { EmbeddingPort } from "./report-assistant.ports.js";
import type {
  SemanticEmbeddingMatch,
  SemanticEmbeddingRepository,
  SemanticEmbeddingScope,
} from "./semantic-embedding.repository.js";
import type { SemanticIndexEnqueuer } from "./semantic-index.enqueuer.js";
import type { SemanticIndexRuntimeContext } from "./semantic-index.enqueuer.js";
import type { SemanticIndexLocator } from "./semantic-index.source-loader.js";

export type SemanticRetrievalConfig = Readonly<{
  configurationRevisionId: string;
  scope: SemanticEmbeddingScope;
  similarityThreshold: number;
  readThroughLimit: number;
  enqueuer: SemanticIndexEnqueuer;
}>;

type SemanticRankedCandidate = Readonly<{
  candidate: SearchCandidate;
  similarity: number;
}>;

export type SemanticRetrievalOutcome =
  | Readonly<{
      kind: "ranked";
      candidates: readonly SemanticRankedCandidate[];
      cache: Readonly<{
        hitCount: number;
        missCount: number;
        readThrough: boolean;
      }>;
    }>
  | Readonly<{
      kind: "semantic_index_pending";
      missingHashes: readonly string[];
      cache: Readonly<{
        hitCount: number;
        missCount: number;
        readThrough: boolean;
      }>;
    }>
  | Readonly<{
      kind: "no_results";
      cache: Readonly<{
        hitCount: number;
        missCount: number;
        readThrough: boolean;
      }>;
    }>;

type SemanticCandidate = Readonly<{
  candidate: SearchCandidate;
  input: SemanticInput;
}>;

type SemanticGroup = Readonly<{
  input: SemanticInput;
  candidates: readonly SearchCandidate[];
}>;

const cacheState = (
  hitCount: number,
  missCount: number,
  readThrough: boolean,
) => ({ hitCount, missCount, readThrough });

const collectSemanticCandidates = (
  candidates: readonly SearchCandidate[],
  inputVersion: string,
): readonly SemanticCandidate[] =>
  candidates.flatMap((candidate) => {
    const input = buildSemanticInput(candidate, inputVersion);
    return input === null ? [] : [{ candidate, input }];
  });

const groupByHash = (
  candidates: readonly SemanticCandidate[],
): readonly SemanticGroup[] => {
  const groups = candidates.reduce<ReadonlyMap<string, SemanticGroup>>(
    (current, item) => {
      const previous = current.get(item.input.contentHash);
      const next = previous
        ? { ...previous, candidates: [...previous.candidates, item.candidate] }
        : { input: item.input, candidates: [item.candidate] };
      return new Map(current).set(item.input.contentHash, next);
    },
    new Map<string, SemanticGroup>(),
  );
  return [...groups.values()];
};

const hashSet = (groups: readonly SemanticGroup[]): readonly string[] =>
  groups.map(({ input }) => input.contentHash);

const indexLocator = (
  candidate: SearchCandidate,
  input: SemanticInput,
): SemanticIndexLocator => ({
  source: candidate.context.source,
  reportId: candidate.context.reportId,
  sectionId: candidate.context.sectionId,
  occurrenceId: candidate.identity.occurrenceId,
  recordKind: input.kind,
  recordId: candidate.identity.recordId,
  expectedContentHash: input.contentHash,
});

const enqueueMissing = async (
  groups: readonly SemanticGroup[],
  config: SemanticRetrievalConfig,
): Promise<void> => {
  const context: SemanticIndexRuntimeContext = {
    configurationRevisionId: config.configurationRevisionId,
    scope: config.scope,
  };
  await Promise.all(
    groups.flatMap(({ input, candidates }) =>
      candidates.map((candidate) =>
        config.enqueuer.enqueue(indexLocator(candidate, input), context),
      ),
    ),
  );
};

const completeEmbeddings = (
  expected: readonly string[],
  actual: readonly string[],
): boolean => {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return (
    expectedSet.size === actualSet.size &&
    expectedSet.size === actual.length &&
    [...expectedSet].every((hash) => actualSet.has(hash))
  );
};

const readThroughMissing = async (
  missing: readonly SemanticGroup[],
  config: SemanticRetrievalConfig,
  embeddings: EmbeddingPort,
  repository: SemanticEmbeddingRepository,
): Promise<void> => {
  const documents = await embeddings.embedDocuments(
    missing.map(({ input }) => ({
      contentHash: input.contentHash,
      text: input.text,
    })),
  );
  const expectedHashes = missing.map(({ input }) => input.contentHash);
  if (
    !completeEmbeddings(
      expectedHashes,
      documents.map(({ contentHash }) => contentHash),
    )
  ) {
    throw new Error("Embedding provider returned an incomplete document batch");
  }
  await Promise.all(
    documents.map(({ contentHash, vector }) =>
      repository.upsert({ ...config.scope, contentHash, vector }),
    ),
  );
};

const rankCandidates = (
  groups: readonly SemanticGroup[],
  matches: readonly SemanticEmbeddingMatch[],
): readonly SemanticRankedCandidate[] => {
  const groupsByHash = new Map(
    groups.map((group) => [group.input.contentHash, group]),
  );
  return matches.flatMap((match) => {
    const group = groupsByHash.get(match.contentHash);
    return group
      ? group.candidates.map((candidate) => ({
          candidate,
          similarity: match.similarity,
        }))
      : [];
  });
};

export class SemanticRetrievalService {
  constructor(
    private readonly embeddings: EmbeddingPort,
    private readonly repository: SemanticEmbeddingRepository,
    private readonly config: SemanticRetrievalConfig,
  ) {}

  async retrieve(
    query: string,
    candidates: readonly SearchCandidate[],
  ): Promise<SemanticRetrievalOutcome> {
    const groups = groupByHash(
      collectSemanticCandidates(candidates, this.config.scope.inputVersion),
    );
    if (groups.length === 0) {
      return { kind: "no_results", cache: cacheState(0, 0, false) };
    }
    const hashes = hashSet(groups);
    const cached = await this.repository.findCachedHashes(
      this.config.scope,
      hashes,
    );
    const cachedSet = new Set(cached);
    const missing = groups.filter(
      ({ input }) => !cachedSet.has(input.contentHash),
    );
    const cache = cacheState(
      cached.length,
      missing.length,
      missing.length > 0 && missing.length <= this.config.readThroughLimit,
    );
    if (missing.length > this.config.readThroughLimit) {
      await enqueueMissing(missing, this.config);
      return {
        kind: "semantic_index_pending",
        missingHashes: missing.map(({ input }) => input.contentHash),
        cache,
      };
    }
    if (missing.length > 0) {
      await readThroughMissing(
        missing,
        this.config,
        this.embeddings,
        this.repository,
      );
    }
    const queryVector = await this.embeddings.embedQuery(query);
    const matches = await this.repository.rank({
      ...this.config.scope,
      queryVector,
      allowedContentHashes: hashes,
      similarityThreshold: this.config.similarityThreshold,
      limit: hashes.length,
    });
    const ranked = rankCandidates(groups, matches);
    return ranked.length > 0
      ? { kind: "ranked", candidates: ranked, cache }
      : { kind: "no_results", cache };
  }
}
