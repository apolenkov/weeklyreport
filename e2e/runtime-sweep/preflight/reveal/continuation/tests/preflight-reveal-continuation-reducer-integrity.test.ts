import { describe, expect, it } from "vitest";

import { parentReplayContextFor } from "../../../launch/preflight-reveal-continuation-parent-replay.ts";
import { parseRevealTerminalReceipt } from "../preflight-reveal-continuation-artifacts.ts";
import { receiptDigestForBody } from "../preflight-reveal-continuation-digests.ts";
import {
  controlFor,
  inventoryFor,
  runChunk,
  selectionFor,
  withSource,
} from "../preflight-reveal-continuation-fixture.ts";
import { replayRevealContinuation } from "../preflight-reveal-continuation-reducer.ts";
import { branchForRef } from "../receipts/preflight-reveal-continuation-receipts.ts";

describe("R188 reducer synthetic rehash integrity", () => {
  it("rejects a synthetic rehash that expands one real receipt into 101", async () => {
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
        stableAllPostAction: root,
        now: () => 0,
        deadlineAt: 10_000,
      });
      const first = result.result.chunk.receipts[0];
      if (first === undefined) throw new Error("Fixture produced no receipt");
      const synthetic: (typeof first)[] = [];
      let predecessorDigest = first.digest;
      for (let index = 0; index < 101; index += 1) {
        const { digest: _digest, ...body } = first;
        const syntheticBody = {
          ...body,
          sequence: index + 2,
          predecessorDigest,
          actionCount: index + 2,
          completedCandidateCount: index + 2,
        } as const;
        const receipt = parseRevealTerminalReceipt({
          ...syntheticBody,
          digest: receiptDigestForBody(syntheticBody),
        });
        synthetic.push(receipt);
        predecessorDigest = receipt.digest;
      }
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
          receipts: [first, ...synthetic],
          predecessorCompletedCandidateCount: 0,
          predecessorDigest: null,
        }),
      ).toThrow(/frontier|candidate/u);
    });
  });
});
