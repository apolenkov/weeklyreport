import { mkdtemp, rm } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import type { ParentContext } from "../../../launch/preflight-reveal-continuation-parent.ts";
import { sealGrant } from "../../../launch/preflight-reveal-continuation-parent-grant.ts";
import { parentReplayContextFor } from "../../../launch/preflight-reveal-continuation-parent-replay.ts";
import { revealCandidatesFor } from "../../interaction/preflight-reveal-discovery.ts";
import { parseRevealTerminalReceipt } from "../preflight-reveal-continuation-artifacts.ts";
import { rememberedRevealContinuationAsset } from "../preflight-reveal-continuation-assets.ts";
import { receiptDigestForBody } from "../preflight-reveal-continuation-digests.ts";
import {
  controlFor,
  inventoryFor,
  runChunk,
  selectionFor,
  withSource,
} from "../preflight-reveal-continuation-fixture.ts";
import {
  reduceRevealReceiptSuffix,
  reducerStateDigestFor,
  reducerStateForCheckpoint,
  replayRevealContinuation,
} from "../preflight-reveal-continuation-reducer.ts";
import { PREFLIGHT_REVEAL_CANDIDATE_LIST } from "../preflight-reveal-continuation-schemas.ts";
import { branchForRef } from "../receipts/preflight-reveal-continuation-receipts.ts";

