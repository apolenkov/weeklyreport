import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";

import { ENV_CONFIG } from "../../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../../infrastructure/config/env.schema.js";
import type {
  AiProviderPreparationCoordinator,
  StoredAiProviderRevision,
} from "../../ai-provider/index.js";
import { ReportSearchPrismaRepository } from "../infrastructure/report-search.prisma-repository.js";
import { SemanticEmbeddingPrismaRepository } from "../infrastructure/semantic-embedding.prisma-repository.js";
import {
  AiRuntimeResolver,
  type AiRuntimeResolverPort,
} from "./ai-runtime.resolver.js";
import type { EmbeddingPort } from "./report-assistant.ports.js";
import type { ReportSearchRepository } from "./report-search.repository.js";
import type {
  SemanticEmbeddingRepository,
  SemanticEmbeddingScope,
} from "./semantic-embedding.repository.js";
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

type PreparationContext = Readonly<{
  embeddings: EmbeddingPort;
  scope: SemanticEmbeddingScope;
  startedAt: number;
  onProgress: ProgressSink;
}>;

@Injectable()
export class SemanticPreparationCoordinator implements AiProviderPreparationCoordinator {
  private readonly batchSize: number;
  private readonly batchConcurrency = 2;

  constructor(
    @Inject(ReportSearchPrismaRepository)
    private readonly reports: ReportSearchRepository,
    @Inject(AiRuntimeResolver)
    private readonly embeddings: AiRuntimeResolverPort,
    @Inject(SemanticEmbeddingPrismaRepository)
    private readonly semanticRepository: SemanticEmbeddingRepository,
    @Inject(SEMANTIC_INDEX_ENQUEUER)
    private readonly enqueuer: SemanticIndexEnqueuer,
    @Inject(ENV_CONFIG)
    env: Pick<EnvConfig, "REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE">,
  ) {
    this.batchSize = env.REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE;
  }

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
      {
        embeddings: runtime.embeddings,
        scope: runtime.scope,
        startedAt,
        onProgress,
      },
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
    context: PreparationContext,
    attempt: number,
    sourceGeneration: bigint,
  ): Promise<PreparationResult> {
    const { scope, startedAt } = context;
    const documents = await this.collect(revision.semanticInputVersion);
    const result = await this.embedMissing(documents, revision.id, context);
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
      context,
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
    { scope, embeddings, startedAt, onProgress }: PreparationContext,
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
