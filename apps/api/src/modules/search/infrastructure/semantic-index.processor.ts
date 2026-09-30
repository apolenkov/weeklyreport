import { Inject, Injectable } from "@nestjs/common";
import { type Job, UnrecoverableError } from "bullmq";
import { ClsService } from "nestjs-cls";

import { RawBullMqProcessor } from "../../../infrastructure/bullmq/raw-bullmq-processor.js";
import { WorkerLivenessRegistry } from "../../../infrastructure/bullmq/worker-liveness.registry.js";
import { ENV_CONFIG } from "../../../infrastructure/config/config.module.js";
import type { EnvConfig } from "../../../infrastructure/config/env.schema";
import { APP_LOGGER } from "../../../lib/audit-logger.js";
import type { AppLogger } from "../../../lib/logger.js";
import {
  AiRuntimeResolver,
  type AiRuntimeResolverPort,
} from "../application/ai-runtime.resolver.js";
import type { EmbeddingPort } from "../application/report-assistant.ports.js";
import type { SemanticEmbeddingRepository } from "../application/semantic-embedding.repository.js";
import type { SemanticIndexSourceLoader } from "../application/semantic-index.source-loader.js";
import { buildSemanticInput } from "../domain/semantic-input.js";
import { SemanticEmbeddingPrismaRepository } from "./semantic-embedding.prisma-repository.js";
import {
  SEMANTIC_INDEX_QUEUE_NAME,
  type SemanticIndexJobData,
  semanticIndexJobDataSchema,
} from "./semantic-index.queue.js";
import { SemanticIndexPrismaSourceLoader } from "./semantic-index.source.prisma-loader.js";

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
    @Inject(SemanticIndexPrismaSourceLoader)
    private readonly sourceLoader: SemanticIndexSourceLoader,
    @Inject(SemanticEmbeddingPrismaRepository)
    private readonly repository: SemanticEmbeddingRepository,
    @Inject(AiRuntimeResolver)
    private readonly runtimeResolver: Pick<
      AiRuntimeResolverPort,
      "resolveExact"
    >,
    @Inject(ENV_CONFIG) env: EnvConfig,
    @Inject(APP_LOGGER) logger: AppLogger,
    @Inject(ClsService) cls: ClsService | null,
    @Inject(WorkerLivenessRegistry)
    workerLiveness?: WorkerLivenessRegistry,
  ) {
    super(env, logger, cls, workerLiveness);
  }

  protected readonly onJobFailed = (
    job: Job<SemanticIndexJobData> | undefined,
    error: Error,
  ): void => {
    this.logger.error("semantic-index job failed", {
      attempt: job?.attemptsMade,
      error: error.message,
    });
  };

  protected readonly processJob = async (
    rawJob: Job<SemanticIndexJobData>,
  ): Promise<void> => {
    const parsed = semanticIndexJobDataSchema.safeParse(rawJob.data);
    if (!parsed.success) {
      throw new UnrecoverableError("Semantic index job data is invalid");
    }
    const job = { data: parsed.data };
    const runtime = await this.runtimeResolver.resolveExact(
      job.data.configurationRevisionId,
    );
    const scope = runtime.scope;
    const scopeMismatch =
      job.data.scope.embeddingScopeIdentity !== scope.embeddingScopeIdentity ||
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
  };
}
