import { describe, expect, it } from "vitest";

import { parentReplayContextFor } from "../../../launch/continuation/preflight-reveal-continuation-parent-replay.ts";
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
  replayRevealContinuation,
} from "../preflight-reveal-continuation-reducer.ts";
import {
  branchForRef,
  terminalBranchFor,
} from "../receipts/preflight-reveal-continuation-receipts.ts";

describe("R188 parent-owned reducer", () => {
  it("rejects duplicate, reordered, or omitted candidates at the frontier", async () => {
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
      const [first, second] = result.result.chunk.receipts;
      if (first === undefined || second === undefined)
        throw new Error("Fixture did not produce two receipts");
      const initialBranch = branchForRef(first.branchRef);
      const context = parentReplayContextFor({
        source,
        state,
        route,
        initialUrl: initialBranch.url,
        initialInventory: initialBranch.inventory,
      });
      const replay = (receipts: readonly (typeof first)[]) =>
        replayRevealContinuation({
          queueInput: context.queueInput,
          initialState: context.initialState,
          receipts,
          predecessorCompletedCandidateCount: 0,
          predecessorDigest: null,
        });
      expect(() => replay([first, first])).toThrow(/candidate|predecessor/u);
      expect(() => replay([second])).toThrow(/candidate|predecessor/u);
      expect(() => replay([second, first])).toThrow(/candidate|predecessor/u);
    });
  });

  it("retains the actual terminal branch when a non-material action leaves the route", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { route } = selectionFor(source, state.stateId);
      const root = inventoryFor([
        controlFor("button:cross-route:0", "Open another route", 0),
      ]);
      const result = await runChunk({
        source,
        state,
        route,
        root,
        nested: inventoryFor([]),
        crossRoute: true,
        now: () => 0,
        deadlineAt: 10_000,
      });
      const receipt = result.result.chunk.receipts[0];
      if (receipt === undefined) throw new Error("Fixture produced no receipt");
      expect(receipt.materialChanged).toBe(false);
      const terminal = terminalBranchFor(receipt);
      expect(terminal.url).toBe("/admin/foreign");
      const initialBranch = branchForRef(receipt.branchRef);
      const context = parentReplayContextFor({
        source,
        state,
        route,
        initialUrl: initialBranch.url,
        initialInventory: initialBranch.inventory,
      });
      const replay = replayRevealContinuation({
        queueInput: context.queueInput,
        initialState: context.initialState,
        receipts: [receipt],
        predecessorCompletedCandidateCount: 0,
        predecessorDigest: null,
      });
      const control = replay.state.controls.find(
        (candidate) => candidate.controlKey === "button:cross-route:0",
      );
      expect(control?.expectedActionSurface?.digest).toBe(
        terminal.surface.digest,
      );
    });
  });

  it("produces the same state when receipts are reduced uninterrupted or split", async () => {
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
      const [first, second] = result.result.chunk.receipts;
      if (first === undefined || second === undefined)
        throw new Error("Fixture did not produce two receipts");
      const initialBranch = branchForRef(first.branchRef);
      const context = parentReplayContextFor({
        source,
        state,
        route,
        initialUrl: initialBranch.url,
        initialInventory: initialBranch.inventory,
      });
      const all = reduceRevealReceiptSuffix({
        queueInput: context.queueInput,
        state: context.initialState,
        receipts: [first, second],
        predecessorCompletedCandidateCount: 0,
        predecessorDigest: null,
      });
      const firstPart = reduceRevealReceiptSuffix({
        queueInput: context.queueInput,
        state: context.initialState,
        receipts: [first],
        predecessorCompletedCandidateCount: 0,
        predecessorDigest: null,
      });
      const split = reduceRevealReceiptSuffix({
        queueInput: context.queueInput,
        state: firstPart.state,
        receipts: [second],
        predecessorCompletedCandidateCount: firstPart.completedCandidateCount,
        predecessorDigest: firstPart.receiptHead,
      });
      expect(reducerStateDigestFor(split.state)).toBe(
        reducerStateDigestFor(all.state),
      );
      expect(split.completedCandidateCount).toBe(all.completedCandidateCount);
      expect(split.receiptHead).toBe(all.receiptHead);
      expect(split.status).toBe(all.status);
    });
  });
});
