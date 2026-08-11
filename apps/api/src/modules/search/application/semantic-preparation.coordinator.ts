import { Injectable } from "@nestjs/common";

import type {
  AiProviderPreparationCoordinator,
  StoredAiProviderRevision,
} from "../../ai-provider/index.js";
import type { AiRuntimeResolverPort } from "./ai-runtime.resolver.js";
import type { EmbeddingPort } from "./report-assistant.ports.js";
import type { ReportSearchRepository } from "./report-search.repository.js";
import type {
  SemanticEmbeddingRepository,
  SemanticEmbeddingScope,
} from "./semantic-embedding.repository.js";
import type { SemanticIndexEnqueuer } from "./semantic-index.enqueuer.js";
import {
  chunks,
  completeBatch,
  type PreparationDocument,
  reconcile,
  sameScope,
  semanticDocuments,
} from "./semantic-preparation.documents.js";

type PreparationResult = Readonly<{
  completed: number;
  total: number;
  failed: number;
  elapsedMs: number;
}>;

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
    private readonly reports: ReportSearchRepository,
    private readonly embeddings: AiRuntimeResolverPort,
    private readonly semanticRepository: SemanticEmbeddingRepository,
    private readonly enqueuer: SemanticIndexEnqueuer,
    private readonly batchSize: number,
  ) {}

  async prepare(
    revision: StoredAiProviderRevision,
    _previous: StoredAiProviderRevision | null,
    onProgress: ProgressSink = () => Promise.resolve(),
  ): Promise<PreparationResult> {
    const startedAt = Date.now();
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
    );
  }

  private async prepareAttempt(
    revision: StoredAiProviderRevision,
    embeddings: EmbeddingPort,
    scope: SemanticEmbeddingScope,
    startedAt: number,
    onProgress: ProgressSink,
    attempt: number,
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
    if (result.failed === 0 && reconcile(documents, current)) return result;
    if (attempt >= 2) {
      return {
        ...result,
        total: current.length,
        failed: Math.max(1, result.failed),
        elapsedMs: Math.max(0, Date.now() - startedAt),
      };
    }
    return this.prepareAttempt(
      revision,
      embeddings,
      scope,
      startedAt,
      onProgress,
      attempt + 1,
    );
  }

  private async collect(
    inputVersion: string,
  ): Promise<readonly PreparationDocument[]> {
    const sources = await this.reports.listSources();
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
    };
    await onProgress(initial);
    const results = await Promise.all(
      chunks(missing, this.batchSize).map((batch) =>
        this.embedBatch(batch, scope, embeddings).catch(() =>
          Promise.all(
            batch.map(({ locator }) =>
              this.enqueuer.enqueue(locator, {
                configurationRevisionId: revisionId,
                scope,
              }),
            ),
          ).then(() => ({ completed: 0, failed: batch.length })),
        ),
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
    return progress;
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
      provider: revision.endpointIdentity,
      model: revision.embeddingModel,
      inputVersion: revision.semanticInputVersion,
      dimensions: revision.embeddingDimensions,
    };
  }
}
