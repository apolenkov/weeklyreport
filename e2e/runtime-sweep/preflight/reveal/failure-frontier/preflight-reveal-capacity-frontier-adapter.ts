import { assertRevealPath } from "../../reveal-path.ts";
import { reducerStateDigestFor } from "../continuation/preflight-reveal-continuation-reducer.ts";
import { plansFor } from "../interaction/preflight-reveal-discovery.ts";
import type {
  CapacityFrontierAdapterReason,
  CapacityFrontierAdapterResult,
  SourceBoundCapacityFrontierInput,
} from "./preflight-reveal-capacity-frontier-adapter-contract.ts";
import {
  contextForInput,
  sourceFieldsMatch,
} from "./preflight-reveal-capacity-frontier-bindings.ts";
import {
  receiptChainDigestFor,
  sourceFrontierDigestFor,
} from "./preflight-reveal-capacity-frontier-evidence.ts";
import {
  continuationArtifactsFor,
  continuationIdentityReasonFor,
  type ParsedContinuation,
  replayFor,
  replayFrontierReasonFor,
} from "./preflight-reveal-capacity-frontier-replay.ts";
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
