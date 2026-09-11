import { createHash } from "node:crypto";

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

const SEMANTIC_INDEX_JOB_ID_VERSION = "v1";

export const semanticIndexJobId = (
  locator: SemanticIndexLocator,
  context: SemanticIndexRuntimeContext,
): string => {
  const identity = JSON.stringify([
    SEMANTIC_INDEX_QUEUE_NAME,
    SEMANTIC_INDEX_JOB_ID_VERSION,
    context.configurationRevisionId,
    context.scope.embeddingScopeIdentity,
    context.scope.provider,
    context.scope.model,
    context.scope.inputVersion,
    context.scope.dimensions,
    locator.source,
    locator.reportId,
    locator.sectionId,
    locator.occurrenceId,
    locator.recordKind,
    locator.recordId,
    locator.expectedContentHash,
  ]);
  const digest = createHash("sha256").update(identity).digest("hex");
  return `semantic-index-${digest}`;
};

export class SemanticIndexBullmqEnqueuer implements SemanticIndexEnqueuer {
  constructor(private readonly queue: JobEnqueuer) {}

  async enqueue(
    input: SemanticIndexLocator,
    context: SemanticIndexRuntimeContext,
  ): Promise<void> {
    if (context.scope.embeddingScopeIdentity.trim().length === 0) {
      throw new Error("Semantic index scope identity is required");
    }
    const data = { ...input, ...context };
    const jobId = semanticIndexJobId(input, context);
    // BullMQ silently ignores an add whose jobId already exists, so a terminal
    // (failed/completed) job would permanently block re-indexing this content.
    // Remove the terminal job first, mirroring the reminders replacement path.
    if (this.queue.getJob) {
      const existing = await this.queue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (state === "failed" || state === "completed") {
          await existing.remove();
        }
      }
    }
    await this.queue.add(SEMANTIC_INDEX_JOB_NAME, data, {
      attempts: SEMANTIC_INDEX_JOB_OPTS.attempts,
      backoff: SEMANTIC_INDEX_JOB_OPTS.backoff,
      jobId,
    });
  }
}