describe("R188 parent-owned reducer authenticity", () => {
  it("reduces a suffix once and digests the resulting state", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { route } = selectionFor(source, state.stateId);
      const root = inventoryFor([
        controlFor("button:a-open:0", "Open panel", 0),
      ]);
      const result = await runChunk({
        source,
        state,
        route,
        root,
        nested: inventoryFor([]),
        now: () => 0,
        deadlineAt: 10_000,
      });
      const first = result.result.chunk.receipts[0];
      if (first === undefined) throw new Error("Fixture produced no receipt");
      const branch = branchForRef(first.branchRef);
      const context = parentReplayContextFor({
        source,
        state,
        route,
        initialUrl: branch.url,
        initialInventory: branch.inventory,
      });
      const replay = replayRevealContinuation({
        queueInput: context.queueInput,
        initialState: context.initialState,
        receipts: result.result.chunk.receipts,
        predecessorCompletedCandidateCount: 0,
        predecessorDigest: null,
      });

      expect(reducerStateDigestFor(replay.state)).toMatch(/^[0-9a-f]{64}$/u);
      expect(replay.completedCandidateCount).toBeGreaterThan(0);
      expect(replay.status).toBe("COMPLETE");
      expect(replay.state.queue).toEqual([]);
    });
  });

  it("derives the exact candidate instead of trusting receipt fields", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { route } = selectionFor(source, state.stateId);
      const root = inventoryFor([
        controlFor("button:a-open:0", "Open panel", 0),
        controlFor("button:b-open:0", "Open later", 1),
      ]);
      const result = await runChunk({
        source,
        state,
        route,
        root,
        nested: inventoryFor([]),
        stableAllPostAction: root,
        now: () => 0,
        deadlineAt: 10_000,
      });
      const first = result.result.chunk.receipts[0];
      if (first === undefined) throw new Error("Fixture produced no receipt");
      const candidateList = rememberedRevealContinuationAsset({
        artifact: PREFLIGHT_REVEAL_CANDIDATE_LIST,
        ref: first.candidateListRef,
      });
      if (
        candidateList?.artifact !== PREFLIGHT_REVEAL_CANDIDATE_LIST ||
        candidateList.candidates[1] === undefined
      )
        throw new Error("Fixture produced no second candidate");
      const { digest: _digest, ...body } = first;
      const alteredBody = {
        ...body,
        candidateIndex: 1,
        candidateId: candidateList.candidates[1].candidateId,
        action: candidateList.candidates[1].action,
        representativeInput: candidateList.candidates[1].representativeInput,
        transition: {
          ...body.transition,
          action: candidateList.candidates[1].action,
          representativeInput: candidateList.candidates[1].representativeInput,
        },
      } as const;
      const altered = parseRevealTerminalReceipt({
        ...alteredBody,
        digest: receiptDigestForBody(alteredBody),
      });
      const initialBranch = branchForRef(first.branchRef);
      const context = parentReplayContextFor({
        source,
        state,
        route,
        initialUrl: initialBranch.url,
        initialInventory: initialBranch.inventory,
      });

      expect(() =>
        replayRevealContinuation({
          queueInput: context.queueInput,
          initialState: context.initialState,
          receipts: [altered],
          predecessorCompletedCandidateCount: 0,
          predecessorDigest: null,
        }),
      ).toThrow(/candidate index is not the reducer cursor/u);
    });
  });

  it("round-trips a checkpoint with a strict immediate-candidate subset", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { selection, route } = selectionFor(source, state.stateId);
      const root = inventoryFor([
        controlFor("button:a-open:0", "Open panel", 0),
      ]);
      const stablePostAction = inventoryFor([
        controlFor("button:a-open:0", "Open panel", 0),
        controlFor("button:n-first:0", "Nested action", 1),
      ]);
      let nowCalls = 0;
      const firstChunk = await runChunk({
        source,
        state,
        route,
        root,
        nested: inventoryFor([]),
        stablePostAction,
        now: () => nowCalls++,
        deadlineAt: 1,
      });
      expect(firstChunk.result.completed).toBe(false);
      const first = firstChunk.result.chunk.receipts[0];
      if (first?.nextFrontier == null)
        throw new Error("Fixture did not produce a resumable frontier");
      const frontierBranch = branchForRef(first.nextFrontier.branchRef);
      const candidateList = rememberedRevealContinuationAsset({
        artifact: PREFLIGHT_REVEAL_CANDIDATE_LIST,
        ref: first.nextFrontier.candidateListRef,
      });
      if (candidateList?.artifact !== PREFLIGHT_REVEAL_CANDIDATE_LIST)
        throw new Error("Fixture did not persist a frontier candidate list");
      expect(revealCandidatesFor(frontierBranch.inventory, route)).toHaveLength(
        candidateList.candidates.length + 1,
      );

      const initialBranch = branchForRef(first.branchRef);
      const replay = parentReplayContextFor({
        source,
        state,
        route,
        initialUrl: initialBranch.url,
        initialInventory: initialBranch.inventory,
      });
      const reduced = reduceRevealReceiptSuffix({
        queueInput: replay.queueInput,
        state: replay.initialState,
        receipts: [first],
        predecessorCompletedCandidateCount: 0,
        predecessorDigest: null,
      });
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r192-checkpoint-round-trip-"),
      );
      try {
        const context: ParentContext = {
          source,
          repoRoot: process.cwd(),
          archiveRoot,
          canaryPath: path.join(archiveRoot, "PREFLIGHT_CANARY.json"),
          selection,
          revealRoute: route,
          authorityKey: "a".repeat(64),
          attemptId: "attempt-fixture",
          chunkBudget: "1000",
          chunkBudgetMs: 1000,
          runPlaywright: () =>
            Promise.reject(new Error("Browser launch is forbidden")),
        };
        const sealed = await sealGrant({
          context,
          progress: {
            previousGrantDigest: null,
            previousCompletedCandidateCount: 0,
            receiptHead: null,
            receiptCount: 0,
            chunkHead: null,
            chunkCount: 0,
          },
          replay,
          state: reduced.state,
          chunk: firstChunk.result.chunk,
          ordinal: 0,
        });
        const hydrated = reducerStateForCheckpoint({
          snapshot: sealed.grant.reducerState,
          route,
        });
        expect(reducerStateDigestFor(hydrated)).toBe(
          reducerStateDigestFor(reduced.state),
        );
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });
});
