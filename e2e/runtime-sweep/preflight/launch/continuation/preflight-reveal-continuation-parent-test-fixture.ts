import { mkdtemp, rm } from "node:fs/promises";
import * as path from "node:path";

import { buildCampaignSource } from "../../../manifest/manifest.ts";
import { createManifestFixture } from "../../../manifest/manifest-fixture.ts";
import { runGitCommand } from "../../../source/manifest-source.ts";
import type { RevealReceiptChunk } from "../../reveal/continuation/contracts/preflight-reveal-continuation-schemas.ts";
import { writeRevealContinuationAsset } from "../../reveal/continuation/preflight-reveal-continuation-assets.ts";
import {
  controlFor,
  inventoryFor,
  runChunk,
  selectionFor,
  withSource,
} from "../../reveal/continuation/preflight-reveal-continuation-fixture.ts";
import { replayRevealContinuation } from "../../reveal/continuation/preflight-reveal-continuation-reducer.ts";
import { assetsForReceipt } from "../../reveal/continuation/receipts/preflight-reveal-continuation-receipt-refs.ts";
import { branchForRef } from "../../reveal/continuation/receipts/preflight-reveal-continuation-receipts.ts";
import type {
  ParentContext,
  ParentProgress,
} from "./preflight-reveal-continuation-parent.ts";
import { sealGrant } from "./preflight-reveal-continuation-parent-grant.ts";
import { parentReplayContextFor } from "./preflight-reveal-continuation-parent-replay.ts";

const AUTHORITY_KEY_HEX_LENGTH = 64;
const DIGEST_HEX_LENGTH = 64;
const zeroProgress: ParentProgress = {
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
};

export const withCleanSource = async <T>(
  callback: (input: {
    readonly source: ParentContext["source"];
    readonly repoRoot: string;
  }) => Promise<T>,
): Promise<T> => {
  const fixture = await createManifestFixture();
  try {
    for (const args of [
      ["init", "--quiet"],
      ["config", "user.name", "R188 Fixture"],
      ["config", "user.email", "r188-fixture@customreport.local"],
      ["add", "catalog.yaml", "spec.md"],
      ["commit", "--quiet", "-m", "fixture"],
    ] as const)
      await runGitCommand(args, fixture.root);
    const sourceSha = (
      await runGitCommand(["rev-parse", "HEAD"], fixture.root)
    ).trim();
    const source = await buildCampaignSource({
      ...fixture.input,
      sourceSha,
    });
    return await callback({ source, repoRoot: fixture.root });
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
};

type SealedGrantFixture = Readonly<{
  readonly archiveRoot: string;
  readonly context: ParentContext;
  readonly validProgress: ParentProgress;
  readonly sealed: Awaited<ReturnType<typeof sealGrant>>;
  readonly source: ParentContext["source"];
  readonly state: ParentContext["selection"]["state"];
  readonly route: ParentContext["revealRoute"];
  readonly root: ReturnType<typeof inventoryFor>;
  readonly chunk: RevealReceiptChunk;
  readonly browserCalls: () => number;
  readonly resetBrowserCalls: () => void;
}>;

export const persistChunkAssets = async (
  archiveRoot: string,
  chunk: RevealReceiptChunk,
): Promise<void> => {
  for (const receipt of chunk.receipts)
    for (const asset of assetsForReceipt(receipt))
      await writeRevealContinuationAsset({ archiveRoot, asset });
};

const openChunkFixtureFor = async (source: ParentContext["source"]) => {
  const state = source.plan.states[0];
  if (state === undefined) throw new Error("Fixture has no source state");
  const { selection, route } = selectionFor(source, state.stateId);
  const root = inventoryFor([
    controlFor("button:a-open:0", "Open panel", 0),
    controlFor("button:b-open:0", "Open later", 1),
    controlFor("button:c-open:0", "Open last", 2),
  ]);
  const clock = { calls: 0 };
  const chunkResult = await runChunk({
    source,
    state,
    route,
    root,
    nested: inventoryFor([]),
    stableAllPostAction: root,
    now: () => {
      const value = clock.calls;
      clock.calls += 1;
      return value;
    },
    deadlineAt: 1,
  });
  const first = chunkResult.result.chunk.receipts[0];
  if (first === undefined) throw new Error("Fixture produced no receipt");
  const initialBranch = branchForRef(first.branchRef);
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
    receipts: chunkResult.result.chunk.receipts,
    predecessorCompletedCandidateCount: 0,
    predecessorDigest: null,
  });
  return {
    state,
    selection,
    route,
    root,
    chunk: chunkResult.result.chunk,
    replay,
    reduced,
  };
};

