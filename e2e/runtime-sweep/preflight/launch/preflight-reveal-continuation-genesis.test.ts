import { mkdtemp, rm } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { createRevealBootstrap } from "../reveal/continuation/preflight-reveal-continuation-artifacts.ts";
import { writeRevealContinuationAsset } from "../reveal/continuation/preflight-reveal-continuation-assets.ts";
import {
  controlFor,
  inventoryFor,
  runBootstrap,
  runChunk,
  selectionFor,
  withSource,
} from "../reveal/continuation/preflight-reveal-continuation-fixture.ts";
import { assetsForGenesis } from "../reveal/continuation/preflight-reveal-continuation-grant-assets.ts";
import { replayRevealContinuation } from "../reveal/continuation/preflight-reveal-continuation-reducer.ts";
import { branchForRef } from "../reveal/continuation/receipts/preflight-reveal-continuation-receipts.ts";
import type { ParentContext } from "./preflight-reveal-continuation-parent.ts";
import { validateEmptyBootstrap } from "./preflight-reveal-continuation-parent-bootstrap.ts";
import { sealGrant } from "./preflight-reveal-continuation-parent-grant.ts";
import { parentReplayContextFor } from "./preflight-reveal-continuation-parent-replay.ts";

const zeroProgress = {
  previousGrantDigest: null,
  previousCompletedCandidateCount: 0,
  receiptHead: null,
  receiptCount: 0,
  chunkHead: null,
  chunkCount: 0,
} as const;

const contextFor = (input: {
  readonly source: Parameters<typeof selectionFor>[0];
  readonly archiveRoot: string;
  readonly selection: ReturnType<typeof selectionFor>["selection"];
  readonly route: ReturnType<typeof selectionFor>["route"];
}): ParentContext => ({
  source: input.source,
  repoRoot: process.cwd(),
  archiveRoot: input.archiveRoot,
  canaryPath: path.join(input.archiveRoot, "PREFLIGHT_CANARY.json"),
  selection: input.selection,
  revealRoute: input.route,
  authorityKey: "a".repeat(64),
  attemptId: "attempt-fixture",
  chunkBudget: "1000",
  chunkBudgetMs: 1000,
  runPlaywright: () => Promise.reject(new Error("Browser launch is forbidden")),
});

describe("R188 parent-sealed genesis boundary", () => {
  it("rederives an empty bootstrap from parent-owned source and assets", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { selection, route } = selectionFor(source, state.stateId);
      const bootstrapResult = await runBootstrap({
        source,
        state,
        route,
        root: inventoryFor([]),
        nested: inventoryFor([]),
      });
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r188-empty-bootstrap-"),
      );
      try {
        for (const asset of assetsForGenesis(
          bootstrapResult.result.bootstrap.genesis,
        ))
          await writeRevealContinuationAsset({ archiveRoot, asset });
        const context = contextFor({ source, archiveRoot, selection, route });
        const replay = await validateEmptyBootstrap({
          context,
          bootstrap: bootstrapResult.result.bootstrap,
        });
        expect(replay.completedCandidateCount).toBe(0);
        expect(replay.state.queue).toEqual([]);
        expect(replay.state.currentBranch).toBeUndefined();
        expect(replay.state.controls).toEqual(bootstrapResult.result.controls);
        const staleBounds = createRevealBootstrap({
          run: bootstrapResult.result.bootstrap.run,
          genesis: bootstrapResult.result.bootstrap.genesis,
          bounds: {
            ...bootstrapResult.result.bootstrap.bounds,
            maxRevealActions:
              bootstrapResult.result.bootstrap.bounds.maxRevealActions + 1,
          },
          reducerStateDigest:
            bootstrapResult.result.bootstrap.reducerStateDigest,
          controlsDigest: bootstrapResult.result.bootstrap.controlsDigest,
          controlsCount: bootstrapResult.result.bootstrap.controlsCount,
        });
        await expect(
          validateEmptyBootstrap({ context, bootstrap: staleBounds }),
        ).rejects.toThrow(/bounds are not source-derived/u);
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });

  it("rejects a grant-bound fresh genesis mismatch before a reveal action", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { selection, route } = selectionFor(source, state.stateId);
      const root = inventoryFor([
        controlFor("button:a-open:0", "Open panel", 0),
        controlFor("button:b-open:0", "Open later", 1),
      ]);
      let nowCalls = 0;
      const firstChunk = await runChunk({
        source,
        state,
        route,
        root,
        nested: inventoryFor([]),
        stableAllPostAction: root,
        now: () => nowCalls++,
        deadlineAt: 1,
      });
      const firstReceipt = firstChunk.result.chunk.receipts[0];
      if (firstReceipt === undefined) throw new Error("Fixture has no receipt");
      const initialBranch = branchForRef(firstReceipt.branchRef);
      const replay = parentReplayContextFor({
        source,
        state,
        route,
        initialUrl: initialBranch.url,
        initialInventory: initialBranch.inventory,
      });
      const reduced = replayRevealContinuation({
        queueInput: replay.queueInput,
        initialState: replay.initialState,
        receipts: firstChunk.result.chunk.receipts,
        predecessorCompletedCandidateCount: 0,
        predecessorDigest: null,
      });
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r188-genesis-"),
      );
      try {
        const context = contextFor({ source, archiveRoot, selection, route });
        const sealed = await sealGrant({
          context,
          progress: zeroProgress,
          replay,
          state: reduced.state,
          chunk: firstChunk.result.chunk,
          ordinal: 0,
        });
        const events: string[] = [];
        await expect(
          runChunk({
            source,
            state,
            route,
            root: inventoryFor([
              controlFor("button:foreign-open:0", "Foreign panel", 0),
            ]),
            nested: inventoryFor([]),
            grant: sealed.grant,
            expectedGrantDigest: sealed.grant.grantDigest,
            eventSink: events,
            now: () => 0,
            deadlineAt: 10_000,
          }),
        ).rejects.toThrow(
          /fresh genesis does not match the parent-sealed grant/u,
        );
        expect(events.filter((event) => event.startsWith("execute:"))).toEqual(
          [],
        );
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });
});
