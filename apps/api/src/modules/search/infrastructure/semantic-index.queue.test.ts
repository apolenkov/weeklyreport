import { Job } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import type { SemanticIndexRuntimeContext } from "../application/semantic-index.enqueuer.js";
import type { SemanticIndexLocator } from "../application/semantic-index.source-loader.js";
import {
  SEMANTIC_INDEX_JOB_NAME,
  SEMANTIC_INDEX_JOB_OPTS,
  SEMANTIC_INDEX_QUEUE_NAME,
  SemanticIndexBullmqEnqueuer,
  semanticIndexJobId,
} from "./semantic-index.queue.js";

const scope = {
  provider: "mistral",
  embeddingScopeIdentity: "embedding-identity",
  model: "mistral-embed",
  inputVersion: "report-assistant/v1",
  dimensions: 1024,
} as const;

const runtimeContext: SemanticIndexRuntimeContext = {
  configurationRevisionId: "revision-2026-08-10",
  scope,
} as const;

const locator: SemanticIndexLocator = {
  source: "live",
  reportId: "report-1",
  sectionId: "section-1",
  occurrenceId: "occurrence-1",
  recordKind: "item",
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

  it("deduplicates only the same locator and runtime context", async () => {
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
        jobId: semanticIndexJobId(locator, runtimeContext),
      },
    );
    expect(add.mock.calls[0]?.[2]).toEqual(add.mock.calls[1]?.[2]);
    expect(add.mock.calls[0]?.[1]).not.toHaveProperty("text");
    expect(add.mock.calls[0]?.[1]).not.toHaveProperty("vector");
  });

  it("uses the full locator identity so retained jobs do not suppress distinct occurrences", () => {
    const variants: readonly SemanticIndexLocator[] = [
      { ...locator, source: "snapshot" },
      { ...locator, reportId: "report-2" },
      { ...locator, sectionId: "section-2" },
      { ...locator, occurrenceId: "occurrence-2" },
      { ...locator, recordKind: "risk" },
      { ...locator, recordId: "item-2" },
      { ...locator, expectedContentHash: "hash-2" },
    ];
    const jobIds = [
      semanticIndexJobId(locator, runtimeContext),
      ...variants.map((variant) => semanticIndexJobId(variant, runtimeContext)),
    ];

    expect(new Set(jobIds).size).toBe(jobIds.length);
  });

  it("changes the job id when the active embedding model changes", () => {
    const otherContext = {
      ...runtimeContext,
      scope: { ...scope, model: "mistral-embed-v2" },
    };

    expect(semanticIndexJobId(locator, runtimeContext)).not.toBe(
      semanticIndexJobId(locator, otherContext),
    );
  });

  it("produces a bounded opaque id accepted by installed BullMQ validation", async () => {
    const jobId = semanticIndexJobId(locator, runtimeContext);
    const addJob = vi.fn().mockResolvedValue("stored-job-id");
    const queue = {
      qualifiedName: "bull:semantic-index",
      toKey: (type: string) => `bull:semantic-index:${type}`,
      backend: { addJob },
    } as unknown as Parameters<typeof Job.create>[0];

    expect(jobId).toMatch(/^semantic-index-[a-f0-9]{64}$/u);
    expect(jobId).toHaveLength(79);
    for (const rawIdentityPart of [
      runtimeContext.configurationRevisionId,
      scope.embeddingScopeIdentity,
      locator.reportId,
      locator.sectionId,
      locator.occurrenceId,
      locator.recordId,
      locator.expectedContentHash,
    ]) {
      expect(jobId).not.toContain(rawIdentityPart);
    }
    await expect(
      Job.create(queue, SEMANTIC_INDEX_JOB_NAME, {}, { jobId }),
    ).resolves.toMatchObject({ id: "stored-job-id" });
    expect(addJob).toHaveBeenCalledOnce();

    await expect(
      Job.create(
        queue,
        SEMANTIC_INDEX_JOB_NAME,
        {},
        {
          jobId: "semantic:index:revision:model:hash",
        },
      ),
    ).rejects.toThrow("Custom Id cannot contain :");
  });

  it("includes the exact configuration revision and scope in runtime jobs", async () => {
    const add = vi.fn().mockResolvedValue(undefined);
    const enqueuer = new SemanticIndexBullmqEnqueuer({ add });

    await enqueuer.enqueue(locator, runtimeContext);

    expect(add).toHaveBeenCalledWith(
      SEMANTIC_INDEX_JOB_NAME,
      { ...locator, ...runtimeContext },
      expect.objectContaining({
        jobId: semanticIndexJobId(locator, runtimeContext),
      }),
    );
  });

  it("rejects enqueueing a job without a scope identity", async () => {
    const enqueuer = new SemanticIndexBullmqEnqueuer({
      add: vi.fn(),
    });

    await expect(
      enqueuer.enqueue(locator, {
        ...runtimeContext,
        scope: { ...scope, embeddingScopeIdentity: "" },
      }),
    ).rejects.toThrow("scope identity is required");
  });
});
