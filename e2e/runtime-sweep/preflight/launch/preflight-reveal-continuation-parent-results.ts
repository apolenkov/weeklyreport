import * as path from "node:path";

import { createParentPass } from "../reveal/continuation/preflight-reveal-continuation-artifacts.ts";
import { writeRevealContinuationAsset } from "../reveal/continuation/preflight-reveal-continuation-assets.ts";
import {
  hydrateRevealContinuationAssets,
  writeRevealParentPass,
} from "../reveal/continuation/preflight-reveal-continuation-io.ts";
import {
  controlsDigestFor,
  reducerCheckpointAssetsFor,
  reduceRevealReceiptSuffix,
  reducerStateDigestFor,
} from "../reveal/continuation/preflight-reveal-continuation-reducer.ts";
import type { RevealReceiptChunk } from "../reveal/continuation/preflight-reveal-continuation-schemas.ts";
import { assertReceiptChunkContract } from "../reveal/continuation/preflight-reveal-continuation-validators.ts";
import type {
  ParentContext,
  ParentProgress,
} from "./preflight-reveal-continuation-parent.ts";
import { sealGrant } from "./preflight-reveal-continuation-parent-grant.ts";
import {
  assertChunkRun,
  chainFor,
  contextForChunk,
  writeCompleteCanary,
  zeroDigest,
} from "./preflight-reveal-continuation-parent-support.ts";

export const completeParent = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly chunk: RevealReceiptChunk;
  readonly reduced: Readonly<{
    readonly state: Parameters<typeof reducerStateDigestFor>[0];
    readonly completedCandidateCount: number;
  }>;
  readonly nextProgress: ParentProgress;
  readonly ordinal: number;
}): Promise<
  Readonly<{ readonly done: true; readonly progress: ParentProgress }>
> => {
  if (
    input.reduced.state.controls.length >
    input.context.source.matrixLimits.maxControlsPerSegment
  )
    throw new Error(
      `R192 parent reducer controls exceed maxControlsPerSegment (${String(input.context.source.matrixLimits.maxControlsPerSegment)})`,
    );
  for (const asset of reducerCheckpointAssetsFor(input.reduced.state))
    await writeRevealContinuationAsset({
      archiveRoot: input.context.archiveRoot,
      asset,
    });
  const pass = createParentPass({
    run: input.chunk.run,
    chain: chainFor({ progress: input.progress, chunk: input.chunk }),
    reducerStateDigest: reducerStateDigestFor(input.reduced.state),
    controlsDigest: controlsDigestFor(input.reduced.state.controls),
    controlsCount: input.reduced.state.controls.length,
    authorityKey: input.context.authorityKey,
  });
  const passPath = path.join(
    input.context.archiveRoot,
    "continuation",
    `PREFLIGHT_REVEAL_PARENT_PASS.${input.context.attemptId}.${String(input.ordinal)}.json`,
  );
  await writeRevealParentPass({
    archiveRoot: input.context.archiveRoot,
    filePath: passPath,
    pass,
  });
  await writeCompleteCanary({ context: input.context, replay: input.reduced });
  return { done: true, progress: input.nextProgress };
};

const assertChunkBinding = (input: {
  readonly progress: ParentProgress;
  readonly chunk: RevealReceiptChunk;
}): void => {
  if (
    input.chunk.grantDigest !==
    (input.progress.grant?.grantDigest ?? zeroDigest)
  )
    throw new Error(
      "R188 child chunk grant binding does not match the parent grant",
    );
  if (
    input.chunk.predecessorReceiptHead !== input.progress.receiptHead ||
    input.chunk.predecessorReceiptCount !== input.progress.receiptCount ||
    input.chunk.predecessorChunkHead !== input.progress.chunkHead ||
    input.chunk.predecessorChunkCount !== input.progress.chunkCount
  )
    throw new Error(
      "R188 child chunk predecessor chain does not match parent memory",
    );
};

export const continueChild = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly chunk: RevealReceiptChunk;
  readonly ordinal: number;
}): Promise<
  Readonly<{ readonly done: boolean; readonly progress: ParentProgress }>
> => {
  const { context, progress, chunk } = input;
  assertChunkRun({ context, chunk });
  assertReceiptChunkContract(chunk);
  await hydrateRevealContinuationAssets({
    archiveRoot: context.archiveRoot,
    chunk,
  });
  assertChunkBinding({ progress, chunk });
  const replayContext = contextForChunk({ context, progress, chunk });
  const reduced = reduceRevealReceiptSuffix({
    queueInput: replayContext.queueInput,
    state: replayContext.initialState,
    receipts: chunk.receipts,
    predecessorCompletedCandidateCount:
      progress.previousCompletedCandidateCount,
    predecessorDigest: progress.receiptHead,
  });
  const nextProgress: ParentProgress = {
    previousCompletedCandidateCount: reduced.completedCandidateCount,
    previousGrantDigest: progress.previousGrantDigest,
    receiptHead: reduced.receiptHead,
    receiptCount: chunk.receiptCount,
    chunkHead: chunk.chunkDigest,
    chunkCount: chunk.predecessorChunkCount + 1,
    reducerInput: replayContext.queueInput,
    reducerState: reduced.state,
  };
  if (reduced.status === "COMPLETE")
    return completeParent({
      context,
      progress,
      chunk,
      reduced,
      nextProgress,
      ordinal: input.ordinal,
    });
  const sealed = await sealGrant({
    context,
    progress,
    replay: replayContext,
    state: reduced.state,
    chunk,
    ordinal: input.ordinal,
  });
  return {
    done: false,
    progress: {
      ...nextProgress,
      inputPath: sealed.path,
      previousGrantDigest: sealed.grant.grantDigest,
      grant: sealed.grant,
      genesis: sealed.grant.genesis,
    },
  };
};
