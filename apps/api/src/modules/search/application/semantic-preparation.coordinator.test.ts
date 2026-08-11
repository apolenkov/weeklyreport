import type { ReportSectionReadModel } from "@customreport/shared";
import { AiProviderLifecycle, AiProviderProfile } from "@prisma/client";
import { describe, expect, it, type Mock, vi } from "vitest";

import type { StoredAiProviderRevision } from "../../ai-provider/infrastructure/ai-provider.repository.js";
import type { EmbeddingPort } from "./report-assistant.ports.js";
import type { ReportSearchRepository } from "./report-search.repository.js";
import type { SemanticEmbeddingRepository } from "./semantic-embedding.repository.js";
import type { SemanticIndexEnqueuer } from "./semantic-index.enqueuer.js";
import { SemanticPreparationCoordinator } from "./semantic-preparation.coordinator.js";

const REPORT_ID = "report-1";
const SECTION_ID = "section-1";
const PRODUCT_ID = "product-1";
const INPUT_VERSION = "report-assistant/v1";
const scope = {
  provider: "mistral:stable-endpoint",
  model: "mistral-embed",
  inputVersion: INPUT_VERSION,
  dimensions: 3,
} as const;

const section = (): ReportSectionReadModel => ({
  reportSectionId: SECTION_ID,
  reportId: REPORT_ID,
  authorId: "author-1",
  authorName: "Alice Lead",
  version: 1,
  status: "draft",
  submittedAt: null,
  projects: [
    {
      projectId: PRODUCT_ID,
      projectName: "CRM Portal",
      trafficLight: "green",
      ownedStages: [],
    },
  ],
  items: [
    {
      id: "item-1",
      stableId: "item-lineage-1",
      projectId: PRODUCT_ID,
      type: "current",
      text: "Ship the release",
      tag: "release",
      workflowStatus: "in_progress",
      carriedOver: false,
      priorityRank: 1,
      stageIds: [],
    },
  ],
  risks: [],
  decisions: [],
  activities: [],
});

const source = {
  reportId: REPORT_ID,
  periodId: "period-1",
  periodLabel: "Week 32",
  periodStart: new Date("2026-08-03T00:00:00.000Z"),
  periodStatus: "open" as const,
  source: "live" as const,
};

const revision = (): StoredAiProviderRevision => ({
  id: "revision-1",
  profile: AiProviderProfile.mistral,
  baseUrl: "https://api.mistral.ai/v1",
  endpointIdentity: scope.provider,
  plannerModel: "planner",
  answerModel: "answer",
  embeddingModel: scope.model,
  embeddingDimensions: scope.dimensions,
  semanticInputVersion: INPUT_VERSION,
  credentialCiphertext: "ciphertext",
  credentialNonce: "nonce",
  credentialTag: "tag",
  credentialKeyVersion: 1,
  credentialMaskedSuffix: "••••abcd",
  lifecycle: AiProviderLifecycle.validated,
  testResult: null,
  testedAt: null,
  preparationCompleted: 0,
  preparationTotal: 0,
  preparationFailed: 0,
  preparationStartedAt: null,
  preparationFinishedAt: null,
  preparationElapsedMs: 0,
  activatedAt: null,
  supersededAt: null,
  createdAt: new Date("2026-08-10T00:00:00.000Z"),
  updatedAt: new Date("2026-08-10T00:00:00.000Z"),
});

type Harness = Readonly<{
  coordinator: SemanticPreparationCoordinator;
  embedDocuments: Mock<EmbeddingPort["embedDocuments"]>;
  findCachedHashes: Mock<SemanticEmbeddingRepository["findCachedHashes"]>;
  upsert: Mock<SemanticEmbeddingRepository["upsert"]>;
  enqueue: Mock<SemanticIndexEnqueuer["enqueue"]>;
  progress: Readonly<{ completed: number; total: number; failed: number }>[];
}>;