const contextFixtureFor = (input: {
  readonly source: ParentContext["source"];
  readonly archiveRoot: string;
  readonly selection: ParentContext["selection"];
  readonly route: ParentContext["revealRoute"];
}) => {
  const calls = { browser: 0 };
  const context: ParentContext = {
    source: input.source,
    repoRoot: process.cwd(),
    archiveRoot: input.archiveRoot,
    canaryPath: path.join(input.archiveRoot, "PREFLIGHT_CANARY.json"),
    baselineReceiptDigest: "d".repeat(DIGEST_HEX_LENGTH),
    selection: input.selection,
    revealRoute: input.route,
    authorityKey: "a".repeat(AUTHORITY_KEY_HEX_LENGTH),
    attemptId: "attempt-fixture",
    chunkBudget: "1000",
    chunkBudgetMs: 1000,
    runPlaywright: () => {
      calls.browser += 1;
      return Promise.reject(new Error("Fixture must reject browser launch"));
    },
  };
  return {
    context,
    browserCalls: () => calls.browser,
    resetBrowserCalls: () => {
      calls.browser = 0;
    },
  };
};

const sealedFixtureForSource = async <T>(
  source: ParentContext["source"],
  callback: (fixture: SealedGrantFixture) => Promise<T>,
): Promise<T> => {
  const open = await openChunkFixtureFor(source);
  const archiveRoot = await mkdtemp(
    path.join(process.cwd(), ".r188-grant-boundary-"),
  );
  try {
    const contextFixture = contextFixtureFor({
      source,
      archiveRoot,
      selection: open.selection,
      route: open.route,
    });
    const sealed = await sealGrant({
      context: contextFixture.context,
      progress: zeroProgress,
      replay: open.replay,
      state: open.reduced.state,
      chunk: open.chunk,
      ordinal: 0,
    });
    const validProgress: ParentProgress = {
      previousGrantDigest: sealed.grant.grantDigest,
      previousCompletedCandidateCount:
        sealed.grant.frontier.completedCandidateCount,
      receiptHead: sealed.grant.chain.receiptHead,
      receiptCount: sealed.grant.chain.receiptCount,
      chunkHead: sealed.grant.chain.chunkHead,
      chunkCount: sealed.grant.chain.chunkCount,
      operationHead: sealed.grant.chain.operationHead,
      operationChunkCount: sealed.grant.chain.operationChunkCount,
      operationTotals: sealed.grant.chain.operationTotals,
      grant: sealed.grant,
      genesis: sealed.grant.genesis,
      reducerState: open.reduced.state,
      reducerInput: open.replay.queueInput,
    };
    return await callback({
      archiveRoot,
      ...contextFixture,
      validProgress,
      sealed,
      source,
      state: open.state,
      route: open.route,
      root: open.root,
      chunk: open.chunk,
    });
  } finally {
    await rm(archiveRoot, { recursive: true, force: true });
  }
};

export const withSealedGrantFixture = async <T>(
  callback: (fixture: SealedGrantFixture) => Promise<T>,
): Promise<T> =>
  withSource((source) => sealedFixtureForSource(source, callback));

export const withCleanSealedGrantFixture = async <T>(
  callback: (fixture: SealedGrantFixture) => Promise<T>,
): Promise<T> =>
  withCleanSource(({ source, repoRoot }) =>
    sealedFixtureForSource(source, (fixture) =>
      callback({
        ...fixture,
        context: { ...fixture.context, repoRoot },
      }),
    ),
  );
