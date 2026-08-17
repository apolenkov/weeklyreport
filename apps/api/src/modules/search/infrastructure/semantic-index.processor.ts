import { Injectable } from "@nestjs/common";
import type { Job } from "bullmq";
import type { ClsService } from "nestjs-cls";

import { RawBullMqProcessor } from "../../../infrastructure/bullmq/raw-bullmq-processor.js";
import type { EnvConfig } from "../../../infrastructure/config/env.schema";
import type { AppLogger } from "../../../lib/logger.js";
import type { EmbeddingPort } from "../application/report-assistant.ports.js";
import type {
  SemanticEmbeddingRepository,
  SemanticEmbeddingScope,
} from "../application/semantic-embedding.repository.js";
import type { SemanticIndexSourceLoader } from "../application/semantic-index.source-loader.js";
import { buildSemanticInput } from "../domain/semantic-input.js";
import {
  SEMANTIC_INDEX_QUEUE_NAME,
  type SemanticIndexJobData,
} from "./semantic-index.queue.js";

export type SemanticIndexProcessorConfig = Readonly<{
  resolveRuntime: (
    revisionId: string,
  ) => Promise<
    Readonly<{ embeddings: EmbeddingPort; scope: SemanticEmbeddingScope }>
  >;
}>;

const embeddingFor = async (
  embeddings: EmbeddingPort,
  contentHash: string,
  text: string,
): Promise<readonly number[]> => {
  const documents = await embeddings.embedDocuments([{ contentHash, text }]);
  const document = documents.length === 1 ? documents[0] : undefined;
  if (document?.contentHash !== contentHash) {
    throw new Error("Embedding provider returned an invalid semantic document");
  }
  return document.vector;
};

@Injectable()
export class SemanticIndexProcessor extends RawBullMqProcessor<SemanticIndexJobData> {
  protected readonly queueName = SEMANTIC_INDEX_QUEUE_NAME;
  protected readonly spanName = "semantic-index.process";

  constructor(
    private readonly sourceLoader: SemanticIndexSourceLoader,
    private readonly repository: SemanticEmbeddingRepository,
    private readonly config: SemanticIndexProcessorConfig,
    env: EnvConfig,
    logger?: AppLogger,
    cls?: ClsService,
  ) {
    super(env, logger, cls);
  }

  protected onJobFailed(
    job: Job<SemanticIndexJobData> | undefined,
    error: Error,
  ): void {
    this.logger.error("semantic-index job failed", {
      attempt: job?.attemptsMade,
      error: error.message,
    });
  }

  protected async processJob(job: Job<SemanticIndexJobData>): Promise<void> {
    const runtime = await this.config.resolveRuntime(
      job.data.configurationRevisionId,
    );
    const scope = runtime.scope;
    const scopeMismatch =
      (job.data.scope.embeddingScopeIdentity !== undefined &&
        scope.embeddingScopeIdentity !== undefined &&
        job.data.scope.embeddingScopeIdentity !==
          scope.embeddingScopeIdentity) ||
      job.data.scope.provider !== scope.provider ||
      job.data.scope.model !== scope.model ||
      job.data.scope.inputVersion !== scope.inputVersion ||
      job.data.scope.dimensions !== scope.dimensions;
    if (scopeMismatch) {
      throw new Error("Semantic index job scope does not match its runtime");
    }
    const candidate = await this.sourceLoader.load(job.data);
    if (!candidate) return;
    const input = buildSemanticInput(candidate, scope.inputVersion);
    if (input?.contentHash !== job.data.expectedContentHash) return;
    const vector = await embeddingFor(
      runtime.embeddings,
      input.contentHash,
      input.text,
    );
    await this.repository.upsert({
      ...scope,
      contentHash: input.contentHash,
      vector,
    });
  }
}
