import { describe, expect, it, type Mock, vi } from "vitest";

import type { SearchCandidate } from "../domain/report-retrieval.types.js";
import { buildSemanticInput } from "../domain/semantic-input.js";
import type { EmbeddingPort } from "./report-assistant.ports.js";
import type {
  SemanticEmbeddingRepository,
  SemanticEmbeddingScope,
} from "./semantic-embedding.repository.js";
import type { SemanticIndexEnqueuer } from "./semantic-index.enqueuer.js";
import { SemanticRetrievalService } from "./semantic-retrieval.service.js";

const scope: SemanticEmbeddingScope = {
  provider: "mistral",
  embeddingScopeIdentity: "embedding-identity",
  model: "mistral-embed",
  inputVersion: "report-assistant/v1",
  dimensions: 3,
};

const configurationRevisionId = "revision-2026-08-10";

const item = (recordId: string, text: string): SearchCandidate => ({
  kind: "item",
  identity: {
    occurrenceId: `occurrence-${recordId}`,
    recordId,
    lineageId: null,
  },
  context: {
    reportId: "report-1",
    periodId: "period-1",
    periodLabel: "Week 31",
    periodStart: new Date("2026-08-03T00:00:00.000Z"),
    source: "live",
    sectionId: "section-1",
    authorId: "author-1",
    authorName: "Lead One",
    subject: { kind: "product", id: "product-1", name: "CRM Portal" },
    stageIds: ["Development"],
    linkedProductIds: ["product-1"],
  },
  text,
  itemType: "current",
  workflowStatus: "in_progress",
  carriedOver: false,
  priorityRank: null,
});

type EmbeddingHarness = Readonly<{
  port: EmbeddingPort;
  embedQuery: Mock<EmbeddingPort["embedQuery"]>;
  embedDocuments: Mock<EmbeddingPort["embedDocuments"]>;
}>;

const embeddingPort = (
  documentVector: readonly number[] = [1, 0, 0],
): EmbeddingHarness => {
  const embedQuery = vi
    .fn<EmbeddingPort["embedQuery"]>()
    .mockResolvedValue([1, 0, 0]);
  const embedDocuments = vi
    .fn<EmbeddingPort["embedDocuments"]>()
    .mockImplementation((documents) =>
      Promise.resolve(
        documents.map(({ contentHash }) => ({
          contentHash,
          vector: documentVector,
        })),
      ),
    );
  return { port: { embedQuery, embedDocuments }, embedQuery, embedDocuments };
};

type RepositoryHarness = Readonly<{
  port: SemanticEmbeddingRepository;
  findCachedHashes: Mock<SemanticEmbeddingRepository["findCachedHashes"]>;
  upsert: Mock<SemanticEmbeddingRepository["upsert"]>;
  rank: Mock<SemanticEmbeddingRepository["rank"]>;
}>;

const repository = (
  cachedHashes: readonly string[],
  matches: readonly { contentHash: string; similarity: number }[],
): RepositoryHarness => {
  const findCachedHashes = vi
    .fn<SemanticEmbeddingRepository["findCachedHashes"]>()
    .mockResolvedValue(cachedHashes);
  const upsert = vi
    .fn<SemanticEmbeddingRepository["upsert"]>()
    .mockResolvedValue(undefined);
  const rank = vi
    .fn<SemanticEmbeddingRepository["rank"]>()
    .mockResolvedValue(matches);
  return {
    port: { findCachedHashes, upsert, rank },
    findCachedHashes,
    upsert,
    rank,
  };
};

const service = (
  embeddings: EmbeddingPort,
  repositoryPort: SemanticEmbeddingRepository,
  readThroughLimit = 2,
  enqueuer: SemanticIndexEnqueuer = {
    enqueue: vi.fn().mockResolvedValue(undefined),
  },
): SemanticRetrievalService =>
  new SemanticRetrievalService(embeddings, repositoryPort, {
    configurationRevisionId,
    scope,
    similarityThreshold: 0.55,
    readThroughLimit,
    enqueuer,
  });

