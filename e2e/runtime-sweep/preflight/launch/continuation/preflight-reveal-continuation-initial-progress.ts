import { stableSerialize } from "../../../support/ids.ts";
import type { RevealOperationTotals } from "../../reveal/continuation/operation/preflight-reveal-operation-evidence-reducer.ts";
import { zeroRevealOperationTotals } from "../../reveal/continuation/operation/preflight-reveal-operation-evidence-reducer.ts";
import type { ParentProgress } from "./preflight-reveal-continuation-parent.ts";

export const assertRevealContinuationInitialProgress = (input: {
  readonly progress: ParentProgress;
  readonly ordinal: number;
}): void => {
  const operationTotals: RevealOperationTotals = input.progress.operationTotals;
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
    input.progress.chunkCount !== 0 ||
    input.progress.operationHead !== null ||
    input.progress.operationChunkCount !== 0 ||
    (input.progress.previousCheckpointDigest ?? null) !== null ||
    (input.progress.previousSampleSequence ?? null) !== null ||
    stableSerialize(operationTotals) !==
      stableSerialize(zeroRevealOperationTotals())
  )
    throw new Error(
      "R188 empty bootstrap is valid only at the initial zero-chain boundary",
    );
};
