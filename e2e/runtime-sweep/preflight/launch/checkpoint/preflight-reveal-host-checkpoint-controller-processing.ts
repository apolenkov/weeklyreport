import {
  type DiagnosticHostEnvelopeCounters,
  type DiagnosticHostEnvelopeSnapshot,
  type HostEnvelopeBreachStreaks,
} from "../../diagnostics/preflight-diagnostic-host-envelope.ts";
import { evaluateHostEnvelopeSample } from "../../diagnostics/preflight-diagnostic-host-envelope-evaluator.ts";
import type { HealthyPostInfrastructureReceipt } from "../../diagnostics/receipt/preflight-diagnostic-host-envelope-post-infrastructure-reader.ts";
import {
  canonicalHostCheckpointBytes,
  type HostCheckpointRequest,
  type HostCheckpointResponse,
} from "./preflight-reveal-host-checkpoint-contract.ts";
import type { HostCheckpointControllerIdentity } from "./preflight-reveal-host-checkpoint-controller.ts";
import {
  assertPrivateFile,
  immutableWrite,
  requestPathFor,
  responsePathFor,
} from "./preflight-reveal-host-checkpoint-controller-mailbox.ts";
import { responseFor } from "./preflight-reveal-host-checkpoint-controller-response.ts";

export interface ControllerState {
  attemptId: string | undefined;
  responseCount: number;
  lastResponseDigest: string | null;
  expectedSequence: number;
  previousCheckpointDigest: string | null;
  previousReceiptHead: string | null;
  previousReceiptCount: number;
  previousChunkHead: string | null;
  previousChunkCount: number;
  previousCompletedCandidateCount: number;
  previousSampleSequence: number | null;
  previousCounters: DiagnosticHostEnvelopeCounters;
  breachStreaks: HostEnvelopeBreachStreaks;
}

const assertRunIdentity = (
  request: HostCheckpointRequest,
  input: HostCheckpointControllerIdentity,
): void => {
  if (
    request.run.campaignId !== input.campaignId ||
    request.run.sourceSha !== input.sourceSha ||
    request.run.sourceTree !== input.sourceTree ||
    request.run.treeDigest !== input.treeDigest ||
    request.run.sourceDigest !== input.sourceDigest ||
    request.run.planDigest !== input.planDigest ||
    request.run.stateId !== input.stateId ||
    request.run.stateDigest !== input.stateDigest ||
    request.run.profile !== input.profile ||
    request.run.role !== input.role ||
    request.run.route !== input.route ||
    request.run.routeDigest !== input.routeDigest ||
    input.role !== "admin" ||
    input.profile !== "demo" ||
    input.route !== "admin:/admin"
  )
    throw new Error(
      "Host checkpoint request source or selector identity drifted",
    );
};

const assertProgress = (
  request: HostCheckpointRequest,
  state: ControllerState,
): void => {
  if (request.checkpointSequence !== state.expectedSequence)
    throw new Error("Host checkpoint request sequence did not advance");
  if (request.completedChildOrdinal !== request.checkpointSequence - 1)
    throw new Error("Host checkpoint child ordinal drifted");
  if (request.previousCheckpointDigest !== state.previousCheckpointDigest)
    throw new Error("Host checkpoint predecessor digest drifted");
  if (
    request.receiptCount <= state.previousReceiptCount ||
    request.chunkCount <= state.previousChunkCount ||
    request.completedCandidateCount <= state.previousCompletedCandidateCount ||
    request.chunkHead === null ||
    (state.previousReceiptCount > 0 && request.receiptHead === null) ||
    (state.previousReceiptHead !== null &&
      request.receiptHead === state.previousReceiptHead) ||
    (state.previousChunkHead !== null &&
      request.chunkHead === state.previousChunkHead)
  )
    throw new Error(
      "Host checkpoint receipt or chunk progress did not advance",
    );
  if (request.previousSampleSequence !== state.previousSampleSequence)
    throw new Error("Host checkpoint sample predecessor drifted");
};

const establishAttempt = (
  request: HostCheckpointRequest,
  state: ControllerState,
): void => {
  if (state.attemptId === undefined) {
    state.attemptId = request.run.attemptId;
    if (request.previousSampleSequence !== null)
      throw new Error("First host checkpoint request has a predecessor sample");
    return;
  }
  if (request.run.attemptId !== state.attemptId)
    throw new Error("Host checkpoint attempt identity drifted");
};

