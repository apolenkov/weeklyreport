import { mkdtemp, readFile, rm } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../../support/ids.ts";
import { selectionFor } from "../../reveal/continuation/preflight-reveal-continuation-fixture.ts";
import type { RequestHostCheckpoint } from "../checkpoint/preflight-reveal-host-checkpoint-client.ts";
import { responseFor } from "../checkpoint/preflight-reveal-host-checkpoint-parent-test-fixture.ts";
import { runRevealContinuationWithAggregatePartitions } from "./preflight-reveal-continuation-aggregate.ts";
import { aggregatePartitionPlanForContext } from "./preflight-reveal-continuation-aggregate.ts";
import type { ParentProgress } from "./preflight-reveal-continuation-parent.ts";
import type { ParentContext } from "./preflight-reveal-continuation-parent.ts";
import { initialParentProgress } from "./preflight-reveal-continuation-parent-progress.ts";
import { withCleanSource } from "./preflight-reveal-continuation-parent-test-fixture.ts";
import { parseRevealAggregateCompletion } from "./preflight-reveal-continuation-partition.ts";

const progressFor = (count: number): ParentProgress => ({
  ...initialParentProgress(),
  previousGrantDigest: count === 0 ? null : sha256Hex(`grant-${count}`),
  previousCompletedCandidateCount: count,
  receiptHead: count === 0 ? null : sha256Hex(`receipt-${count}`),
  receiptCount: count,
  chunkHead: count === 0 ? null : sha256Hex(`chunk-${count}`),
  chunkCount: count,
  operationHead: count === 0 ? null : sha256Hex(`operation-${count}`),
  operationChunkCount: count,
  operationTotals: {
    fullReplayActions: count,
    candidateActions: count,
    inverseActions: 0,
    successfulRestorations: 0,
    consumedLeases: 0,
    physicalActions: count,
    chargedActions: count,
  },
});

const notifyCleanup = (context: ParentContext, ordinal: number): void => {
  context.onChildCleanup?.({
    status: "PASS",
    ownership: "OWNED",
    processGroup: "GONE",
    pid: 20_000 + ordinal,
    pgid: 20_000 + ordinal,
    childOrdinal: ordinal,
  });
};

