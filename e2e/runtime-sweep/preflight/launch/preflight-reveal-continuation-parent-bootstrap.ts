import * as path from "node:path";

import { sha256Hex, stableSerialize } from "../../support/ids.ts";
import { createParentPass } from "../reveal/continuation/preflight-reveal-continuation-artifacts.ts";
import {
  runIdentityFor,
  strictRouteFor,
} from "../reveal/continuation/preflight-reveal-continuation-contract-factories.ts";
import { genesisForState } from "../reveal/continuation/preflight-reveal-continuation-genesis.ts";
import {
  hydrateRevealContinuationAssets,
  writeRevealParentPass,
} from "../reveal/continuation/preflight-reveal-continuation-io.ts";
import {
  emptyInitialFrontierStateFor,
  reducerStateDigestFor,
} from "../reveal/continuation/preflight-reveal-continuation-reducer.ts";
import type { RevealBootstrap } from "../reveal/continuation/preflight-reveal-continuation-schemas.ts";
import { branchForRef } from "../reveal/continuation/receipts/preflight-reveal-continuation-receipts.ts";
import type { RevealDiscoveryState } from "../reveal/interaction/preflight-reveal-branches.ts";
import { compareRevealControlIdentity } from "../reveal-path.ts";
import { MAX_REVEAL_DEPTH } from "../reveal-path.ts";
import type {
  ParentContext,
  ParentProgress,
} from "./preflight-reveal-continuation-parent.ts";
import { parentReplayContextFor } from "./preflight-reveal-continuation-parent-replay.ts";
import { writeCompleteCanary } from "./preflight-reveal-continuation-parent-support.ts";

const controlsSorted = (state: RevealDiscoveryState) =>
  state.controls.toSorted((left, right) =>
    compareRevealControlIdentity(
      {
        controlKey: left.controlKey,
        revealPathDigest: left.revealPath.digest,
        expectedSurfaceDigest: left.expectedSurface.digest,
      },
      {
        controlKey: right.controlKey,
        revealPathDigest: right.revealPath.digest,
        expectedSurfaceDigest: right.expectedSurface.digest,
      },
    ),
  );

const assertInitialProgress = (input: {
  readonly progress: ParentProgress;
  readonly ordinal: number;
}): void => {
  if (
    input.ordinal !== 0 ||
    input.progress.grant !== undefined ||
    input.progress.inputPath !== undefined ||
    input.progress.genesis !== undefined ||
    input.progress.reducerState !== undefined ||
    input.progress.reducerInput !== undefined ||
    input.progress.previousGrantDigest !== null ||
    input.progress.previousCompletedCandidateCount !== 0 ||
    input.progress.receiptHead !== null ||
    input.progress.receiptCount !== 0 ||
    input.progress.chunkHead !== null ||
    input.progress.chunkCount !== 0
  )
    throw new Error(
      "R188 empty bootstrap is valid only at the initial zero-chain boundary",
    );
};

const assertRunBinding = (input: {
  readonly context: ParentContext;
  readonly bootstrap: RevealBootstrap;
}): void => {
  const expected = runIdentityFor({
    source: input.context.source,
    state: input.context.selection.state,
    route: strictRouteFor(input.context.revealRoute),
    executionScope: "canary",
    attemptId: input.context.attemptId,
  });
  if (stableSerialize(expected) !== stableSerialize(input.bootstrap.run))
    throw new Error(
      "R188 child bootstrap source/state/route/attempt binding drifted",
    );
};

const assertGenesisAndBounds = (input: {
  readonly context: ParentContext;
  readonly bootstrap: RevealBootstrap;
  readonly replay: ReturnType<typeof parentReplayContextFor>;
}): void => {
  const expectedGenesis = genesisForState({
    state: input.replay.initialState,
    candidatesFor: input.replay.queueInput.candidatesFor,
  });
  if (
    stableSerialize(expectedGenesis) !==
    stableSerialize(input.bootstrap.genesis)
  )
    throw new Error("R188 empty bootstrap genesis is not parent-derived");
  const expectedBounds = {
    maxDepth: MAX_REVEAL_DEPTH,
    maxRevealMaterialEdges:
      input.context.source.matrixLimits.maxRevealMaterialEdges,
    maxRevealActions: input.context.source.matrixLimits.maxRevealActions,
    maxControlsPerSegment:
      input.context.source.matrixLimits.maxControlsPerSegment,
  };
  if (
    stableSerialize(expectedBounds) !== stableSerialize(input.bootstrap.bounds)
  )
    throw new Error("R188 empty bootstrap bounds are not source-derived");
};

export const validateEmptyBootstrap = async (input: {
  readonly context: ParentContext;
  readonly bootstrap: RevealBootstrap;
}): Promise<
  Readonly<{ readonly state: RevealDiscoveryState; completedCandidateCount: 0 }>
> => {
  assertRunBinding(input);
  await hydrateRevealContinuationAssets({
    archiveRoot: input.context.archiveRoot,
    bootstrap: input.bootstrap,
  });
  const initialBranch = branchForRef(input.bootstrap.genesis.branchRef);
  if (initialBranch.url !== input.context.revealRoute.resolvedRoute)
    throw new Error(
      "R188 bootstrap genesis does not bind to the selected route",
    );
  const replay = parentReplayContextFor({
    source: input.context.source,
    state: input.context.selection.state,
    route: input.context.revealRoute,
    initialUrl: initialBranch.url,
    initialInventory: initialBranch.inventory,
  });
  assertGenesisAndBounds({ ...input, replay });
  const state = emptyInitialFrontierStateFor({
    queueInput: replay.queueInput,
    state: replay.initialState,
  });
  if (state === undefined)
    throw new Error("R188 bootstrap claimed an empty nonempty frontier");
  const controls = controlsSorted(state);
  if (
    reducerStateDigestFor(state) !== input.bootstrap.reducerStateDigest ||
    sha256Hex(controls) !== input.bootstrap.controlsDigest ||
    controls.length !== input.bootstrap.controlsCount
  )
    throw new Error("R188 empty bootstrap reducer evidence drifted");
  return { state, completedCandidateCount: 0 };
};

export const completeEmptyBootstrap = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly bootstrap: RevealBootstrap;
  readonly ordinal: number;
}): Promise<
  Readonly<{ readonly done: true; readonly progress: ParentProgress }>
> => {
  assertInitialProgress(input);
  const replay = await validateEmptyBootstrap(input);
  const pass = createParentPass({
    run: input.bootstrap.run,
    chain: {
      receiptHead: null,
      receiptCount: 0,
      chunkHead: null,
      chunkCount: 0,
    },
    reducerStateDigest: reducerStateDigestFor(replay.state),
    controlsDigest: sha256Hex(controlsSorted(replay.state)),
    controlsCount: replay.state.controls.length,
    authorityKey: input.context.authorityKey,
  });
  await writeRevealParentPass({
    archiveRoot: input.context.archiveRoot,
    filePath: path.join(
      input.context.archiveRoot,
      "continuation",
      `PREFLIGHT_REVEAL_PARENT_PASS.${input.context.attemptId}.${String(input.ordinal)}.json`,
    ),
    pass,
  });
  await writeCompleteCanary({ context: input.context, replay });
  return { done: true, progress: input.progress };
};
