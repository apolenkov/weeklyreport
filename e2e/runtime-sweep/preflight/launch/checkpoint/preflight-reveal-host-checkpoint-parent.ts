import { stableSerialize } from "../../../support/ids.ts";
import { assertLivePreflightSourceIdentity } from "../../canary/preflight-canary.ts";
import { HOST_ENVELOPE_THRESHOLDS } from "../../diagnostics/preflight-diagnostic-host-envelope.ts";
import type {
  ParentContext,
  ParentProgress,
  RevealContinuationTerminalizationPermit,
  RevealContinuationTerminalPublicationCommit,
} from "../continuation/preflight-reveal-continuation-parent.ts";
import {
  assertRevealContinuationActive,
  assertRevealContinuationTerminalizationActive,
  assertRevealContinuationTerminalPublicationActive,
  createRevealContinuationTerminalizationPermit,
  remainingRevealContinuationMs,
} from "../continuation/preflight-reveal-continuation-parent.ts";
import { runContinuationChild } from "../continuation/preflight-reveal-continuation-parent-child.ts";
import { runRevealContinuationChildWithBudget } from "./budget/preflight-reveal-host-checkpoint-budget-runner.ts";
import {
  type HostCheckpointRequest,
  type HostCheckpointResponse,
} from "./preflight-reveal-host-checkpoint-contract.ts";
import {
  hostCheckpointCompletionFor,
  hostCheckpointRequestFor,
} from "./preflight-reveal-host-checkpoint-parent-contract.ts";

const HOST_BASELINE_RECORD_COUNT =
  HOST_ENVELOPE_THRESHOLDS.postInfrastructureBaselineSamples;

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

export const assertHostCheckpointResponseForRequest = (input: {
  readonly request: HostCheckpointRequest;
  readonly response: HostCheckpointResponse;
  readonly boundaryTimestamp: number;
  readonly baselineReceiptDigest: string;
}): void => {
  const { request, response } = input;
  if (response.requestDigest !== request.requestDigest)
    throw new Error("Host checkpoint response is not bound to its request");
  if (stableSerialize(response.run) !== stableSerialize(request.run))
    throw new Error("Host checkpoint response source identity drifted");
  if (response.predecessorCheckpointDigest !== request.previousCheckpointDigest)
    throw new Error("Host checkpoint predecessor digest is not parent-bound");
  if (response.baselineReceiptDigest !== input.baselineReceiptDigest)
    throw new Error(
      "Host checkpoint baseline receipt digest is not parent-bound",
    );
  const expectedSampleSequence =
    (request.previousSampleSequence ?? HOST_BASELINE_RECORD_COUNT) + 1;
  if (response.sample.eventSequence !== expectedSampleSequence)
    throw new Error(
      "Host checkpoint sample sequence did not follow the baseline",
    );
  if (response.controllerObservationTimestamp <= input.boundaryTimestamp)
    throw new Error(
      "Host checkpoint controller observation predates reduction",
    );
  if (response.sample.timestampWall <= input.boundaryTimestamp)
    throw new Error("Host checkpoint sample predates reduction");
  assertResponseProgress({ request, response });
};

export const requestHostCheckpointAfterChild = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly ordinal: number;
  /** The final checkpoint may complete during terminalization grace. */
  readonly terminal?: boolean;
}): Promise<HostCheckpointResponse> => {
  assertRevealContinuationActive(input.context);
  const boundaryTimestamp = input.context.now?.() ?? Date.now();
  const request = hostCheckpointRequestFor({
    ...input,
    boundaryTimestamp,
  });
  const { requestDigest: _requestDigest, ...requestBody } = request;
  const response = await input.context.requestHostCheckpoint?.({
    request: requestBody,
    ...(input.context.signal === undefined
      ? {}
      : { signal: input.context.signal }),
  });
  if (input.terminal === true)
    assertRevealContinuationTerminalPublicationActive(input.context);
  else assertRevealContinuationActive(input.context);
  if (response === undefined)
    throw new Error("Host checkpoint client returned no response");
  if (input.context.baselineReceiptDigest === undefined)
    throw new Error(
      "Host checkpoint parent has no expected baseline receipt digest",
    );
  assertHostCheckpointResponseForRequest({
    request,
    response,
    boundaryTimestamp,
    baselineReceiptDigest: input.context.baselineReceiptDigest,
  });
  await assertLivePreflightSourceIdentity({
    source: input.context.source,
    repoRoot: input.context.repoRoot,
  });
  return response;
};

