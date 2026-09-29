import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";

import type {
  AiProviderPreparationCoordinator,
  StoredAiProviderRevision,
} from "../../ai-provider/index.js";
import {
  AiRuntimeResolver,
  type AiRuntimeResolverPort,
} from "./ai-runtime.resolver.js";
import type { EmbeddingPort } from "./report-assistant.ports.js";
import type { ReportSearchRepository } from "./report-search.repository.js";
import { REPORT_SEARCH_REPOSITORY } from "./report-search.repository.js";
import type {
  SemanticEmbeddingRepository,
  SemanticEmbeddingScope,
} from "./semantic-embedding.repository.js";
import { SEMANTIC_EMBEDDING_REPOSITORY } from "./semantic-embedding.repository.js";
import {
  SEMANTIC_INDEX_ENQUEUER,
  type SemanticIndexEnqueuer,
} from "./semantic-index.enqueuer.js";
import {
  chunks,
  completeBatch,
  mapWithConcurrency,
  type PreparationDocument,
  reconcile,
  sameScope,
  semanticDocuments,
} from "./semantic-preparation.documents.js";

const SEMANTIC_PREPARATION_BATCH_SIZE = Symbol(
  "SEMANTIC_PREPARATION_BATCH_SIZE",
);
const SEMANTIC_PREPARATION_BATCH_CONCURRENCY = Symbol(
  "SEMANTIC_PREPARATION_BATCH_CONCURRENCY",
);

type PreparationResult = Readonly<{
  completed: number;
  total: number;
  failed: number;
  elapsedMs: number;
  sourceFingerprint: string;
  sourceGeneration: bigint;
}>;

const sourceFingerprint = (documents: readonly PreparationDocument[]): string =>
  createHash("sha256")
    .update(
      documents
        .map(({ input }) => input.contentHash)
        .sort((left, right) => left.localeCompare(right))
        .join("\n"),
    )
    .digest("hex");

type ProgressSink = (
  progress: Readonly<{
    completed: number;
    total: number;
    failed: number;
    elapsedMs: number;
  }>,
) => Promise<void>;

@Injectable()
export class SemanticPreparationCoordinator implements AiProviderPreparationCoordinator {
  constructor(
    @Inject(REPORT_SEARCH_REPOSITORY)
    private readonly reports: ReportSearchRepository,
    @Inject(AiRuntimeResolver)
    private readonly embeddings: AiRuntimeResolverPort,
    @Inject(SEMANTIC_EMBEDDING_REPOSITORY)
    private readonly semanticRepository: SemanticEmbeddingRepository,
    @Inject(SEMANTIC_INDEX_ENQUEUER)
    private readonly enqueuer: SemanticIndexEnqueuer,
    @Inject(SEMANTIC_PREPARATION_BATCH_SIZE)
    private readonly batchSize: number,
    @Inject(SEMANTIC_PREPARATION_BATCH_CONCURRENCY)
    private readonly batchConcurrency = 2,
  ) {}

  async prepare(
    revision: StoredAiProviderRevision,
    _previous: StoredAiProviderRevision | null,
    onProgress: ProgressSink = () => Promise.resolve(),
  ): Promise<PreparationResult> {
    const startedAt = Date.now();
    const sourceGeneration = await this.reports.getSourceGeneration();
    const runtime = await this.embeddings.resolveExact(revision.id);
    if (!sameScope(runtime.scope, this.scopeOf(revision))) {
      throw new Error("Preparation runtime scope does not match the revision");
    }
    return this.prepareAttempt(
      revision,
      runtime.embeddings,
      runtime.scope,
      startedAt,
      onProgress,
      0,
      sourceGeneration,
    );
  }

  async currentSourceFingerprint(
    revision: StoredAiProviderRevision,
  ): Promise<string> {
    return sourceFingerprint(await this.collect(revision.semanticInputVersion));
  }

