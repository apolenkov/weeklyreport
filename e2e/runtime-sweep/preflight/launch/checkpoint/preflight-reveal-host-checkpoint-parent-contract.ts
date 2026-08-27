import { sha256Hex } from "../../../support/ids.ts";
import type {
  ParentContext,
  ParentProgress,
} from "../continuation/preflight-reveal-continuation-parent.ts";
import {
  createHostCheckpointRequest,
  type HostCheckpointCompletionBody,
  type HostCheckpointRequest,
  PREFLIGHT_REVEAL_HOST_CHECKPOINT_COMPLETE,
  PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION,
} from "./preflight-reveal-host-checkpoint-contract.ts";

const hostCheckpointRunFor = (context: ParentContext) =>
  ({
    campaignId: context.source.campaignId,
    sourceSha: context.source.sourceSha,
    sourceTree: context.source.sourceTree,
    treeDigest: context.source.treeDigest,
    sourceDigest: context.source.sourceDigest,
    planDigest: context.source.plan.digest,
    attemptId: context.attemptId,
    stateId: context.selection.state.stateId,
    stateDigest: sha256Hex(context.selection.state),
    profile: context.selection.state.profile,
    role: context.revealRoute.role,
    route:
      context.selection.selector.route ??
      `${context.revealRoute.role}:${context.revealRoute.catalogRoute}`,
    routeDigest: sha256Hex(context.revealRoute),
  }) as const;

export const hostCheckpointCompletionFor = (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly ordinal: number;
}): HostCheckpointCompletionBody => ({
  artifact: PREFLIGHT_REVEAL_HOST_CHECKPOINT_COMPLETE,
  version: PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION,
  run: hostCheckpointRunFor(input.context),
  terminalChildOrdinal: input.ordinal,
  lastCheckpointSequence: input.ordinal + 1,
  lastResponseDigest: input.progress.previousCheckpointDigest ?? null,
  receiptHead: input.progress.receiptHead,
  receiptCount: input.progress.receiptCount,
  chunkHead: input.progress.chunkHead,
  chunkCount: input.progress.chunkCount,
  completedCandidateCount: input.progress.previousCompletedCandidateCount,
  lastSampleSequence: input.progress.previousSampleSequence ?? null,
});

export const hostCheckpointRequestFor = (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly ordinal: number;
  readonly boundaryTimestamp: number;
}): HostCheckpointRequest =>
  createHostCheckpointRequest({
    artifact: "PREFLIGHT_REVEAL_HOST_CHECKPOINT_REQUEST",
    version: 1,
    run: hostCheckpointRunFor(input.context),
    checkpointSequence: input.ordinal + 1,
    completedChildOrdinal: input.ordinal,
    boundaryTimestamp: input.boundaryTimestamp,
    receiptHead: input.progress.receiptHead,
    receiptCount: input.progress.receiptCount,
    chunkHead: input.progress.chunkHead,
    chunkCount: input.progress.chunkCount,
    completedCandidateCount: input.progress.previousCompletedCandidateCount,
    previousCheckpointDigest: input.progress.previousCheckpointDigest ?? null,
    previousSampleSequence: input.progress.previousSampleSequence ?? null,
  });
