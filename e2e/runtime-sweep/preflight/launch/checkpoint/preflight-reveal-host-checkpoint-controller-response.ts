import { type DiagnosticHostEnvelopeSnapshot } from "../../diagnostics/preflight-diagnostic-host-envelope.ts";
import { evaluateHostEnvelopeSample } from "../../diagnostics/preflight-diagnostic-host-envelope-evaluator.ts";
import {
  createHostCheckpointResponse,
  type HostCheckpointRequest,
  type HostCheckpointResponse,
  hostCheckpointThresholdDigest,
  hostRecordDigestFor,
} from "./preflight-reveal-host-checkpoint-contract.ts";

const BASELINE_RECORD_COUNT = 60;
const FIRST_RUNTIME_SEQUENCE = BASELINE_RECORD_COUNT + 1;

export const responseFor = (input: {
  readonly request: HostCheckpointRequest;
  readonly snapshot: DiagnosticHostEnvelopeSnapshot;
  readonly evaluation: ReturnType<typeof evaluateHostEnvelopeSample>;
  readonly baselineReceiptDigest: string;
}): HostCheckpointResponse => {
  const { request, snapshot, evaluation } = input;
  const priorSequence = request.previousSampleSequence ?? 0;
  const eventSequence =
    request.previousSampleSequence === null
      ? FIRST_RUNTIME_SEQUENCE
      : request.previousSampleSequence + 1;
  const sample = sampleFor({ snapshot, eventSequence, evaluation });
  const controllerObservationTimestamp = Math.max(
    Date.now(),
    sample.timestampWall,
  );
  if (sample.timestampWall <= request.boundaryTimestamp)
    throw new Error(
      "Host checkpoint sample did not occur after the request boundary",
    );
  if (controllerObservationTimestamp <= request.boundaryTimestamp)
    throw new Error(
      "Host checkpoint observation did not occur after the request boundary",
    );
  return createHostCheckpointResponse({
    artifact: "PREFLIGHT_REVEAL_HOST_CHECKPOINT",
    version: 1,
    status: "HEALTHY",
    run: request.run,
    checkpointSequence: request.checkpointSequence,
    completedChildOrdinal: request.completedChildOrdinal,
    requestDigest: request.requestDigest,
    predecessorCheckpointDigest: request.previousCheckpointDigest,
    baselineReceiptDigest: input.baselineReceiptDigest,
    controllerObservationTimestamp,
    sample,
    coverage: {
      priorSequence,
      firstSequence: priorSequence + 1,
      lastSequence: sample.eventSequence,
      coveredCount: sample.eventSequence - priorSequence,
    },
    thresholdDigest: hostCheckpointThresholdDigest(),
    hostRecordDigest: hostRecordDigestFor(sample),
  });
};

const sampleFor = (input: {
  readonly snapshot: DiagnosticHostEnvelopeSnapshot;
  readonly eventSequence: number;
  readonly evaluation: ReturnType<typeof evaluateHostEnvelopeSample>;
}): HostCheckpointResponse["sample"] => {
  const { snapshot, eventSequence, evaluation } = input;
  if (
    evaluation.status !== "healthy" ||
    evaluation.nextCounters === undefined ||
    snapshot.rawFreeBytes === null ||
    snapshot.availableBytes === null ||
    snapshot.totalBytes === null ||
    snapshot.swapFreeBytes === null ||
    snapshot.swapUsedBytes === null ||
    snapshot.compressedBytes === null ||
    snapshot.pressureFreePercent === null ||
    snapshot.pressureState !== "normal" ||
    snapshot.pageins === null ||
    snapshot.pageouts === null ||
    snapshot.swapins === null ||
    snapshot.swapouts === null
  )
    throw new Error(
      "Host checkpoint sample is not a complete healthy normal sample",
    );
  return {
    eventSequence,
    timestampWall: snapshot.timestampWall,
    phase: "runtime",
    status: "healthy",
    reasons: [...evaluation.reasons],
    breachStreaks: evaluation.breachStreaks,
    pressureState: "normal",
    metrics: {
      rawFreeBytes: snapshot.rawFreeBytes,
      availableBytes: snapshot.availableBytes,
      totalBytes: snapshot.totalBytes,
      swapFreeBytes: snapshot.swapFreeBytes,
      pressureFreePercent: snapshot.pressureFreePercent,
      swapUsedBytes: snapshot.swapUsedBytes,
      compressedBytes: snapshot.compressedBytes,
      cumulativeCounters: {
        pageins: snapshot.pageins,
        pageouts: snapshot.pageouts,
        swapins: snapshot.swapins,
        swapouts: snapshot.swapouts,
      },
    },
    nextCounters: evaluation.nextCounters,
  };
};
