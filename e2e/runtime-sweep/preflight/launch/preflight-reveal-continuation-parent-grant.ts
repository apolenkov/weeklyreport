import * as path from "node:path";

import { stableSerialize } from "../../support/ids.ts";
import {
  readRevealContinuationAsset,
  writeRevealContinuationAsset,
} from "../reveal/continuation/preflight-reveal-continuation-assets.ts";
import { createRevealExecutionGrant } from "../reveal/continuation/preflight-reveal-continuation-contract-factories.ts";
import { genesisForState } from "../reveal/continuation/preflight-reveal-continuation-genesis.ts";
import { assetsForGrant } from "../reveal/continuation/preflight-reveal-continuation-grant-assets.ts";
import { writeRevealContinuationGrant } from "../reveal/continuation/preflight-reveal-continuation-io.ts";
import {
  reducerStateDigestFor,
  reducerStateSnapshotFor,
} from "../reveal/continuation/preflight-reveal-continuation-reducer.ts";
import type {
  RevealExecutionGrant,
  RevealReceiptChunk,
} from "../reveal/continuation/preflight-reveal-continuation-schemas.ts";
import { MAX_REVEAL_DEPTH } from "../reveal-path.ts";
import type {
  ParentContext,
  ParentProgress,
} from "./preflight-reveal-continuation-parent.ts";
import type { ParentReplayContext } from "./preflight-reveal-continuation-parent-replay.ts";
import {
  chainFor,
  frontierForState,
} from "./preflight-reveal-continuation-parent-support.ts";

type ReducerState = Parameters<typeof reducerStateDigestFor>[0];
type SealedGrant = Readonly<{
  readonly path: string;
  readonly grant: RevealExecutionGrant;
}>;

const persistGrantAssets = async (input: {
  readonly archiveRoot: string;
  readonly grant: RevealExecutionGrant;
}): Promise<void> => {
  for (const asset of assetsForGrant(input.grant)) {
    await writeRevealContinuationAsset({
      archiveRoot: input.archiveRoot,
      asset,
    });
    const onDisk = await readRevealContinuationAsset({
      archiveRoot: input.archiveRoot,
      artifact: asset.artifact,
      ref: asset.digest,
    });
    if (stableSerialize(onDisk) !== stableSerialize(asset))
      throw new Error(
        `R188 durable grant asset read-back drifted: ${asset.artifact}:${asset.digest}`,
      );
  }
};

const createAndWriteGrant = async (input: {
  readonly context: ParentContext;
  readonly replay: ParentReplayContext;
  readonly state: ReducerState;
  readonly chain: RevealExecutionGrant["chain"];
  readonly completedCandidateCount: number;
  readonly genesis: RevealExecutionGrant["genesis"];
  readonly ordinal: number;
}): Promise<SealedGrant> => {
  if (
    input.state.controls.length >
    input.context.source.matrixLimits.maxControlsPerSegment
  )
    throw new Error(
      `R192 parent reducer controls exceed maxControlsPerSegment (${String(input.context.source.matrixLimits.maxControlsPerSegment)})`,
    );
  const grant = createRevealExecutionGrant({
    source: input.context.source,
    state: input.context.selection.state,
    route: input.context.revealRoute,
    executionScope: "canary",
    attemptId: input.context.attemptId,
    chain: input.chain,
    genesis: input.genesis,
    frontier: frontierForState({
      context: input.replay,
      route: input.context.revealRoute,
      state: input.state,
      completedCandidateCount: input.completedCandidateCount,
    }),
    reducerState: reducerStateSnapshotFor(input.state),
    bounds: {
      maxDepth: MAX_REVEAL_DEPTH,
      maxRevealMaterialEdges:
        input.context.source.matrixLimits.maxRevealMaterialEdges,
      maxRevealActions: input.context.source.matrixLimits.maxRevealActions,
      maxControlsPerSegment:
        input.context.source.matrixLimits.maxControlsPerSegment,
    },
    reducerStateDigest: reducerStateDigestFor(input.state),
    authorityKey: input.context.authorityKey,
  });
  await persistGrantAssets({
    archiveRoot: input.context.archiveRoot,
    grant,
  });
  const grantPath = path.join(
    input.context.archiveRoot,
    "continuation",
    `PREFLIGHT_REVEAL_GRANT.${input.context.attemptId}.${String(input.ordinal)}.json`,
  );
  await writeRevealContinuationGrant({
    archiveRoot: input.context.archiveRoot,
    filePath: grantPath,
    grant,
  });
  return { path: grantPath, grant };
};

const genesisForGrant = (input: {
  readonly progress: ParentProgress;
  readonly replay: ParentReplayContext;
}): RevealExecutionGrant["genesis"] => {
  if (input.progress.grant === undefined)
    return genesisForState({
      state: input.replay.initialState,
      candidatesFor: input.replay.queueInput.candidatesFor,
    });
  if (input.progress.genesis === undefined)
    throw new Error("R188 sealed predecessor grant has no parent genesis");
  return input.progress.genesis;
};

export const sealGrant = (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly replay: ParentReplayContext;
  readonly state: ReducerState;
  readonly chunk: RevealReceiptChunk;
  readonly ordinal: number;
}): Promise<SealedGrant> =>
  createAndWriteGrant({
    context: input.context,
    replay: input.replay,
    state: input.state,
    chain: chainFor({ progress: input.progress, chunk: input.chunk }),
    completedCandidateCount:
      input.progress.previousCompletedCandidateCount +
      input.chunk.receipts.length,
    genesis: genesisForGrant({
      progress: input.progress,
      replay: input.replay,
    }),
    ordinal: input.ordinal,
  });
