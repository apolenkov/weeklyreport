import { mkdtemp, readdir, rm } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { preflightControlForPlan } from "../../execution/playwright-preflight-support.ts";
import { parentReplayContextFor } from "../../launch/preflight-reveal-continuation-parent-replay.ts";
import {
  controlFor,
  inventoryFor,
  runChunk,
  selectionFor,
  withSource,
} from "../continuation/preflight-reveal-continuation-fixture.ts";
import {
  reduceRevealReceiptSuffix,
  reducerStateDigestFor,
} from "../continuation/preflight-reveal-continuation-reducer.ts";
import { discoverRevealControlsChunk } from "../continuation/preflight-reveal-continuation-runner.ts";
import { branchForRef } from "../continuation/receipts/preflight-reveal-continuation-receipts.ts";
import {
  discoverRevealControls,
  type RevealExecutionHarness,
  type RevealRoute,
} from "./preflight-reveal-discovery.ts";

const ORIGIN = "http://127.0.0.1:3205";
const DATABASE_DIGEST = "d".repeat(64);

const harnessFor = (input: {
  readonly route: RevealRoute;
  readonly root: ReturnType<typeof inventoryFor>;
  readonly nested: ReturnType<typeof inventoryFor>;
}): Readonly<{
  readonly events: string[];
  readonly harness: RevealExecutionHarness;
}> => {
  const events: string[] = [];
  let currentUrl = `${ORIGIN}${input.route.resolvedRoute}`;
  let currentInventory = input.root;
  const reset = (): void => {
    currentUrl = `${ORIGIN}${input.route.resolvedRoute}`;
    currentInventory = input.root;
  };
  return {
    events,
    harness: {
      prepare: () => {
        events.push("prepare");
        reset();
        return Promise.resolve();
      },
      navigate: (route) => {
        events.push("navigate");
        currentUrl = new URL(route, ORIGIN).href;
        return Promise.resolve();
      },
      currentUrl: () => currentUrl,
      inventory: () => Promise.resolve(currentInventory),
      executeReveal: ({ action }) => {
        events.push(`execute:${action.controlKey}`);
        if (action.controlKey === "button:a-open:0") {
          currentInventory = input.nested;
          currentUrl = `${ORIGIN}${input.route.resolvedRoute}?panel=open`;
        } else {
          currentInventory = inventoryFor([]);
          currentUrl = `${ORIGIN}${input.route.resolvedRoute}?panel=empty`;
        }
        return Promise.resolve({
          url: currentUrl,
          inventory: currentInventory,
          nonMutation: {
            status: "unchanged",
            beforeDigest: DATABASE_DIGEST,
            afterDigest: DATABASE_DIGEST,
          },
        });
      },
    },
  };
};

const controls = () => ({
  root: controlFor("button:a-open:0", "Open panel", 0),
  nested: controlFor("button:n-first:0", "Nested action", 0),
  secondRoot: controlFor("button:b-open:0", "Open second panel", 1),
});