describe("SemanticRetrievalService", () => {
  it("embeds a shared hash once and ranks every occurrence in source order", async () => {
    const first = item("first", "Shared text");
    const other = item("other", "Other text");
    const repeated = item("repeated", "Shared text");
    const sharedInput = buildSemanticInput(first, scope.inputVersion);
    const otherInput = buildSemanticInput(other, scope.inputVersion);
    if (!sharedInput || !otherInput)
      throw new Error("Expected semantic item fixtures");
    const embeddings = embeddingPort();
    const repositoryHarness = repository(
      [],
      [
        { contentHash: otherInput.contentHash, similarity: 0.9 },
        { contentHash: sharedInput.contentHash, similarity: 0.8 },
      ],
    );

    const result = await service(
      embeddings.port,
      repositoryHarness.port,
    ).retrieve("topic", [first, other, repeated]);

    expect(embeddings.embedDocuments).toHaveBeenCalledExactlyOnceWith([
      { contentHash: sharedInput.contentHash, text: "Shared text" },
      { contentHash: otherInput.contentHash, text: "Other text" },
    ]);
    expect(repositoryHarness.findCachedHashes).toHaveBeenCalledWith(scope, [
      sharedInput.contentHash,
      otherInput.contentHash,
    ]);
    expect(result).toEqual({
      kind: "ranked",
      candidates: [
        { candidate: other, similarity: 0.9 },
        { candidate: first, similarity: 0.8 },
        { candidate: repeated, similarity: 0.8 },
      ],
      cache: { hitCount: 0, missCount: 2, readThrough: true },
    });
  });

  it("reads through every missing hash before ranking the complete set", async () => {
    const current = item("current", "Fresh draft text");
    const previous = item("previous", "Published text");
    const currentHash = buildSemanticInput(
      current,
      scope.inputVersion,
    )?.contentHash;
    const previousHash = buildSemanticInput(
      previous,
      scope.inputVersion,
    )?.contentHash;
    const embeddings = embeddingPort();
    const repositoryHarness = repository(
      [previousHash ?? ""],
      [
        { contentHash: currentHash ?? "", similarity: 0.9 },
        { contentHash: previousHash ?? "", similarity: 0.8 },
      ],
    );

    const result = await service(
      embeddings.port,
      repositoryHarness.port,
    ).retrieve("release work", [current, previous]);

    expect(result).toMatchObject({
      kind: "ranked",
      cache: { hitCount: 1, missCount: 1, readThrough: true },
    });
    expect(
      (result.kind === "ranked" ? result.candidates : []).map(
        ({ candidate }) => candidate.identity.recordId,
      ),
    ).toEqual(["current", "previous"]);
    expect(embeddings.embedDocuments).toHaveBeenCalledWith([
      { contentHash: currentHash, text: "Fresh draft text" },
    ]);
    expect(repositoryHarness.rank).toHaveBeenCalledWith({
      ...scope,
      queryVector: [1, 0, 0],
      allowedContentHashes: [currentHash, previousHash],
      similarityThreshold: 0.55,
      limit: 2,
    });
  });

  it("treats changed draft text and active model as cache misses", async () => {
    const oldCandidate = item("same-record", "Old draft text");
    const currentCandidate = item("same-record", "New draft text");
    const oldHash = buildSemanticInput(
      oldCandidate,
      scope.inputVersion,
    )?.contentHash;
    const newHash = buildSemanticInput(
      currentCandidate,
      scope.inputVersion,
    )?.contentHash;
    const embeddings = embeddingPort();
    const repositoryHarness = repository(
      [oldHash ?? ""],
      [{ contentHash: newHash ?? "", similarity: 0.9 }],
    );
    const activeScope = { ...scope, model: "mistral-embed-v2" };
    const result = await new SemanticRetrievalService(
      embeddings,
      repositoryHarness.port,
      {
        configurationRevisionId,
        scope: activeScope,
        similarityThreshold: 0.55,
        readThroughLimit: 1,
        enqueuer: { enqueue: vi.fn().mockResolvedValue(undefined) },
      },
    ).retrieve("new draft", [currentCandidate]);

    expect(result.kind).toBe("ranked");
    expect(repositoryHarness.findCachedHashes).toHaveBeenCalledWith(
      activeScope,
      [newHash],
    );
    expect(embeddings.embedDocuments).toHaveBeenCalledWith([
      { contentHash: newHash, text: "New draft text" },
    ]);
  });

  it("returns pending instead of ranking a partial set", async () => {
    const candidates = [item("one", "One"), item("two", "Two")];
    const embeddings = embeddingPort();
    const repositoryHarness = repository([], []);
    const enqueue = vi
      .fn<SemanticIndexEnqueuer["enqueue"]>()
      .mockResolvedValue(undefined);

    const result = await service(embeddings.port, repositoryHarness.port, 1, {
      enqueue,
    }).retrieve("topic", candidates);

    expect(result).toMatchObject({
      kind: "semantic_index_pending",
      cache: { missCount: 2, readThrough: false },
    });
    expect(
      result.kind === "semantic_index_pending" ? result.missingHashes : [],
    ).toHaveLength(2);
    expect(embeddings.embedDocuments).not.toHaveBeenCalled();
    expect(embeddings.embedQuery).not.toHaveBeenCalled();
    expect(repositoryHarness.rank).not.toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(enqueue.mock.calls[0]?.[0]).toMatchObject({
      source: "live",
      reportId: "report-1",
      sectionId: "section-1",
      recordKind: "item",
    });
    expect(enqueue.mock.calls[0]?.[1]).toEqual({
      configurationRevisionId,
      scope,
    });
    expect(enqueue.mock.calls[0]?.[0]).not.toHaveProperty("text");
  });

  it("returns no results below the threshold without structured fallback", async () => {
    const candidate = item("one", "Indexed text");
    const hash = buildSemanticInput(candidate, scope.inputVersion)?.contentHash;
    const embeddings = embeddingPort();
    const repositoryHarness = repository([hash ?? ""], []);

    const result = await service(
      embeddings.port,
      repositoryHarness.port,
    ).retrieve("unrelated topic", [candidate]);

    expect(result).toMatchObject({
      kind: "no_results",
      cache: { hitCount: 1, missCount: 0 },
    });
    expect(embeddings.embedDocuments).not.toHaveBeenCalled();
    expect(repositoryHarness.rank).toHaveBeenCalledWith({
      ...scope,
      queryVector: [1, 0, 0],
      allowedContentHashes: [hash],
      similarityThreshold: 0.55,
      limit: 1,
    });
  });

  it("does not request embeddings when exact candidates are not semantic-capable", async () => {
    const candidate: SearchCandidate = {
      ...item("status", "ignored"),
      kind: "product_status",
      status: "on-track",
    };
    const embeddings = embeddingPort();
    const repositoryHarness = repository([], []);

    await expect(
      service(embeddings.port, repositoryHarness.port).retrieve("status", [
        candidate,
      ]),
    ).resolves.toEqual({
      kind: "no_results",
      cache: { hitCount: 0, missCount: 0, readThrough: false },
    });
    expect(embeddings.embedQuery).not.toHaveBeenCalled();
    expect(repositoryHarness.findCachedHashes).not.toHaveBeenCalled();
  });
});