export type PreparedTerminalChildPublication = Readonly<{
  readonly exitCode: number;
  readonly progress: ParentProgress;
  readonly publishTerminalArtifacts?: () => Promise<number>;
}>;

export const prepareTerminalChildPublication = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly ordinal: number;
  readonly exitCode: number;
  readonly publishTerminalArtifacts?: (
    permit: RevealContinuationTerminalizationPermit,
  ) => Promise<RevealContinuationTerminalPublicationCommit>;
}): Promise<PreparedTerminalChildPublication> => {
  if (input.exitCode !== 0)
    return { exitCode: input.exitCode, progress: input.progress };
  if (input.context.requestHostCheckpoint === undefined)
    throw new Error(
      "Successful terminal child requires a parent-only host checkpoint client",
    );
  if (input.publishTerminalArtifacts === undefined)
    throw new Error("Successful terminal child has no terminal publisher");
  const publishTerminalArtifacts = input.publishTerminalArtifacts;
  const checkpoint = await requestHostCheckpointAfterChild({
    context: input.context,
    progress: input.progress,
    ordinal: input.ordinal,
    terminal: true,
  });
  const complete = input.context.requestHostCheckpoint.complete;
  if (complete === undefined)
    throw new Error(
      "Successful terminal child requires a parent-only host checkpoint completion client",
    );
  const completedProgress = {
    ...input.progress,
    previousCheckpointDigest: checkpoint.responseDigest,
    previousSampleSequence: checkpoint.sample.eventSequence,
  };
  // The final checkpoint is the last browser/host boundary. Only durable
  // terminal publication may use the remaining cumulative-deadline grace.
  const permit = createRevealContinuationTerminalizationPermit({
    attemptId: input.context.attemptId,
    terminalChildOrdinal: input.ordinal,
    finalCheckpointDigest: checkpoint.responseDigest,
  });
  assertRevealContinuationTerminalizationActive(input.context, permit);
  return {
    exitCode: input.exitCode,
    progress: completedProgress,
    publishTerminalArtifacts: async () => {
      assertRevealContinuationTerminalizationActive(input.context, permit);
      const commit = await publishTerminalArtifacts(permit);
      if (typeof commit !== "function")
        throw new Error(
          "Successful terminal child publisher did not return a terminal commit",
        );
      assertRevealContinuationTerminalizationActive(input.context, permit);
      await complete({
        completion: hostCheckpointCompletionFor({
          context: input.context,
          progress: completedProgress,
          ordinal: input.ordinal,
        }),
        ...(input.context.signal === undefined
          ? {}
          : { signal: input.context.signal }),
      });
      assertRevealContinuationTerminalizationActive(input.context, permit);
      await commit();
      return input.exitCode;
    },
  };
};

const finishTerminalChild = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly ordinal: number;
  readonly exitCode: number;
  readonly publishTerminalArtifacts?: (
    permit: RevealContinuationTerminalizationPermit,
  ) => Promise<RevealContinuationTerminalPublicationCommit>;
}): Promise<number> => {
  const prepared = await prepareTerminalChildPublication(input);
  return prepared.publishTerminalArtifacts === undefined
    ? prepared.exitCode
    : prepared.publishTerminalArtifacts();
};

export const runChildUntilDone = async (input: {
  readonly context: ParentContext;
  readonly progress: ParentProgress;
  readonly ordinal: number;
  readonly maxChildren: number;
  readonly runChild?: typeof runContinuationChild;
}): Promise<number> => {
  assertRevealContinuationActive(input.context);
  if (input.ordinal >= input.maxChildren)
    throw new Error(
      `Reveal continuation exceeded its source-derived child guard of ${String(input.maxChildren)}`,
    );
  await assertLivePreflightSourceIdentity({
    source: input.context.source,
    repoRoot: input.context.repoRoot,
  });
  const runChild = input.runChild ?? runContinuationChild;
  const result = await runRevealContinuationChildWithBudget({
    context: input.context,
    progress: input.progress,
    ordinal: input.ordinal,
    runChild,
    remainingMs: remainingRevealContinuationMs(input.context),
    assertTerminalPublicationActive: () =>
      assertRevealContinuationTerminalPublicationActive(input.context),
  });
  if (result === undefined) return 1;
  assertRevealContinuationActive(input.context);
  if (result.done)
    return finishTerminalChild({
      context: input.context,
      progress: result.progress,
      ordinal: input.ordinal,
      exitCode: result.exitCode ?? 0,
      ...(result.publishTerminalArtifacts === undefined
        ? {}
        : { publishTerminalArtifacts: result.publishTerminalArtifacts }),
    });
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
