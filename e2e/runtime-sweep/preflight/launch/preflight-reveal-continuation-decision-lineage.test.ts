import { mkdtemp, rm } from "node:fs/promises";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  controlFor,
  inventoryFor,
  runChunk,
  selectionFor,
  withSource,
} from "../reveal/continuation/preflight-reveal-continuation-fixture.ts";
import { replayRevealContinuation } from "../reveal/continuation/preflight-reveal-continuation-reducer.ts";
import { branchForRef } from "../reveal/continuation/receipts/preflight-reveal-continuation-receipts.ts";
import type { ParentContext } from "./preflight-reveal-continuation-parent.ts";
import { sealGrant } from "./preflight-reveal-continuation-parent-grant.ts";
import { parentReplayContextFor } from "./preflight-reveal-continuation-parent-replay.ts";

const STABLE_IDS = [
  "88888888-8888-4888-8888-888888888888",
  "99999999-9999-4999-8999-999999999999",
] as const;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const zeroProgress = {
  previousGrantDigest: null,
  previousCompletedCandidateCount: 0,
  receiptHead: null,
  receiptCount: 0,
  chunkHead: null,
  chunkCount: 0,
} as const;

const decisionInventoryFor = (stableIds: readonly [string, string]) => ({
  ...inventoryFor([
    {
      ...controlFor("button:a-open:0", "Edit decision", 0),
      recordStableId: stableIds[0],
    },
    {
      ...controlFor("button:b-open:0", "Edit decision", 1),
      recordStableId: stableIds[1],
    },
  ]),
  visibleText: "Decision Alpha Decision Beta",
});

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

async function grantFor(input: {
  readonly source: Parameters<typeof selectionFor>[0];
  readonly state: Parameters<typeof selectionFor>[0]["plan"]["states"][number];
  readonly archiveRoot: string;
}) {
  const { selection, route } = selectionFor(input.source, input.state.stateId);
  const root = decisionInventoryFor(STABLE_IDS);
  let nowCalls = 0;
  const firstChunk = await runChunk({
    source: input.source,
    state: input.state,
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
    source: input.source,
    state: input.state,
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
  const sealed = await sealGrant({
    context: contextFor({
      source: input.source,
      archiveRoot: input.archiveRoot,
      selection,
      route,
    }),
    progress: zeroProgress,
    replay,
    state: reduced.state,
    chunk: firstChunk.result.chunk,
    ordinal: 0,
  });
  return { grant: sealed.grant, root, route };
}

describe("R197 decision ordinal lineage continuation", () => {
  it("resumes matching lineage and executes post-grant work", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r197-lineage-positive-"),
      );
      try {
        const sealed = await grantFor({ source, state, archiveRoot });
        const sealedMapping = sealed.root.controls.map(
          ({ controlKey, recordStableId }) => ({ controlKey, recordStableId }),
        );
        expect(
          sealedMapping.every(
            ({ recordStableId }) =>
              recordStableId !== undefined && UUID_V4.test(recordStableId),
          ),
        ).toBe(true);
        const freshRoot = decisionInventoryFor(STABLE_IDS);
        expect(
          freshRoot.controls.map(({ controlKey, recordStableId }) => ({
            controlKey,
            recordStableId,
          })),
        ).toEqual(sealedMapping);
        const events: string[] = [];
        await runChunk({
          source,
          state,
          route: sealed.route,
          root: freshRoot,
          nested: inventoryFor([]),
          stableAllPostAction: freshRoot,
          grant: sealed.grant,
          expectedGrantDigest: sealed.grant.grantDigest,
          eventSink: events,
          now: () => 0,
          deadlineAt: 10_000,
        });
        expect(events.some((event) => event.startsWith("execute:"))).toBe(true);
      } finally {
        await rm(archiveRoot, { recursive: true, force: true });
      }
    });
  });

  it("rejects swapped lineage before post-grant execution", async () => {
    await withSource(async (source) => {
      const state = source.plan.states[0];
      if (state === undefined) throw new Error("Fixture has no source state");
      const archiveRoot = await mkdtemp(
        path.join(process.cwd(), ".r197-lineage-negative-"),
      );
      try {
        const sealed = await grantFor({ source, state, archiveRoot });
        const events: string[] = [];
        const resumed = runChunk({
          source,
          state,
          route: sealed.route,
          root: decisionInventoryFor([STABLE_IDS[1], STABLE_IDS[0]]),
          nested: inventoryFor([]),
          grant: sealed.grant,
          expectedGrantDigest: sealed.grant.grantDigest,
          eventSink: events,
          now: () => 0,
          deadlineAt: 10_000,
        });
        await expect(resumed).rejects.toThrow(
          /fresh genesis does not match the parent-sealed grant: inventoryRef/u,
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
