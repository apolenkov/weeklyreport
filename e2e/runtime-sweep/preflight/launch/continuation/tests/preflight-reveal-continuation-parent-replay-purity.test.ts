import { readFile } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  controlFor,
  inventoryFor,
  runChunk,
  selectionFor,
  withSource,
} from "../../../reveal/continuation/preflight-reveal-continuation-fixture.ts";
import { branchForRef } from "../../../reveal/continuation/receipts/preflight-reveal-continuation-receipts.ts";
import { parentReplayContextFor } from "../preflight-reveal-continuation-parent-replay.ts";

describe("R188 pure parent replay", () => {
  it("does not depend on a browser execution harness", async () => {
    const source = await readFile(
      path.join(
        process.cwd(),
        "e2e/runtime-sweep/preflight/launch/continuation/preflight-reveal-continuation-parent-replay.ts",
      ),
      "utf8",
    );

    expect(source).not.toMatch(/\bRevealExecutionHarness\b/u);
  });

  it("binds its initial state to the recorded branch URL, not the entry URL", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { route } = selectionFor(source, state.stateId);
      const root = inventoryFor([
        controlFor("button:a-open:0", "Open panel", 0),
      ]);
      const chunkResult = await runChunk({
        source,
        state,
        route,
        root,
        nested: inventoryFor([]),
        stableAllPostAction: root,
        now: () => 0,
        deadlineAt: 10_000,
      });
      const first = chunkResult.result.chunk.receipts[0];
      if (first === undefined) throw new Error("Fixture produced no receipt");
      const initialBranch = branchForRef(first.branchRef);
      const replay = parentReplayContextFor({
        source,
        state,
        route: {
          ...route,
          resolvedRoute: "/entry-route-that-is-not-the-recorded-branch",
        },
        initialUrl: initialBranch.url,
        initialInventory: initialBranch.inventory,
      });

      expect(replay.initialState.queue[0]?.url).toBe(initialBranch.url);
      expect(replay.initialState.queue[0]?.path.initialUrl).toBe(
        initialBranch.url,
      );
    });
  });
});
