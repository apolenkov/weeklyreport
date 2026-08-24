import { sha256Hex, stableSerialize } from "../../../support/ids.ts";
import { assertLivePreflightSourceIdentity } from "../../canary/preflight-canary.ts";
import type {
  ParentContext,
  ParentProgress,
} from "../preflight-reveal-continuation-parent.ts";
import { runContinuationChild } from "../preflight-reveal-continuation-parent-child.ts";
import {
  createHostCheckpointRequest,
  type HostCheckpointRequest,
  type HostCheckpointResponse,
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
    route: context.revealRoute.catalogRoute,
    routeDigest: sha256Hex(context.revealRoute),
  }) as const;

const hostCheckpointRequestFor = (input: {
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

const assertResponseProgress = (input: {
  readonly request: HostCheckpointRequest;
  readonly response: HostCheckpointResponse;
}): void => {
  const { request, response } = input;
  if (
    request.previousSampleSequence !== null &&
    response.sample.eventSequence <= request.previousSampleSequence
  )
    throw new Error("Host checkpoint sample sequence did not advance");
  if (response.coverage.priorSequence !== (request.previousSampleSequence ?? 0))
    throw new Error("Host checkpoint coverage predecessor drifted");
  if (response.coverage.lastSequence !== response.sample.eventSequence)
    throw new Error("Host checkpoint coverage does not end at the sample");
  if (response.completedChildOrdinal !== request.completedChildOrdinal)
    throw new Error("Host checkpoint completed ordinal drifted");
  if (response.checkpointSequence !== request.completedChildOrdinal + 1)
    throw new Error("Host checkpoint response sequence drifted");
};

const assertCheckpointResponse = (input: {
  readonly request: HostCheckpointRequest;
  readonly response: HostCheckpointResponse;
  readonly boundaryTimestamp: number;
}): void => {
  const { request, response } = input;
  if (response.requestDigest !== request.requestDigest)
    throw new Error("Host checkpoint response is not bound to its request");
  if (stableSerialize(response.run) !== stableSerialize(request.run))
    throw new Error("Host checkpoint response source identity drifted");
  if (response.predecessorCheckpointDigest !== request.previousCheckpointDigest)
    throw new Error("Host checkpoint predecessor digest is not parent-bound");
  if (response.controllerObservationTimestamp < input.boundaryTimestamp)
    throw new Error(
      "Host checkpoint controller observation predates reduction",
    );
  if (response.sample.timestampWall < input.boundaryTimestamp)
    throw new Error("Host checkpoint sample predates reduction");
  assertResponseProgress({ request, response });
};

export const assertHostCheckpointResponse = assertCheckpointResponse;

export const requestHostCheckpointAfterChild = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly ordinal: number;
}): Promise<HostCheckpointResponse> => {
  const boundaryTimestamp = input.context.now?.() ?? Date.now();
  const request = hostCheckpointRequestFor({
    ...input,
    boundaryTimestamp,
  });
  const { requestDigest: _requestDigest, ...requestBody } = request;
  const response = await input.context.requestHostCheckpoint?.({
    request: requestBody,
  });
  if (response === undefined)
    throw new Error("Host checkpoint client returned no response");
  assertCheckpointResponse({ request, response, boundaryTimestamp });
  await assertLivePreflightSourceIdentity({
    source: input.context.source,
    repoRoot: input.context.repoRoot,
  });
  return response;
};

export const runChildUntilDone = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly ordinal: number;
  readonly maxChildren: number;
  readonly runChild?: typeof runContinuationChild;
}): Promise<number> => {
  if (input.ordinal >= input.maxChildren)
    throw new Error(
      `Reveal continuation exceeded its source-derived child guard of ${String(input.maxChildren)}`,
    );
  await assertLivePreflightSourceIdentity({
    source: input.context.source,
    repoRoot: input.context.repoRoot,
  });
  const result = await (input.runChild ?? runContinuationChild)({
    context: input.context,
    progress: input.progress,
    ordinal: input.ordinal,
  });
  if (result.done) return result.exitCode ?? 0;
  if (input.context.requestHostCheckpoint === undefined)
    throw new Error(
      "Reveal continuation requires a parent-only host checkpoint client before launching the next child",
    );
  const checkpoint = await requestHostCheckpointAfterChild({
    context: input.context,
    progress: result.progress,
    ordinal: input.ordinal,
  });
  return runChildUntilDone({
    context: input.context,
    progress: {
      ...result.progress,
      previousCheckpointDigest: checkpoint.responseDigest,
      previousSampleSequence: checkpoint.sample.eventSequence,
    },
    ordinal: input.ordinal + 1,
    maxChildren: input.maxChildren,
    ...(input.runChild === undefined ? {} : { runChild: input.runChild }),
  });
};
