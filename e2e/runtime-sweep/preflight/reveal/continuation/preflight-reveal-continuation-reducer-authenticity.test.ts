import { describe, expect, it } from "vitest";

import { parentReplayContextFor } from "../../launch/preflight-reveal-continuation-parent-replay.ts";
import { parseRevealTerminalReceipt } from "./preflight-reveal-continuation-artifacts.ts";
import { rememberedRevealContinuationAsset } from "./preflight-reveal-continuation-assets.ts";
import { receiptDigestForBody } from "./preflight-reveal-continuation-digests.ts";
import {
  controlFor,
  inventoryFor,
  runChunk,
  selectionFor,
  withSource,
} from "./preflight-reveal-continuation-fixture.ts";
import {
  reducerStateDigestFor,
  replayRevealContinuation,
} from "./preflight-reveal-continuation-reducer.ts";
import { PREFLIGHT_REVEAL_CANDIDATE_LIST } from "./preflight-reveal-continuation-schemas.ts";
import { branchForRef } from "./receipts/preflight-reveal-continuation-receipts.ts";

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
});
