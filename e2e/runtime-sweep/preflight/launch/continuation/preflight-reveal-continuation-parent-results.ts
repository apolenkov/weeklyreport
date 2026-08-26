import * as path from "node:path";

import { sha256Hex } from "../../../support/ids.ts";
import type { RevealReceiptChunk } from "../../reveal/continuation/contracts/preflight-reveal-continuation-schemas.ts";
import {
  addRevealOperationTotals,
  reduceRevealOperationEvidence,
} from "../../reveal/continuation/operation/preflight-reveal-operation-evidence-reducer.ts";
import { createParentPass } from "../../reveal/continuation/preflight-reveal-continuation-artifacts.ts";
import { writeRevealContinuationAsset } from "../../reveal/continuation/preflight-reveal-continuation-assets.ts";
import {
  hydrateRevealContinuationAssets,
  writeRevealParentPass,
} from "../../reveal/continuation/preflight-reveal-continuation-io.ts";
import {
  controlsDigestFor,
  reducerCheckpointAssetsFor,
  reduceRevealReceiptSuffix,
  reducerStateDigestFor,
} from "../../reveal/continuation/preflight-reveal-continuation-reducer.ts";
import { assertReceiptChunkContract } from "../../reveal/continuation/preflight-reveal-continuation-validators.ts";
import type {
  ParentContext,
  ParentProgress,
  RevealContinuationTerminalizationPermit,
  RevealContinuationTerminalPublicationCommit,
} from "./preflight-reveal-continuation-parent.ts";
import { assertRevealContinuationTerminalizationActive } from "./preflight-reveal-continuation-parent.ts";
import { sealGrant } from "./preflight-reveal-continuation-parent-grant.ts";
import {
  assertChunkRun,
  chainFor,
  contextForChunk,
  writeCompleteCanary,
  zeroDigest,
} from "./preflight-reveal-continuation-parent-support.ts";

export const completeParent = (input: {
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
  Readonly<{
    readonly done: true;
    readonly progress: ParentProgress;
    readonly publishTerminalArtifacts: (
      permit: RevealContinuationTerminalizationPermit,
    ) => Promise<RevealContinuationTerminalPublicationCommit>;
  }>
> => {
  if (
    input.reduced.state.controls.length >
    input.context.source.matrixLimits.maxControlsPerSegment
  )
    throw new Error(
      `R192 parent reducer controls exceed maxControlsPerSegment (${String(input.context.source.matrixLimits.maxControlsPerSegment)})`,
    );
  const assets = reducerCheckpointAssetsFor(input.reduced.state);
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
  return Promise.resolve({
    done: true,
    progress: input.nextProgress,
    publishTerminalArtifacts: async (permit) => {
      for (const asset of assets) {
        assertRevealContinuationTerminalizationActive(input.context, permit);
        await writeRevealContinuationAsset({
          archiveRoot: input.context.archiveRoot,
          asset,
        });
      }
      assertRevealContinuationTerminalizationActive(input.context, permit);
      await writeRevealParentPass({
        archiveRoot: input.context.archiveRoot,
        filePath: passPath,
        pass,
        commitGuard: () =>
          assertRevealContinuationTerminalizationActive(input.context, permit),
      });
      assertRevealContinuationTerminalizationActive(input.context, permit);
      return writeCompleteCanary({
        context: input.context,
        replay: input.reduced,
        commitGuard: () =>
          assertRevealContinuationTerminalizationActive(input.context, permit),
      });
    },
  });
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

const reduceAcceptedChunk = (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly chunk: RevealReceiptChunk;
  readonly ordinal: number;
  readonly expectedChildExecutionId: string;
}) => {
  const replay = contextForChunk(input);
  const reduced = reduceRevealReceiptSuffix({
    queueInput: replay.queueInput,
    state: replay.initialState,
    receipts: input.chunk.receipts,
    predecessorCompletedCandidateCount:
      input.progress.previousCompletedCandidateCount,
    predecessorDigest: input.progress.receiptHead,
  });
  const operation = reduceRevealOperationEvidence({
    queueInput: replay.queueInput,
    chunk: input.chunk,
    expectedChildExecutionId: input.expectedChildExecutionId,
    expectedChildOrdinal: input.ordinal,
    expectedRunDigest: sha256Hex(input.chunk.run),
    expectedGrantDigest: input.progress.grant?.grantDigest ?? zeroDigest,
    predecessorOperationDigest: input.progress.operationHead,
    predecessorActionCount: replay.initialState.actionCount,
  });
  const progress: ParentProgress = {
    previousCompletedCandidateCount: reduced.completedCandidateCount,
    previousGrantDigest: input.progress.previousGrantDigest,
    receiptHead: reduced.receiptHead,
    receiptCount: input.chunk.receiptCount,
    chunkHead: input.chunk.chunkDigest,
    chunkCount: input.chunk.predecessorChunkCount + 1,
    operationHead: operation.operationDigest,
    operationChunkCount: input.progress.operationChunkCount + 1,
    operationTotals: addRevealOperationTotals(
      input.progress.operationTotals,
      operation.totals,
    ),
    previousCheckpointDigest: input.progress.previousCheckpointDigest ?? null,
    previousSampleSequence: input.progress.previousSampleSequence ?? null,
    reducerInput: replay.queueInput,
    reducerState: reduced.state,
  };
  return { replay, reduced, progress };
};

export const continueChild = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly chunk: RevealReceiptChunk;
  readonly ordinal: number;
  readonly expectedChildExecutionId: string;
}): Promise<
  Readonly<{
    readonly done: boolean;
    readonly progress: ParentProgress;
    readonly publishTerminalArtifacts?: (
      permit: RevealContinuationTerminalizationPermit,
    ) => Promise<RevealContinuationTerminalPublicationCommit>;
  }>
> => {
  const { context, progress, chunk } = input;
  assertChunkRun({ context, chunk });
  if (
    chunk.operationEvidence.childExecutionId !==
      input.expectedChildExecutionId ||
    chunk.operationEvidence.childOrdinal !== input.ordinal
  )
    throw new Error("R188 child operation evidence execution identity drifted");
  assertReceiptChunkContract(chunk);
  await hydrateRevealContinuationAssets({
    archiveRoot: context.archiveRoot,
    chunk,
  });
  assertChunkBinding({ progress, chunk });
  const accepted = reduceAcceptedChunk(input);
  const { reduced } = accepted;
  if (reduced.status === "COMPLETE")
    return completeParent({
      context,
      progress,
      chunk,
      reduced,
      nextProgress: accepted.progress,
      ordinal: input.ordinal,
    });
  const sealed = await sealGrant({
    context,
    progress,
    replay: accepted.replay,
    state: reduced.state,
    chunk,
    ordinal: input.ordinal,
  });
  return {
    done: false,
    progress: {
      ...accepted.progress,
      inputPath: sealed.path,
      previousGrantDigest: sealed.grant.grantDigest,
      grant: sealed.grant,
      genesis: sealed.grant.genesis,
    },
  };
};
