import type { Job } from "bullmq";
import { describe, expect, it, type Mock, vi } from "vitest";

import type { EmbeddingPort } from "../application/report-assistant.ports.js";
import type { SemanticEmbeddingRepository } from "../application/semantic-embedding.repository.js";
import type { SemanticIndexSourceLoader } from "../application/semantic-index.source-loader.js";
import type { SearchCandidate } from "../domain/report-retrieval.types.js";
import { buildSemanticInput } from "../domain/semantic-input.js";
import { SemanticIndexProcessor } from "./semantic-index.processor.js";
import type { SemanticIndexJobData } from "./semantic-index.queue.js";

const scope = {
  provider: "mistral",
  embeddingScopeIdentity: "embedding-identity",
  model: "mistral-embed",
  inputVersion: "report-assistant/v1",
  dimensions: 3,
} as const;

const revisionId = "revision-2026-08-10";

const candidate = (text: string): SearchCandidate => ({
  kind: "item",
  identity: {
    occurrenceId: "report-1:section-1:item:item-1",
    recordId: "item-1",
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

type Harness = Readonly<{
  processor: TestableSemanticIndexProcessor;
  load: Mock<SemanticIndexSourceLoader["load"]>;
  embedDocuments: Mock<EmbeddingPort["embedDocuments"]>;
  upsert: Mock<SemanticEmbeddingRepository["upsert"]>;
  resolveRuntime: Mock;
}>;

class TestableSemanticIndexProcessor extends SemanticIndexProcessor {
  run(data: SemanticIndexJobData): Promise<void> {
    return this.processJob({ data } as Job<SemanticIndexJobData>);
  }
}

const createHarness = (
  loadedCandidate: SearchCandidate | null,
  providerFailure?: Error,
): Harness => {
  const load = vi
    .fn<SemanticIndexSourceLoader["load"]>()
    .mockResolvedValue(loadedCandidate);
  const embedDocuments = vi
    .fn<EmbeddingPort["embedDocuments"]>()
    .mockImplementation((documents) => {
      if (providerFailure) return Promise.reject(providerFailure);
      return Promise.resolve(
        documents.map(({ contentHash }) => ({
          contentHash,
          vector: [1, 0, 0],
        })),
      );
    });
  const upsert = vi
    .fn<SemanticEmbeddingRepository["upsert"]>()
    .mockResolvedValue(undefined);
  const resolveRuntime = vi.fn().mockResolvedValue({
    embeddings: {
      embedQuery: vi.fn().mockResolvedValue([1, 0, 0]),
      embedDocuments,
    },
    scope,
  });
  const processor = new TestableSemanticIndexProcessor(
    { load },
    { findCachedHashes: vi.fn(), upsert, rank: vi.fn() },
    { resolveRuntime },
    {} as never,
    {} as never,
    null,
  );
  return { processor, load, embedDocuments, upsert, resolveRuntime };
};

const jobData = (expectedContentHash: string): SemanticIndexJobData => ({
  source: "live",
  reportId: "report-1",
  sectionId: "section-1",
  occurrenceId: "report-1:section-1:item:item-1",
  recordKind: "item",
  recordId: "item-1",
  expectedContentHash,
  configurationRevisionId: revisionId,
  scope,
});

describe("SemanticIndexProcessor", () => {
  it("reloads canonical content and idempotently upserts an unchanged hash", async () => {
    const loaded = candidate("Fresh draft text");
    const hash =
      buildSemanticInput(loaded, scope.inputVersion)?.contentHash ?? "";
    const harness = createHarness(loaded);

    await harness.processor.run(jobData(hash));
    await harness.processor.run(jobData(hash));

    expect(harness.load).toHaveBeenCalledWith(jobData(hash));
    expect(harness.embedDocuments).toHaveBeenCalledTimes(2);
    expect(harness.upsert).toHaveBeenNthCalledWith(1, {
      ...scope,
      contentHash: hash,
      vector: [1, 0, 0],
    });
    expect(harness.upsert).toHaveBeenNthCalledWith(2, {
      ...scope,
      contentHash: hash,
      vector: [1, 0, 0],
    });
  });

  it("completes changed and deleted sources without persisting an embedding", async () => {
    const changed = candidate("Changed after enqueue");
    const oldHash =
      buildSemanticInput(candidate("Old queued text"), scope.inputVersion)
        ?.contentHash ?? "";
    const changedHarness = createHarness(changed);
    const deletedHarness = createHarness(null);

    await changedHarness.processor.run(jobData(oldHash));
    await deletedHarness.processor.run(jobData(oldHash));

    expect(changedHarness.embedDocuments).not.toHaveBeenCalled();
    expect(changedHarness.upsert).not.toHaveBeenCalled();
    expect(deletedHarness.embedDocuments).not.toHaveBeenCalled();
    expect(deletedHarness.upsert).not.toHaveBeenCalled();
  });

  it("surfaces provider failures so BullMQ retry policy can apply", async () => {
    const loaded = candidate("Retry this");
    const hash =
      buildSemanticInput(loaded, scope.inputVersion)?.contentHash ?? "";
    const failure = new Error("provider unavailable");
    const harness = createHarness(loaded, failure);

    await expect(harness.processor.run(jobData(hash))).rejects.toBe(failure);
    expect(harness.upsert).not.toHaveBeenCalled();
  });

  it("resolves the exact revision named by a runtime job", async () => {
    const loaded = candidate("Revision-bound content");
    const hash =
      buildSemanticInput(loaded, scope.inputVersion)?.contentHash ?? "";
    const harness = createHarness(loaded);
    const data = {
      ...jobData(hash),
      configurationRevisionId: revisionId,
      scope,
    };

    await harness.processor.run(data);

    expect(harness.resolveRuntime).toHaveBeenCalledWith(revisionId);
    expect(harness.upsert).toHaveBeenCalledWith({
      ...scope,
      contentHash: hash,
      vector: [1, 0, 0],
    });
  });

  it("rejects a job whose stored scope differs from its resolved revision", async () => {
    const loaded = candidate("Scope mismatch");
    const hash =
      buildSemanticInput(loaded, scope.inputVersion)?.contentHash ?? "";
    const harness = createHarness(loaded);

    await expect(
      harness.processor.run({
        ...jobData(hash),
        configurationRevisionId: revisionId,
        scope: { ...scope, dimensions: 4 },
      }),
    ).rejects.toThrow("scope does not match");
    expect(harness.load).not.toHaveBeenCalled();
  });

  it("rejects a malformed job without a scope identity", async () => {
    const loaded = candidate("Missing scope identity");
    const hash =
      buildSemanticInput(loaded, scope.inputVersion)?.contentHash ?? "";
    const harness = createHarness(loaded);

    await expect(
      harness.processor.run({
        ...jobData(hash),
        scope: { ...scope, embeddingScopeIdentity: undefined },
      } as unknown as SemanticIndexJobData),
    ).rejects.toThrow("job data is invalid");
    expect(harness.resolveRuntime).not.toHaveBeenCalled();
    expect(harness.load).not.toHaveBeenCalled();
  });
});