describe("shared reveal control capacity", () => {
  it("rejects invalid and overflowing initial capacity before an action", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { route } = selectionFor(source, state.stateId);
      const fixtureControls = controls();
      const root = inventoryFor([
        fixtureControls.root,
        fixtureControls.secondRoot,
      ]);
      const invalid = harnessFor({ route, root, nested: inventoryFor([]) });
      await expect(
        discoverRevealControls({
          state,
          route,
          initialInventory: root,
          harness: invalid.harness,
          controlFor: preflightControlForPlan,
          maxControlsPerSegment: 0,
        }),
      ).rejects.toThrow("Reveal control bound must be a positive integer");
      expect(invalid.events).toEqual([]);

      const overflow = harnessFor({ route, root, nested: inventoryFor([]) });
      await expect(
        discoverRevealControls({
          state,
          route,
          initialInventory: root,
          harness: overflow.harness,
          controlFor: preflightControlForPlan,
          maxControlsPerSegment: 1,
        }),
      ).rejects.toThrow("Reveal control bound exceeded");
      expect(overflow.events).toEqual([]);
    });
  });

  it("accepts the exact dynamic limit and rejects plus one before registration", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { route } = selectionFor(source, state.stateId);
      const fixtureControls = controls();
      const root = inventoryFor([fixtureControls.root]);
      const nested = inventoryFor([fixtureControls.nested]);
      const exact = harnessFor({ route, root, nested });
      await expect(
        discoverRevealControls({
          state,
          route,
          initialInventory: root,
          harness: exact.harness,
          controlFor: preflightControlForPlan,
          maxControlsPerSegment: 2,
        }),
      ).resolves.toHaveLength(2);

      const overflow = harnessFor({ route, root, nested });
      const controlFactory = vi.fn(preflightControlForPlan);
      let overflowError: unknown;
      try {
        await discoverRevealControls({
          state,
          route,
          initialInventory: root,
          harness: overflow.harness,
          controlFor: controlFactory,
          maxControlsPerSegment: 1,
        });
      } catch (error: unknown) {
        overflowError = error;
      }
      if (!(overflowError instanceof Error))
        throw new Error("Expected dynamic overflow to return an Error");
      expect(overflowError.message).toBe(
        "Reveal control bound exceeded: 2 controls; maxControlsPerSegment is 1; reductionReason=depth-too-shallow; pathDepth=1; knownBranches=1; plannedControls=1; projectedControls=2",
      );
      expect(overflowError.message).not.toMatch(
        /button:a-open:0|\/admin|https?:\/\/|password|secret|token/iu,
      );
      expect(
        overflow.events.filter((event) => event.startsWith("execute:")),
      ).toEqual(["execute:button:a-open:0"]);
      expect(controlFactory).toHaveBeenCalledTimes(1);
    });
  });

  it("rejects the same dynamic overflow during pure parent replay", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { route } = selectionFor(source, state.stateId);
      const fixtureControls = controls();
      const result = await runChunk({
        source,
        state,
        route,
        root: inventoryFor([fixtureControls.root]),
        nested: inventoryFor([fixtureControls.nested]),
        now: () => 0,
        deadlineAt: 10_000,
      });
      const receipt = result.result.chunk.receipts[0];
      if (receipt === undefined) throw new Error("Fixture produced no receipt");
      const initialBranch = branchForRef(receipt.branchRef);
      const context = parentReplayContextFor({
        source,
        state,
        route,
        initialUrl: initialBranch.url,
        initialInventory: initialBranch.inventory,
      });
      const beforeDigest = reducerStateDigestFor(context.initialState);

      expect(() =>
        reduceRevealReceiptSuffix({
          queueInput: { ...context.queueInput, maxControlsPerSegment: 1 },
          state: context.initialState,
          receipts: [receipt],
          predecessorCompletedCandidateCount: 0,
          predecessorDigest: null,
        }),
      ).toThrow("Reveal control bound exceeded");
      expect(reducerStateDigestFor(context.initialState)).toBe(beforeDigest);
    });
  });

  it("writes no continuation assets after dynamic overflow", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { route } = selectionFor(source, state.stateId);
      const fixtureControls = controls();
      const root = inventoryFor([fixtureControls.root]);
      const nested = inventoryFor([fixtureControls.nested]);
      const live = harnessFor({ route, root, nested });
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r198-control-overflow-"),
      );
      try {
        await expect(
          discoverRevealControlsChunk({
            source: {
              ...source,
              matrixLimits: {
                ...source.matrixLimits,
                maxControlsPerSegment: 1,
              },
            },
            archiveRoot,
            state,
            route,
            initialInventory: root,
            harness: live.harness,
            controlFor: preflightControlForPlan,
            executionScope: "canary",
            attemptId: "attempt-control-overflow",
            deadlineAt: 10_000,
            now: () => 0,
          }),
        ).rejects.toThrow("Reveal control bound exceeded");
        expect(await readdir(archiveRoot)).toEqual([]);
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });
});
