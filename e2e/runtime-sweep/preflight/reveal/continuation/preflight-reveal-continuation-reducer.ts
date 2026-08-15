import { sha256Hex } from "../../../support/ids.ts";
import { candidatesForImmediateReveal } from "../guards/preflight-reveal-registration.ts";
import type { RevealDiscoveryState } from "../interaction/preflight-reveal-branches.ts";
import { RevealContinuationReplayError } from "./preflight-reveal-continuation-errors.ts";
import {
  applyReceipt,
  type RevealReducerInput,
} from "./preflight-reveal-continuation-reducer-apply.ts";
import type {
  RevealContinuationFrontier,
  RevealContinuationReceipt,
  RevealExecutionGrant,
} from "./preflight-reveal-continuation-schemas.ts";

export type { RevealReducerInput } from "./preflight-reveal-continuation-reducer-apply.ts";
export type RevealContinuationReplay = Readonly<{
  readonly status: "OPEN" | "COMPLETE";
  readonly state: RevealDiscoveryState;
  readonly frontier?: RevealContinuationFrontier;
  readonly completedCandidateCount: number;
  readonly history: readonly RevealContinuationReceipt[];
}>;

export const emptyInitialFrontierStateFor = (input: {
  readonly queueInput: RevealReducerInput;
  readonly state: RevealDiscoveryState;
}): RevealDiscoveryState | undefined => {
  const branch = input.state.queue[0];
  if (
    branch === undefined ||
    input.state.queue.length !== 1 ||
    input.state.currentBranch !== undefined ||
    input.state.currentCandidates !== undefined ||
    input.state.currentCandidateIndex !== undefined ||
    input.state.actionCount !== 0 ||
    input.state.branchCount !== 0 ||
    candidatesForImmediateReveal(input.queueInput, branch).length > 0
  )
    return undefined;
  return { ...input.state, queue: [] };
};

export const replayRevealContinuation = (input: {
  readonly queueInput: RevealReducerInput;
  readonly initialState: RevealDiscoveryState;
  readonly receipts: readonly RevealContinuationReceipt[];
  readonly predecessorCompletedCandidateCount: number;
  readonly predecessorDigest: string | null;
}): RevealContinuationReplay => {
  const result = reduceRevealReceiptSuffix({
    queueInput: input.queueInput,
    state: input.initialState,
    receipts: input.receipts,
    predecessorCompletedCandidateCount:
      input.predecessorCompletedCandidateCount,
    predecessorDigest: input.predecessorDigest,
  });
  return {
    status: result.status,
    state: result.state,
    completedCandidateCount: result.completedCandidateCount,
    history: input.receipts,
  };
};

export const reduceRevealReceiptSuffix = (input: {
  readonly queueInput: RevealReducerInput;
  readonly state: RevealDiscoveryState;
  readonly receipts: readonly RevealContinuationReceipt[];
  readonly predecessorCompletedCandidateCount: number;
  readonly predecessorDigest: string | null;
}): Readonly<{
  readonly status: "OPEN" | "COMPLETE";
  readonly state: RevealDiscoveryState;
  readonly completedCandidateCount: number;
  readonly receiptHead: string | null;
}> => {
  const reduced = input.receipts.reduce(
    (accumulator, receipt) => {
      if (receipt.predecessorDigest !== accumulator.predecessor)
        throw new RevealContinuationReplayError(
          "R188 reducer receipt predecessor is not the parent head",
        );
      const result = applyReceipt({
        queueInput: input.queueInput,
        state: accumulator.state,
        receipt,
        completedCandidateCount: accumulator.count,
      });
      return {
        state: result.state,
        count: result.count,
        predecessor: receipt.digest,
      };
    },
    {
      state: input.state,
      count: input.predecessorCompletedCandidateCount,
      predecessor: input.predecessorDigest,
    },
  );
  const complete =
    reduced.state.currentBranch === undefined &&
    reduced.state.queue.length === 0;
  return {
    status: complete ? "COMPLETE" : "OPEN",
    state: reduced.state,
    completedCandidateCount: reduced.count,
    receiptHead: reduced.predecessor,
  };
};

export const reducerStateDigestFor = (state: RevealDiscoveryState): string =>
  sha256Hex({
    queue: state.queue,
    controls: state.controls,
    discovered: [...state.discovered.entries()],
    visitedStatePaths: [...state.visitedStatePaths.entries()],
    actionCount: state.actionCount,
    branchCount: state.branchCount,
    currentBranch: state.currentBranch,
    currentCandidates: state.currentCandidates,
    currentCandidateIndex: state.currentCandidateIndex,
  });

export const reducerStateSnapshotFor = (
  state: RevealDiscoveryState,
): RevealExecutionGrant["reducerState"] => ({
  controls: state.controls,
  discovered: [...state.discovered.entries()],
  visitedStatePaths: [...state.visitedStatePaths.entries()],
});
