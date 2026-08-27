import { mkdtemp, rm } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { createRevealBootstrap } from "../../../reveal/continuation/preflight-reveal-continuation-artifacts.ts";
import { writeRevealContinuationAsset } from "../../../reveal/continuation/preflight-reveal-continuation-assets.ts";
import {
  controlFor,
  inventoryFor,
  runBootstrap,
  runChunk,
  selectionFor,
  withSource,
} from "../../../reveal/continuation/preflight-reveal-continuation-fixture.ts";
import { genesisMismatchFor } from "../../../reveal/continuation/preflight-reveal-continuation-genesis.ts";
import { assetsForGenesis } from "../../../reveal/continuation/preflight-reveal-continuation-grant-assets.ts";
import { replayRevealContinuation } from "../../../reveal/continuation/preflight-reveal-continuation-reducer.ts";
import { branchForRef } from "../../../reveal/continuation/receipts/preflight-reveal-continuation-receipts.ts";
import type { ParentContext } from "../preflight-reveal-continuation-parent.ts";
import { validateEmptyBootstrap } from "../preflight-reveal-continuation-parent-bootstrap.ts";
import { sealGrant } from "../preflight-reveal-continuation-parent-grant.ts";
import { parentReplayContextFor } from "../preflight-reveal-continuation-parent-replay.ts";

const zeroProgress = {
  previousGrantDigest: null,
  previousCompletedCandidateCount: 0,
  receiptHead: null,
  receiptCount: 0,
  chunkHead: null,
  chunkCount: 0,
  operationHead: null,
  operationChunkCount: 0,
  operationTotals: {
    fullReplayActions: 0,
    candidateActions: 0,
    inverseActions: 0,
    successfulRestorations: 0,
    consumedLeases: 0,
    physicalActions: 0,
    chargedActions: 0,
  },
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
  it("bounds and redacts URL values in genesis mismatch diagnostics", () => {
    const digest = "a".repeat(64);
    const sealed = {
      inventoryRef: digest,
      inventoryDigest: digest,
      surfaceRef: digest,
      surfaceDigest: digest,
      pathNodeRef: digest,
      pathDigest: digest,
      branchRef: digest,
      branchDigest: digest,
      candidateListRef: digest,
      candidateListDigest: digest,
      url: `/lead/form?token=${"sealed-secret".repeat(100)}`,
    };
    const fresh = {
      ...sealed,
      url: `/lead/form?token=${"fresh-secret".repeat(100)}`,
    };

    const mismatch = genesisMismatchFor(fresh, sealed);

    expect(mismatch).toMatch(
      /^url\[sealed=sha256:[a-f0-9]{64};length=\d+,fresh=sha256:[a-f0-9]{64};length=\d+\]$/u,
    );
    expect(mismatch).not.toContain("sealed-secret");
    expect(mismatch).not.toContain("fresh-secret");
    expect(mismatch.length).toBeLessThan(200);
  });

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
        const resumed = runChunk({
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
        });
        await expect(resumed).rejects.toThrow(
          /fresh genesis does not match the parent-sealed grant: inventoryRef\[sealed=[a-f0-9]{64},fresh=[a-f0-9]{64}\].*surfaceRef\[sealed=[a-f0-9]{64},fresh=[a-f0-9]{64}\].*branchRef\[sealed=[a-f0-9]{64},fresh=[a-f0-9]{64}\].*candidateListRef\[sealed=[a-f0-9]{64},fresh=[a-f0-9]{64}\]/u,
        );
        expect(events.filter((event) => event.startsWith("execute:"))).toEqual(
          [],
        );
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });

  it("rejects reordered visible records even when controls are identical", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const { selection, route } = selectionFor(source, state.stateId);
      const controls = [
        controlFor("button:a-open:0", "Edit decision", 0),
        controlFor("button:b-open:0", "Edit decision", 1),
      ];
      const sealedRoot = {
        ...inventoryFor(controls),
        visibleText: "Decision Alpha Decision Beta",
      };
      let nowCalls = 0;
      const firstChunk = await runChunk({
        source,
        state,
        route,
        root: sealedRoot,
        nested: inventoryFor([]),
        stableAllPostAction: sealedRoot,
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
        path.join(process.cwd(), ".r188-genesis-visible-text-"),
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
        const resumed = runChunk({
          source,
          state,
          route,
          root: {
            ...inventoryFor(controls),
            visibleText: "Decision Beta Decision Alpha",
          },
          nested: inventoryFor([]),
          grant: sealed.grant,
          expectedGrantDigest: sealed.grant.grantDigest,
          eventSink: events,
          now: () => 0,
          deadlineAt: 10_000,
        });
        await expect(resumed).rejects.toThrow(
          /^R188 fresh genesis does not match the parent-sealed grant: inventoryRef\[sealed=[a-f0-9]{64},fresh=[a-f0-9]{64}\], inventoryDigest\[sealed=[a-f0-9]{64},fresh=[a-f0-9]{64}\], branchRef\[sealed=[a-f0-9]{64},fresh=[a-f0-9]{64}\], branchDigest\[sealed=[a-f0-9]{64},fresh=[a-f0-9]{64}\], candidateListRef\[sealed=[a-f0-9]{64},fresh=[a-f0-9]{64}\]$/u,
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