  private async prepareAttempt(
    revision: StoredAiProviderRevision,
    embeddings: EmbeddingPort,
    scope: SemanticEmbeddingScope,
    startedAt: number,
    onProgress: ProgressSink,
    attempt: number,
    sourceGeneration: bigint,
  ): Promise<PreparationResult> {
    const documents = await this.collect(revision.semanticInputVersion);
    const result = await this.embedMissing(
      documents,
      revision.id,
      scope,
      embeddings,
      startedAt,
      onProgress,
    );
    const current = await this.collect(revision.semanticInputVersion);
    const currentSourceGeneration = await this.reports.getSourceGeneration();
    if (
      result.failed === 0 &&
      reconcile(documents, current) &&
      currentSourceGeneration === sourceGeneration
    ) {
      return {
        ...result,
        sourceFingerprint: sourceFingerprint(current),
        sourceGeneration,
      };
    }
    if (attempt >= 2) {
      const currentCached = new Set(
        await this.semanticRepository.findCachedHashes(
          scope,
          current.map(({ input }) => input.contentHash),
        ),
      );
      const completed = current.filter(({ input }) =>
        currentCached.has(input.contentHash),
      ).length;
      return {
        completed,
        total: current.length,
        failed: Math.max(1, current.length - completed),
        elapsedMs: Math.max(0, Date.now() - startedAt),
        sourceFingerprint: sourceFingerprint(current),
        sourceGeneration: currentSourceGeneration,
      };
    }
    return this.prepareAttempt(
      revision,
      embeddings,
      scope,
      startedAt,
      onProgress,
      attempt + 1,
      currentSourceGeneration,
    );
  }

  private async collect(
    inputVersion: string,
  ): Promise<readonly PreparationDocument[]> {
    // Preparation must cover the complete available published corpus. The
    // repository keeps the result bounded and fails closed when that safety
    // cap is exceeded.
    const sources = await this.reports.listSources({ publishedMode: "all" });
    const occurrences = await this.reports.loadOccurrences(sources);
    return semanticDocuments(occurrences, inputVersion);
  }

  private async embedMissing(
    documents: readonly PreparationDocument[],
    revisionId: string,
    scope: SemanticEmbeddingScope,
    embeddings: EmbeddingPort,
    startedAt: number,
    onProgress: ProgressSink,
  ): Promise<PreparationResult> {
    const hashes = documents.map(({ input }) => input.contentHash);
    const cached = new Set(
      await this.semanticRepository.findCachedHashes(scope, hashes),
    );
    const missing = documents.filter(
      ({ input }) => !cached.has(input.contentHash),
    );
    const total = documents.length;
    const initial = {
      completed: cached.size,
      total,
      failed: 0,
      elapsedMs: Math.max(0, Date.now() - startedAt),
      sourceFingerprint: sourceFingerprint(documents),
      sourceGeneration: await this.reports.getSourceGeneration(),
    };
    await onProgress(initial);
    const results = await mapWithConcurrency(
      chunks(missing, this.batchSize),
      this.batchConcurrency,
      (batch) =>
        this.embedBatch(batch, scope, embeddings).catch(() =>
          Promise.allSettled(
            batch.map(({ locator }) =>
              this.enqueuer.enqueue(locator, {
                configurationRevisionId: revisionId,
                scope,
              }),
            ),
          ).then(() => ({ completed: 0, failed: batch.length })),
        ),
    );
    const completed =
      initial.completed +
      results.reduce((sum, result) => sum + result.completed, 0);
    const failed = results.reduce((sum, result) => sum + result.failed, 0);
    const progress = {
      completed,
      total,
      failed,
      elapsedMs: Math.max(0, Date.now() - startedAt),
    };
    await onProgress(progress);
    return {
      ...progress,
      sourceFingerprint: sourceFingerprint(documents),
      sourceGeneration: await this.reports.getSourceGeneration(),
    };
  }

  private async embedBatch(
    batch: readonly PreparationDocument[],
    scope: SemanticEmbeddingScope,
    embeddings: EmbeddingPort,
  ): Promise<Readonly<{ completed: number; failed: number }>> {
    const documents = await embeddings.embedDocuments(
      batch.map(({ input }) => ({
        contentHash: input.contentHash,
        text: input.text,
      })),
    );
    if (!completeBatch(batch, documents)) {
      throw new Error("Embedding preparation returned an incomplete batch");
    }
    await Promise.all(
      documents.map(({ contentHash, vector }) =>
        this.semanticRepository.upsert({ ...scope, contentHash, vector }),
      ),
    );
    return { completed: batch.length, failed: 0 };
  }

  private scopeOf(revision: StoredAiProviderRevision): SemanticEmbeddingScope {
    if (revision.embeddingDimensions === null) {
      throw new Error(
        "AI provider embedding dimensions have not been measured",
      );
    }
    return {
      embeddingScopeIdentity: revision.embeddingScopeIdentity,
      provider:
        revision.embeddingMode === "reuse_generation"
          ? revision.generationEndpointIdentity
          : requiredEmbeddingEndpoint(revision.embeddingEndpointIdentity),
      model: revision.embeddingModel,
      inputVersion: revision.semanticInputVersion,
      dimensions: revision.embeddingDimensions,
    };
  }
}

const requiredEmbeddingEndpoint = (value: string | null): string => {
  if (value === null) {
    throw new Error("Separate embedding endpoint is not configured");
  }
  return value;
};