const readAndEvaluateRuntimeSample = async (input: {
  readonly request: HostCheckpointRequest;
  readonly state: ControllerState;
  readonly baseline: HealthyPostInfrastructureReceipt;
  readonly readSnapshot: (
    phase: "runtime",
  ) => Promise<DiagnosticHostEnvelopeSnapshot>;
}): Promise<{
  readonly snapshot: DiagnosticHostEnvelopeSnapshot;
  readonly evaluation: ReturnType<typeof evaluateHostEnvelopeSample>;
}> => {
  const snapshot = await input.readSnapshot("runtime");
  if (snapshot.phase !== "runtime")
    throw new Error("Host checkpoint snapshot phase is not runtime");
  if (snapshot.timestampWall <= input.request.boundaryTimestamp)
    throw new Error("Host checkpoint host sample predates request boundary");
  const evaluation = evaluateHostEnvelopeSample({
    snapshot,
    mode: "runtime",
    baselineSwapUsedBytes: input.baseline.lastSnapshot.swapUsedBytes ?? 0,
    priorCounters: input.state.previousCounters,
    breachStreaks: input.state.breachStreaks,
  });
  if (evaluation.status !== "healthy" || evaluation.nextCounters === undefined)
    throw new Error(
      `Host checkpoint envelope ${evaluation.status}: ${evaluation.reasons.join(", ")}`,
    );
  return { snapshot, evaluation };
};

const assertResponsePathAvailable = async (
  responsePath: string,
): Promise<void> => {
  try {
    await assertPrivateFile(responsePath);
    throw new Error("Host checkpoint response already exists");
  } catch (error: unknown) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
  }
};

const recordResponse = (
  state: ControllerState,
  request: HostCheckpointRequest,
  response: HostCheckpointResponse,
  evaluation: ReturnType<typeof evaluateHostEnvelopeSample>,
): void => {
  if (evaluation.nextCounters === undefined)
    throw new Error("Host checkpoint response has no next counters");
  state.previousCheckpointDigest = response.responseDigest;
  state.previousReceiptHead = request.receiptHead;
  state.previousReceiptCount = request.receiptCount;
  state.previousChunkHead = request.chunkHead;
  state.previousChunkCount = request.chunkCount;
  state.previousCompletedCandidateCount = request.completedCandidateCount;
  state.previousSampleSequence = response.sample.eventSequence;
  state.previousCounters = evaluation.nextCounters;
  state.breachStreaks = evaluation.breachStreaks;
  state.responseCount += 1;
  state.lastResponseDigest = response.responseDigest;
  state.expectedSequence += 1;
};

export const processHostCheckpointRequest = async (input: {
  readonly request: HostCheckpointRequest;
  readonly requestPath: string;
  readonly state: ControllerState;
  readonly controller: HostCheckpointControllerIdentity;
  readonly baseline: HealthyPostInfrastructureReceipt;
  readonly readSnapshot: (
    phase: "runtime",
  ) => Promise<DiagnosticHostEnvelopeSnapshot>;
  readonly signal?: AbortSignal;
}): Promise<HostCheckpointResponse> => {
  const { request, state } = input;
  const throwIfAborted = (): void => {
    if (input.signal?.aborted)
      throw (
        input.signal.reason ?? new Error("Host checkpoint controller aborted")
      );
  };
  throwIfAborted();
  if (
    input.requestPath !== requestPathFor(input.controller.mailboxRoot, request)
  )
    throw new Error("Host checkpoint request filename is not canonical");
  assertRunIdentity(request, input.controller);
  establishAttempt(request, state);
  assertProgress(request, state);
  throwIfAborted();
  const { snapshot, evaluation } = await readAndEvaluateRuntimeSample(input);
  throwIfAborted();
  const response = responseFor({
    request,
    snapshot,
    evaluation,
    baselineReceiptDigest: input.baseline.baselineReceiptDigest,
  });
  const responsePath = responsePathFor(input.controller.mailboxRoot, request);
  await assertResponsePathAvailable(responsePath);
  throwIfAborted();
  await immutableWrite(responsePath, canonicalHostCheckpointBytes(response), {
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  });
  recordResponse(state, request, response, evaluation);
  return response;
};
