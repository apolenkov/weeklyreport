import type { JobEnqueuer } from "../../../infrastructure/bullmq/job-enqueuer.js";
import {
  SEMANTIC_INDEX_JOB_NAME,
  SEMANTIC_INDEX_JOB_OPTS,
  SEMANTIC_INDEX_QUEUE_NAME,
} from "../../../infrastructure/bullmq/semantic-index-queue-contract.js";
import type { JobTraceContext } from "../../../infrastructure/bullmq/worker-observability.js";
import type { SemanticIndexEnqueuer } from "../application/semantic-index.enqueuer.js";
import type { SemanticIndexRuntimeContext } from "../application/semantic-index.enqueuer.js";
import type { SemanticIndexLocator } from "../application/semantic-index.source-loader.js";

export type { SemanticIndexLocator } from "../application/semantic-index.source-loader.js";

export {
  SEMANTIC_INDEX_JOB_NAME,
  SEMANTIC_INDEX_JOB_OPTS,
  SEMANTIC_INDEX_QUEUE_NAME,
};

export type SemanticIndexJobData = SemanticIndexLocator &
  JobTraceContext &
  Readonly<{
    configurationRevisionId: string;
    scope: SemanticIndexRuntimeContext["scope"];
  }>;

const jobIdPart = (value: string): string => encodeURIComponent(value);

export const semanticIndexJobId = (
  scope: SemanticIndexRuntimeContext["scope"],
  expectedContentHash: string,
  configurationRevisionId: string,
): string =>
  [
    SEMANTIC_INDEX_QUEUE_NAME,
    configurationRevisionId,
    scope.provider,
    scope.model,
    scope.inputVersion,
    String(scope.dimensions),
    expectedContentHash,
  ]
    .map(jobIdPart)
    .join(":");

export class SemanticIndexBullmqEnqueuer implements SemanticIndexEnqueuer {
  constructor(private readonly queue: JobEnqueuer) {}

  async enqueue(
    input: SemanticIndexLocator,
    context: SemanticIndexRuntimeContext,
  ): Promise<void> {
    const data = { ...input, ...context };
    await this.queue.add(SEMANTIC_INDEX_JOB_NAME, data, {
      attempts: SEMANTIC_INDEX_JOB_OPTS.attempts,
      backoff: SEMANTIC_INDEX_JOB_OPTS.backoff,
      jobId: semanticIndexJobId(
        context.scope,
        input.expectedContentHash,
        context.configurationRevisionId,
      ),
    });
  }
}