type PreparationProgress = Readonly<{
  completed: number;
  total: number;
  failed: number;
  elapsedMs: number;
}>;

const createHarness = (providerFailure = false): Harness => {
  const progress: {
    completed: number;
    total: number;
    failed: number;
  }[] = [];
  const embedDocuments = vi.fn<EmbeddingPort["embedDocuments"]>();
  embedDocuments.mockImplementation((documents) =>
    providerFailure
      ? Promise.reject(new Error("provider unavailable"))
      : Promise.resolve(
          documents.map(({ contentHash }) => ({
            contentHash,
            vector: [0.1, 0.2, 0.3],
          })),
        ),
  );
  const findCachedHashes = vi
    .fn<SemanticEmbeddingRepository["findCachedHashes"]>()
    .mockResolvedValue([]);
  const upsert = vi
    .fn<SemanticEmbeddingRepository["upsert"]>()
    .mockResolvedValue(undefined);
  const enqueue = vi
    .fn<SemanticIndexEnqueuer["enqueue"]>()
    .mockResolvedValue(undefined);
  const reports: ReportSearchRepository = {
    hasOwnSection: vi.fn().mockResolvedValue(false),
    getSharedNonArchivedProductIds: vi.fn().mockResolvedValue([]),
    listSources: vi.fn().mockResolvedValue([source]),
    loadOccurrences: vi.fn().mockResolvedValue([
      {
        reportId: REPORT_ID,
        periodId: source.periodId,
        periodLabel: source.periodLabel,
        periodStart: source.periodStart,
        source: source.source,
        sections: [section()],
      },
    ]),
  };
  const embeddings = {
    resolveExact: vi.fn().mockResolvedValue({
      revisionId: "revision-1",
      embeddings: {
        embedQuery: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
        embedDocuments,
      },
      scope,
    }),
  };
  const semanticRepository: SemanticEmbeddingRepository = {
    findCachedHashes,
    upsert,
    rank: vi.fn(),
  };
  const coordinator = new SemanticPreparationCoordinator(
    reports,
    embeddings as never,
    semanticRepository,
    { enqueue },
    2,
  );
  return {
    coordinator,
    embedDocuments,
    findCachedHashes,
    upsert,
    enqueue,
    progress,
  };
};

describe("SemanticPreparationCoordinator", () => {
  it("enumerates canonical report content, embeds missing hashes, and reports progress", async () => {
    const harness = createHarness();

    const result = await harness.coordinator.prepare(
      revision(),
      null,
      (value: PreparationProgress) => {
        harness.progress.push({
          completed: value.completed,
          total: value.total,
          failed: value.failed,
        });
        return Promise.resolve();
      },
    );

    expect(result).toMatchObject({ completed: 1, total: 1, failed: 0 });
    expect(harness.findCachedHashes).toHaveBeenCalledWith(scope, [
      expect.any(String),
    ]);
    const embedded = harness.embedDocuments.mock.calls[0]?.[0] ?? [];
    expect(embedded).toHaveLength(1);
    expect(embedded[0]?.text).toBe("Ship the release");
    const upserted = harness.upsert.mock.calls[0]?.[0];
    expect(upserted).toMatchObject({
      ...scope,
      vector: [0.1, 0.2, 0.3],
    });
    expect(harness.progress).toEqual([
      { completed: 0, total: 1, failed: 0 },
      { completed: 1, total: 1, failed: 0 },
    ]);
  });

  it("queues failed batches against the exact revision for retry", async () => {
    const harness = createHarness(true);

    const result = await harness.coordinator.prepare(revision(), null);

    expect(result).toMatchObject({ completed: 0, total: 1, failed: 1 });
    const queued = harness.enqueue.mock.calls[0];
    expect(queued?.[0]).toMatchObject({ reportId: REPORT_ID });
    expect(queued?.[1]).toEqual({
      configurationRevisionId: "revision-1",
      scope,
    });
    expect(harness.upsert).not.toHaveBeenCalled();
  });
});
