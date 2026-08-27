import { mkdtemp, readFile, rm } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { sha256Hex } from "../../../../support/ids.ts";
import { selectionFor } from "../../../reveal/continuation/preflight-reveal-continuation-fixture.ts";
import type { RequestHostCheckpoint } from "../../checkpoint/preflight-reveal-host-checkpoint-client.ts";
import { responseFor } from "../../checkpoint/preflight-reveal-host-checkpoint-parent-test-fixture.ts";
import {
  aggregatePartitionPlanForContext,
  runRevealContinuationWithAggregatePartitions,
} from "../preflight-reveal-continuation-aggregate.ts";
import type {
  ParentContext,
  ParentProgress,
} from "../preflight-reveal-continuation-parent.ts";
import { initialParentProgress } from "../preflight-reveal-continuation-parent-progress.ts";
import { withCleanSource } from "../preflight-reveal-continuation-parent-test-fixture.ts";

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

const commitTerminalPublication = (): Promise<void> => Promise.resolve();

const terminalPublicationFor = (
  events: string[],
): Promise<() => Promise<void>> => {
  events.push("publication");
  return Promise.resolve(commitTerminalPublication);
};

const runTerminalCase = async (
  checkpointClock: number,
): Promise<
  Readonly<{
    readonly failure?: unknown;
    readonly events: string[];
    readonly completionExists: boolean;
    readonly exitCode?: number;
  }>
> =>
  withCleanSource(async ({ source, repoRoot }) => {
    const archiveRoot = await mkdtemp(
      path.join(process.cwd(), ".r-aggregate-terminal-deadline-"),
    );
    try {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no state");
      const { selection, route: revealRoute } = selectionFor(
        source,
        state.stateId,
      );
      let clock = 5000;
      const events: string[] = [];
      const requestHostCheckpoint = Object.assign(
        ({ request }: Parameters<RequestHostCheckpoint>[0]) => {
          clock = checkpointClock;
          return Promise.resolve(
            responseFor(request, {
              controllerObservationTimestamp: checkpointClock + 1,
              sampleTimestamp: checkpointClock + 2,
            }),
          );
        },
        {
          complete: () => Promise.resolve(),
        },
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
        attemptId: `aggregate-terminal-${String(checkpointClock)}`,
        chunkBudget: "1000",
        chunkBudgetMs: 1000,
        deadlineAt: 140_000,
        deadlineMonotonic: 140_000,
        signal: new AbortController().signal,
        now: () => clock,
        monotonicNow: () => clock,
        runPlaywright: () => Promise.reject(new Error("browser not expected")),
        requestHostCheckpoint,
        beforeAggregateTerminalPublication: () => {
          events.push("cleanup");
          return Promise.resolve();
        },
      };
      const plan = aggregatePartitionPlanForContext({
        context,
        partitionCandidateLimit: source.matrixLimits.maxRevealActions,
        partitionMaxMs: 120_000,
        teardownReserveMs: 20_000,
      });
      const outcome = await runRevealContinuationWithAggregatePartitions({
        context,
        plan,
        maxChildren: 1,
        partitionMaxMs: 120_000,
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
            publishTerminalArtifacts: () => terminalPublicationFor(events),
          });
        },
      }).catch((error: unknown) => error);
      const failure = outcome instanceof Error ? outcome : undefined;
      const completionPath = path.join(
        archiveRoot,
        "continuation",
        `PREFLIGHT_REVEAL_AGGREGATE_PARTITION_COMPLETE.${context.attemptId}.json`,
      );
      const completionExists = await readFile(completionPath, "utf8")
        .then(() => true)
        .catch(() => false);
      return {
        ...(failure === undefined ? {} : { failure }),
        ...(typeof outcome === "number" ? { exitCode: outcome } : {}),
        events,
        completionExists,
      };
    } finally {
      await rm(archiveRoot, { recursive: true, force: true });
    }
  });

describe("aggregate terminal deadline", () => {
  it("allows terminal cleanup and publication inside the global reserve", async () => {
    const result = await runTerminalCase(130_000);
    expect(result.failure).toBeUndefined();
    expect(result.events).toEqual(["cleanup", "publication"]);
    expect(result.completionExists).toBe(true);
  });

  it("fails closed at the supervisor deadline without publishing PASS", async () => {
    const result = await runTerminalCase(140_000);
    expect(result.failure).toBeInstanceOf(Error);
    expect((result.failure as Error).message).toBe(
      "Reveal continuation 24-minute deadline exceeded",
    );
    expect(result.events).toEqual([]);
    expect(result.completionExists).toBe(false);
  });
});
