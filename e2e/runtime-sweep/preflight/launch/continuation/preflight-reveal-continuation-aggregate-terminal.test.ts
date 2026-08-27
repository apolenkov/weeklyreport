import { mkdtemp, readFile, rm } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../../support/ids.ts";
import { selectionFor } from "../../reveal/continuation/preflight-reveal-continuation-fixture.ts";
import type { RequestHostCheckpoint } from "../checkpoint/preflight-reveal-host-checkpoint-client.ts";
import { responseFor } from "../checkpoint/preflight-reveal-host-checkpoint-parent-test-fixture.ts";
import {
  aggregatePartitionPlanForContext,
  runRevealContinuationWithAggregatePartitions,
} from "./preflight-reveal-continuation-aggregate.ts";
import type {
  ParentContext,
  ParentProgress,
} from "./preflight-reveal-continuation-parent.ts";
import { initialParentProgress } from "./preflight-reveal-continuation-parent-progress.ts";
import { withCleanSource } from "./preflight-reveal-continuation-parent-test-fixture.ts";

const progressFor = (count: number): ParentProgress => ({
  ...initialParentProgress(),
  previousGrantDigest: sha256Hex(`grant-${count}`),
  previousCompletedCandidateCount: count,
  receiptHead: sha256Hex(`receipt-${count}`),
  receiptCount: count,
  chunkHead: sha256Hex(`chunk-${count}`),
  chunkCount: count,
  operationHead: sha256Hex(`operation-${count}`),
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

describe("reveal aggregate terminal publication", () => {
  it("does not publish completion or canary when terminal cleanup preparation fails", async () => {
    await withCleanSource(async ({ source, repoRoot }) => {
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r-aggregate-cleanup-failure-"),
      );
      try {
        const state = source.plan.states[0];
        if (state === undefined) throw new Error("Fixture has no state");
        const { selection, route: revealRoute } = selectionFor(
          source,
          state.stateId,
        );
        let publicationCalls = 0;
        const context: ParentContext = {
          source,
          repoRoot,
          archiveRoot,
          canaryPath: path.join(archiveRoot, "PREFLIGHT_CANARY.json"),
          baselineReceiptDigest: "d".repeat(64),
          selection,
          revealRoute,
          authorityKey: "a".repeat(64),
          attemptId: "aggregate-cleanup-failure-fixture",
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
          beforeAggregateTerminalPublication: () =>
            Promise.reject(new Error("terminal cleanup failed")),
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
          runChild: ({ context: childContext, ordinal }) => {
            childContext.onChildCleanup?.({
              status: "PASS",
              ownership: "OWNED",
              processGroup: "GONE",
              pid: 20_000 + ordinal,
              pgid: 20_000 + ordinal,
              childOrdinal: ordinal,
            });
            return Promise.resolve({
              done: true,
              progress: progressFor(source.matrixLimits.maxRevealActions),
              exitCode: 0,
              publishTerminalArtifacts: () => {
                publicationCalls += 1;
                return Promise.resolve(() => Promise.resolve());
              },
            });
          },
        }).catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(Error);
        expect((failure as Error).message).toBe("terminal cleanup failed");
        expect(publicationCalls).toBe(0);
        await expect(
          readFile(
            path.join(
              archiveRoot,
              "continuation",
              "PREFLIGHT_REVEAL_AGGREGATE_PARTITION_COMPLETE.aggregate-cleanup-failure-fixture.json",
            ),
            "utf8",
          ),
        ).rejects.toThrow();
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });

  it("does not publish canary PASS when terminal publication fails", async () => {
    await withCleanSource(async ({ source, repoRoot }) => {
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r-aggregate-publication-failure-"),
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
          attemptId: "aggregate-publication-failure-fixture",
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
          maxChildren: 1,
          partitionMaxMs: 200_000,
          runChild: ({ context: childContext, ordinal }) => {
            childContext.onChildCleanup?.({
              status: "PASS",
              ownership: "OWNED",
              processGroup: "GONE",
              pid: 20_000 + ordinal,
              pgid: 20_000 + ordinal,
              childOrdinal: ordinal,
            });
            return Promise.resolve({
              done: true,
              progress: progressFor(source.matrixLimits.maxRevealActions),
              exitCode: 0,
              publishTerminalArtifacts: () =>
                Promise.reject(new Error("terminal publication failed")),
            });
          },
        }).catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(Error);
        expect((failure as Error).message).toBe("terminal publication failed");
        await expect(
          readFile(
            path.join(
              archiveRoot,
              "continuation",
              "PREFLIGHT_REVEAL_AGGREGATE_PARTITION_COMPLETE.aggregate-publication-failure-fixture.json",
            ),
            "utf8",
          ),
        ).resolves.toBeTruthy();
        await expect(readFile(context.canaryPath, "utf8")).rejects.toThrow();
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });
});
