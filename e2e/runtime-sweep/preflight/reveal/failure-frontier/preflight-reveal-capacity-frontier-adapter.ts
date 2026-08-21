import { assertRevealPath } from "../../reveal-path.ts";
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
import { plansFor } from "../interaction/preflight-reveal-discovery.ts";
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
  sourceFieldsMatch,
} from "./preflight-reveal-capacity-frontier-bindings.ts";
import {
  bootstrapGenesisMatches,
  packetFrontierAssetsMatch,
  packetPendingBranchAssetsMatch,
  receiptChainDigestFor,
  receiptChainFor,
  sourceFrontierDigestFor,
} from "./preflight-reveal-capacity-frontier-evidence.ts";
import { assertRevealFailureFrontierPacketReadBack } from "./preflight-reveal-failure-frontier-io.ts";

export type {
  CapacityFrontierAdapterReason,
  CapacityFrontierAdapterResult,
  SourceBoundCapacityFrontier,
  SourceBoundCapacityFrontierInput,
} from "./preflight-reveal-capacity-frontier-adapter-contract.ts";

const rejected = (
  reason: CapacityFrontierAdapterReason,
): CapacityFrontierAdapterResult => ({ kind: "rejected", reason });

const SOURCE_IDENTITY_NOT_BOUND = "source-identity-not-bound" as const;
const FRONTIER_INTEGRITY_FAILED = "frontier-integrity-failed" as const;
const RECEIPT_CHAIN_INVALID = "receipt-chain-invalid" as const;
const REDUCER_STATE_NOT_BOUND = "reducer-state-not-bound" as const;

type ParsedContinuation = Readonly<{
  readonly bootstrap: ReturnType<typeof parseRevealBootstrap>;
  readonly parentPass: ReturnType<typeof parseRevealParentPass>;
  readonly receipts: readonly RevealContinuationReceipt[];
  readonly replay: ReturnType<typeof replayRevealContinuation>;
}>;

const continuationArtifactsFor = (
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

const continuationIdentityReasonFor = (input: {
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

const replayFor = (input: {
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

const replayFrontierReasonFor = (input: {
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

const readyFrontierFor = (input: {
  readonly sourceInput: SourceBoundCapacityFrontierInput;
  readonly context: NonNullable<ReturnType<typeof contextForInput>>;
  readonly pendingBranch: NonNullable<
    SourceBoundCapacityFrontierInput["packet"]["pendingBranch"]
  >;
  readonly replay: ParsedContinuation;
}): CapacityFrontierAdapterResult => {
  const ordinaryPlans = plansFor(input.pendingBranch.inventory);
  const receiptChainDigest = receiptChainDigestFor(input.replay.receipts);
  const reducerStateDigest = reducerStateDigestFor(input.replay.replay.state);
  const frontierDigest = sourceFrontierDigestFor({
    source: input.sourceInput.source,
    context: input.context,
    current: input.sourceInput.packet.branch,
    branch: input.pendingBranch,
    ordinaryPlans,
    reducerStateDigest,
    receiptChainDigest,
    packetManifestDigest: input.sourceInput.packet.manifest.manifestDigest,
  });
  return {
    kind: "ready",
    frontier: {
      source: input.sourceInput.source,
      context: input.context,
      state: input.replay.replay.state,
      current: input.sourceInput.packet.branch,
      branch: input.pendingBranch,
      ordinaryPlans,
      maxControlsPerSegment:
        input.sourceInput.source.matrixLimits.maxControlsPerSegment,
      reducerStateDigest,
      receiptChainDigest,
      frontierDigest,
    },
  };
};

/**
 * Parses and replays an exact continuation frontier before any capacity
 * arithmetic. It is deliberately diagnostic-only and never invokes a browser
 * or changes the queue consumer.
 */
export const adaptSourceBoundCapacityFrontier = (
  input: SourceBoundCapacityFrontierInput,
): CapacityFrontierAdapterResult => {
  try {
    assertRevealFailureFrontierPacketReadBack(input.packet);
  } catch {
    return rejected("source-frontier-not-bound");
  }
  const context = contextForInput(input.source, input.queueInput);
  if (context === undefined) return rejected("context-not-bound");
  if (
    !sourceFieldsMatch(
      input.source,
      context,
      input.queueInput,
      input.capacityPlanArtifactDigest,
      input.capacityPlanSelectorDigest,
      input.packet,
    )
  )
    return rejected(SOURCE_IDENTITY_NOT_BOUND);
  if (
    input.queueInput.plansFor !== plansFor ||
    input.queueInput.maxControlsPerSegment !==
      input.source.matrixLimits.maxControlsPerSegment
  )
    return rejected("canonical-plan-derivation-failed");
  const pendingBranch = input.packet.pendingBranch;
  if (pendingBranch === undefined) return rejected(FRONTIER_INTEGRITY_FAILED);
  try {
    assertRevealPath(input.packet.branch.path, input.packet.branch.surface);
    assertRevealPath(pendingBranch.path, pendingBranch.surface);
    const artifacts = continuationArtifactsFor(input);
    if ("kind" in artifacts) return artifacts;
    const identityReason = continuationIdentityReasonFor({
      source: input.source,
      context,
      queueInput: input.queueInput,
      bootstrap: artifacts.bootstrap,
      parentPass: artifacts.parentPass,
    });
    if (identityReason !== undefined) return rejected(identityReason);
    const replayResult = replayFor({
      source: input.source,
      packet: input.packet,
      queueInput: input.queueInput,
      initialState: input.initialState,
      bootstrap: artifacts.bootstrap,
      parentPass: artifacts.parentPass,
      receipts: input.receipts,
    });
    if ("kind" in replayResult) return replayResult;
    const frontierReason = replayFrontierReasonFor({
      packet: input.packet,
      replay: replayResult.replay,
    });
    if (frontierReason !== undefined) return rejected(frontierReason);
    return readyFrontierFor({
      sourceInput: input,
      context,
      pendingBranch,
      replay: replayResult,
    });
  } catch {
    return rejected(RECEIPT_CHAIN_INVALID);
  }
};

export { receiptChainDigestFor, sourceFrontierDigestFor };