describe("reveal aggregate continuation", () => {
  it("writes a source-bound plan, two contiguous receipts and completion before publication", async () => {
    await withCleanSource(async ({ source, repoRoot }) => {
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r-aggregate-continuation-"),
      );
      try {
        const state = source.plan.states[0];
        if (state === undefined) throw new Error("Fixture has no state");
        const { selection, route: revealRoute } = selectionFor(
          source,
          state.stateId,
        );
        const signal = new AbortController().signal;
        const events: string[] = [];
        const context: ParentContext = {
          source,
          repoRoot,
          archiveRoot,
          canaryPath: path.join(archiveRoot, "PREFLIGHT_CANARY.json"),
          baselineReceiptDigest: "d".repeat(64),
          selection,
          revealRoute,
          authorityKey: "a".repeat(64),
          attemptId: "aggregate-fixture",
          chunkBudget: "1000",
          chunkBudgetMs: 1000,
          signal,
          now: () => 100,
          monotonicNow: () => 0,
          runPlaywright: () =>
            Promise.reject(new Error("browser not expected")),
          requestHostCheckpoint: Object.assign(
            ({ request }: Parameters<RequestHostCheckpoint>[0]) =>
              Promise.resolve(responseFor(request)),
            { complete: () => Promise.resolve() },
          ),
          beforeAggregateTerminalPublication: () => {
            events.push("cleanup");
            return Promise.resolve();
          },
        };
        const plan = aggregatePartitionPlanForContext({
          context,
          partitionCandidateLimit: 8192,
          partitionMaxMs: 200_000,
        });
        const calls: number[] = [];
        const exitCode = await runRevealContinuationWithAggregatePartitions({
          context,
          plan,
          maxChildren: 4,
          partitionMaxMs: 200_000,
          runChild: ({ context, ordinal, progress }) => {
            calls.push(ordinal);
            notifyCleanup(context, ordinal);
            if (ordinal === 0)
              return Promise.resolve({
                done: false,
                progress: progressFor(8192),
              });
            return Promise.resolve({
              done: true,
              progress: {
                ...progressFor(16_384),
                previousCheckpointDigest:
                  progress.previousCheckpointDigest ?? null,
                previousSampleSequence: progress.previousSampleSequence ?? null,
              },
              exitCode: 0,
              publishTerminalArtifacts: () =>
                Promise.resolve(() => {
                  events.push("publication");
                  return Promise.resolve();
                }),
            });
          },
        });

        expect(exitCode).toBe(0);
        expect(calls).toEqual([0, 1]);
        const completionPath = path.join(
          archiveRoot,
          "continuation",
          "PREFLIGHT_REVEAL_AGGREGATE_PARTITION_COMPLETE.aggregate-fixture.json",
        );
        const completion = parseRevealAggregateCompletion(
          JSON.parse(await readFile(completionPath, "utf8")),
        );
        expect(completion.status).toBe("COMPLETE");
        expect(completion.completedCandidateCount).toBe(16_384);
        expect(completion.partitionReceiptDigests).toHaveLength(2);
        expect(events).toEqual(["cleanup", "publication"]);
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });

  it("fails closed without aggregate completion when the planned frontier remains", async () => {
    await withCleanSource(async ({ source, repoRoot }) => {
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r-aggregate-frontier-"),
      );
      try {
        const state = source.plan.states[0];
        if (state === undefined) throw new Error("Fixture has no state");
        const { selection, route: revealRoute } = selectionFor(
          source,
          state.stateId,
        );
        const context: ParentContext = {
          source,
          repoRoot,
          archiveRoot,
          canaryPath: path.join(archiveRoot, "PREFLIGHT_CANARY.json"),
          baselineReceiptDigest: "d".repeat(64),
          selection,
          revealRoute,
          authorityKey: "a".repeat(64),
          attemptId: "aggregate-frontier-fixture",
          chunkBudget: "1000",
          chunkBudgetMs: 1000,
          signal: new AbortController().signal,
          now: () => 100,
          monotonicNow: () => 0,
          runPlaywright: () =>
            Promise.reject(new Error("browser not expected")),
          requestHostCheckpoint: Object.assign(
            ({ request }: Parameters<RequestHostCheckpoint>[0]) =>
              Promise.resolve(responseFor(request)),
            { complete: () => Promise.resolve() },
          ),
          beforeAggregateTerminalPublication: () => Promise.resolve(),
        };
        const plan = aggregatePartitionPlanForContext({
          context,
          partitionCandidateLimit: source.matrixLimits.maxRevealActions,
          partitionMaxMs: 200_000,
        });
        const failure = await runRevealContinuationWithAggregatePartitions({
          context,
          plan,
          maxChildren: 2,
          partitionMaxMs: 200_000,
          runChild: ({ context, ordinal }) => {
            notifyCleanup(context, ordinal);
            return Promise.resolve({
              done: false,
              progress: progressFor(source.matrixLimits.maxRevealActions),
            });
          },
        }).catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(Error);
        expect((failure as Error).message).toContain("plan exhausted");
        const completionPath = path.join(
          archiveRoot,
          "continuation",
          "PREFLIGHT_REVEAL_AGGREGATE_PARTITION_COMPLETE.aggregate-frontier-fixture.json",
        );
        await expect(readFile(completionPath, "utf8")).rejects.toThrow();
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });

  it("does not publish an aggregate completion for a nonzero child", async () => {
    await withCleanSource(async ({ source, repoRoot }) => {
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r-aggregate-child-failure-"),
      );
      try {
        const state = source.plan.states[0];
        if (state === undefined) throw new Error("Fixture has no state");
        const { selection, route: revealRoute } = selectionFor(
          source,
          state.stateId,
        );
        const context: ParentContext = {
          source,
          repoRoot,
          archiveRoot,
          canaryPath: path.join(archiveRoot, "PREFLIGHT_CANARY.json"),
          baselineReceiptDigest: "d".repeat(64),
          selection,
          revealRoute,
          authorityKey: "a".repeat(64),
          attemptId: "aggregate-child-failure-fixture",
          chunkBudget: "1000",
          chunkBudgetMs: 1000,
          signal: new AbortController().signal,
          now: () => 100,
          monotonicNow: () => 0,
          runPlaywright: () =>
            Promise.reject(new Error("browser not expected")),
          beforeAggregateTerminalPublication: () => Promise.resolve(),
        };
        const plan = aggregatePartitionPlanForContext({
          context,
          partitionMaxMs: 200_000,
        });
        const exitCode = await runRevealContinuationWithAggregatePartitions({
          context,
          plan,
          maxChildren: 2,
          partitionMaxMs: 200_000,
          runChild: ({ context, ordinal }) => {
            notifyCleanup(context, ordinal);
            return Promise.resolve({
              done: true,
              progress: progressFor(1),
              exitCode: 23,
            });
          },
        });
        expect(exitCode).toBe(23);
        const completionPath = path.join(
          archiveRoot,
          "continuation",
          "PREFLIGHT_REVEAL_AGGREGATE_PARTITION_COMPLETE.aggregate-child-failure-fixture.json",
        );
        await expect(readFile(completionPath, "utf8")).rejects.toThrow();
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });
});
