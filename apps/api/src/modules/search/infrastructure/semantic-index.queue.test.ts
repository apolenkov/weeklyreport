import { describe, expect, it, vi } from "vitest";

import {
  SEMANTIC_INDEX_JOB_NAME,
  SEMANTIC_INDEX_JOB_OPTS,
  SEMANTIC_INDEX_QUEUE_NAME,
  SemanticIndexBullmqEnqueuer,
  semanticIndexJobId,
} from "./semantic-index.queue.js";

const scope = {
  provider: "mistral",
  model: "mistral-embed",
  inputVersion: "report-assistant/v1",
  dimensions: 1024,
} as const;

const runtimeContext = {
  configurationRevisionId: "revision-2026-08-10",
  scope,
} as const;

const locator = {
  source: "live" as const,
  reportId: "report-1",
  sectionId: "section-1",
  occurrenceId: "occurrence-1",
  recordKind: "item" as const,
  recordId: "item-1",
  expectedContentHash: "hash-1",
};

describe("semantic index queue", () => {
  it("has one explicit queue name and retry policy", () => {
    expect(SEMANTIC_INDEX_QUEUE_NAME).toBe("semantic-index");
    expect(SEMANTIC_INDEX_JOB_NAME).toBe("embed");
    expect(SEMANTIC_INDEX_JOB_OPTS).toEqual({
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 500 },
    });
  });

  it("deduplicates by revision, model scope, and expected hash", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const enqueuer = new SemanticIndexBullmqEnqueuer({ add });

    await enqueuer.enqueue(locator, runtimeContext);
    await enqueuer.enqueue(locator, runtimeContext);

    expect(add).toHaveBeenNthCalledWith(
      1,
      SEMANTIC_INDEX_JOB_NAME,
      { ...locator, ...runtimeContext },
      {
        attempts: SEMANTIC_INDEX_JOB_OPTS.attempts,
        backoff: SEMANTIC_INDEX_JOB_OPTS.backoff,
        jobId: semanticIndexJobId(
          scope,
          locator.expectedContentHash,
          runtimeContext.configurationRevisionId,
        ),
      },
    );
    expect(add.mock.calls[0]?.[2]).toEqual(add.mock.calls[1]?.[2]);
    expect(add.mock.calls[0]?.[1]).not.toHaveProperty("text");
    expect(add.mock.calls[0]?.[1]).not.toHaveProperty("vector");
  });

  it("changes the job id when the active embedding model changes", () => {
    const otherScope = { ...scope, model: "mistral-embed-v2" };

    expect(
      semanticIndexJobId(
        scope,
        "hash-1",
        runtimeContext.configurationRevisionId,
      ),
    ).not.toBe(
      semanticIndexJobId(
        otherScope,
        "hash-1",
        runtimeContext.configurationRevisionId,
      ),
    );
  });

  it("includes the exact configuration revision and scope in runtime jobs", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const enqueuer = new SemanticIndexBullmqEnqueuer({ add });

    await enqueuer.enqueue(locator, runtimeContext);

    expect(add).toHaveBeenCalledWith(
      SEMANTIC_INDEX_JOB_NAME,
      { ...locator, ...runtimeContext },
      expect.objectContaining({
        jobId: semanticIndexJobId(
          scope,
          locator.expectedContentHash,
          runtimeContext.configurationRevisionId,
        ),
      }),
    );
  });
});
