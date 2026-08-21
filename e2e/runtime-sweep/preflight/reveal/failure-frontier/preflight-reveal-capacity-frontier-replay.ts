import {
  parseRevealBootstrap,
  parseRevealParentPass,
  parseRevealTerminalReceipt,
} from "../continuation/preflight-reveal-continuation-artifacts.ts";
import { R188_ZERO_DIGEST } from "../continuation/preflight-reveal-continuation-digests.ts";
import {
  controlsDigestFor,
  reducerStateDigestFor,
  replayRevealContinuation,
} from "../continuation/preflight-reveal-continuation-reducer.ts";
import type { RevealContinuationReceipt } from "../continuation/preflight-reveal-continuation-schemas.ts";
import type {
  CapacityFrontierAdapterReason,
  CapacityFrontierAdapterResult,
  SourceBoundCapacityFrontierInput,
} from "./preflight-reveal-capacity-frontier-adapter-contract.ts";
import {
  boundsFor,
  boundsMatch,
  contextForInput,
  runMatches,
  sameBranch,
} from "./preflight-reveal-capacity-frontier-bindings.ts";
import {
  bootstrapGenesisMatches,
  packetFrontierAssetsMatch,
  packetPendingBranchAssetsMatch,
  receiptChainFor,
} from "./preflight-reveal-capacity-frontier-evidence.ts";

const rejected = (
  reason: CapacityFrontierAdapterReason,
): CapacityFrontierAdapterResult => ({ kind: "rejected", reason });

const SOURCE_IDENTITY_NOT_BOUND = "source-identity-not-bound" as const;
const FRONTIER_INTEGRITY_FAILED = "frontier-integrity-failed" as const;
const RECEIPT_CHAIN_INVALID = "receipt-chain-invalid" as const;
const REDUCER_STATE_NOT_BOUND = "reducer-state-not-bound" as const;

export type ParsedContinuation = Readonly<{
  readonly bootstrap: ReturnType<typeof parseRevealBootstrap>;
  readonly parentPass: ReturnType<typeof parseRevealParentPass>;
  readonly receipts: readonly RevealContinuationReceipt[];
  readonly replay: ReturnType<typeof replayRevealContinuation>;
}>;

export const continuationArtifactsFor = (
  input: SourceBoundCapacityFrontierInput,
):
  | Readonly<{
      readonly bootstrap: ReturnType<typeof parseRevealBootstrap>;
      readonly parentPass: ReturnType<typeof parseRevealParentPass>;
    }>
  | CapacityFrontierAdapterResult => {
  try {
    return {
      bootstrap: parseRevealBootstrap(input.bootstrap),
      parentPass: parseRevealParentPass(input.parentPass),
    };
  } catch {
    return rejected(RECEIPT_CHAIN_INVALID);
  }
};

export const continuationIdentityReasonFor = (input: {
  readonly source: SourceBoundCapacityFrontierInput["source"];
  readonly context: NonNullable<ReturnType<typeof contextForInput>>;
  readonly queueInput: SourceBoundCapacityFrontierInput["queueInput"];
  readonly bootstrap: ReturnType<typeof parseRevealBootstrap>;
  readonly parentPass: ReturnType<typeof parseRevealParentPass>;
}): CapacityFrontierAdapterReason | undefined => {
  if (input.parentPass.authorityTag === R188_ZERO_DIGEST)
    return SOURCE_IDENTITY_NOT_BOUND;
  if (
    !runMatches({
      run: input.bootstrap.run,
      source: input.source,
      context: input.context,
      queueInput: input.queueInput,
    })
  )
    return SOURCE_IDENTITY_NOT_BOUND;
  if (
    !runMatches({
      run: input.parentPass.run,
      source: input.source,
      context: input.context,
      queueInput: input.queueInput,
    })
  )
    return SOURCE_IDENTITY_NOT_BOUND;
  return undefined;
};

export const replayFor = (input: {
  readonly source: SourceBoundCapacityFrontierInput["source"];
  readonly packet: SourceBoundCapacityFrontierInput["packet"];
  readonly queueInput: SourceBoundCapacityFrontierInput["queueInput"];
  readonly initialState: SourceBoundCapacityFrontierInput["initialState"];
  readonly receipts: SourceBoundCapacityFrontierInput["receipts"];
  readonly bootstrap: ReturnType<typeof parseRevealBootstrap>;
  readonly parentPass: ReturnType<typeof parseRevealParentPass>;
}): ParsedContinuation | CapacityFrontierAdapterResult => {
  const bounds = boundsFor(input.queueInput, input.source);
  if (!boundsMatch(input.bootstrap.bounds, bounds))
    return rejected(FRONTIER_INTEGRITY_FAILED);
  if (
    !bootstrapGenesisMatches({
      bootstrap: input.bootstrap,
      packet: input.packet,
    })
  )
    return rejected(FRONTIER_INTEGRITY_FAILED);
  const receipts = receiptChainFor(input.receipts, parseRevealTerminalReceipt);
  const receiptHead = receipts.at(-1)?.digest ?? null;
  if (
    input.parentPass.chain.receiptHead !== receiptHead ||
    input.parentPass.chain.receiptCount !== receipts.length
  )
    return rejected(RECEIPT_CHAIN_INVALID);
  const initialDigest = reducerStateDigestFor(input.initialState);
  if (initialDigest !== input.bootstrap.reducerStateDigest)
    return rejected(REDUCER_STATE_NOT_BOUND);
  const replay = replayRevealContinuation({
    queueInput: input.queueInput,
    initialState: input.initialState,
    receipts,
    predecessorCompletedCandidateCount: 0,
    predecessorDigest: null,
  });
  const reducerStateDigest = reducerStateDigestFor(replay.state);
  if (reducerStateDigest !== input.parentPass.reducerStateDigest)
    return rejected(REDUCER_STATE_NOT_BOUND);
  if (
    controlsDigestFor(replay.state.controls) !==
      input.parentPass.controlsDigest ||
    replay.state.controls.length !== input.parentPass.controlsCount
  )
    return rejected(REDUCER_STATE_NOT_BOUND);
  return {
    bootstrap: input.bootstrap,
    parentPass: input.parentPass,
    receipts,
    replay,
  };
};

export const replayFrontierReasonFor = (input: {
  readonly packet: SourceBoundCapacityFrontierInput["packet"];
  readonly replay: ReturnType<typeof replayRevealContinuation>;
}): CapacityFrontierAdapterReason | undefined => {
  if (
    input.replay.state.currentBranch === undefined ||
    input.replay.state.currentCandidates === undefined ||
    input.replay.state.currentCandidateIndex === undefined ||
    input.replay.state.currentCandidateIndex !==
      input.packet.manifest.candidateIndex
  )
    return FRONTIER_INTEGRITY_FAILED;
  if (
    !sameBranch(input.replay.state.currentBranch, input.packet.branch) ||
    !packetFrontierAssetsMatch({
      packet: input.packet,
      branch: input.replay.state.currentBranch,
      candidates: input.replay.state.currentCandidates,
    })
  )
    return FRONTIER_INTEGRITY_FAILED;
  if (!packetPendingBranchAssetsMatch(input.packet))
    return FRONTIER_INTEGRITY_FAILED;
  return undefined;
};
