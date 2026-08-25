import { HOST_ENVELOPE_THRESHOLDS } from "../../diagnostics/preflight-diagnostic-host-envelope.ts";
import {
  createHostCheckpointRequest,
  createHostCheckpointResponse,
  type HostCheckpointRequest,
  type HostCheckpointResponse,
  hostCheckpointThresholdDigest,
  hostRecordDigestFor,
} from "./preflight-reveal-host-checkpoint-contract.ts";

const HOST_BASELINE_RECORD_COUNT =
  HOST_ENVELOPE_THRESHOLDS.postInfrastructureBaselineSamples;
const SAMPLE_TIMESTAMP = 200;
const CONTROLLER_TIMESTAMP = 201;
const DIGEST_LENGTH = 64;
const GIBIBYTE = 1_073_741_824;
const RAW_FREE_GIBIBYTES = 10;
const AVAILABLE_GIBIBYTES = 9;
const TOTAL_GIBIBYTES = 16;
const SWAP_FREE_GIBIBYTES = 4;
const COMPRESSED_BYTES = 1024;

const sampleSequenceFor = (request: HostCheckpointRequest): number =>
  (request.previousSampleSequence ?? HOST_BASELINE_RECORD_COUNT) + 1;

export const responseFor = (
  body: Omit<HostCheckpointRequest, "requestDigest">,
  overrides: Readonly<{
    readonly checkpointSequence?: number;
    readonly controllerObservationTimestamp?: number;
    readonly sampleTimestamp?: number;
  }> = {},
): HostCheckpointResponse => {
  const request = createHostCheckpointRequest(body);
  const sample = {
    eventSequence: sampleSequenceFor(request),
    timestampWall: overrides.sampleTimestamp ?? SAMPLE_TIMESTAMP,
    phase: "runtime" as const,
    status: "healthy" as const,
    reasons: [],
    breachStreaks: {
      rawFreeBytes: 0,
      availableBytes: 0,
      pressureFreePercent: 0,
      compressedBytes: 0,
      swapActivity: 0,
    },
    pressureState: "normal" as const,
    metrics: {
      rawFreeBytes: RAW_FREE_GIBIBYTES * GIBIBYTE,
      availableBytes: AVAILABLE_GIBIBYTES * GIBIBYTE,
      totalBytes: TOTAL_GIBIBYTES * GIBIBYTE,
      swapFreeBytes: SWAP_FREE_GIBIBYTES * GIBIBYTE,
      pressureFreePercent: 80,
      swapUsedBytes: 0,
      compressedBytes: COMPRESSED_BYTES,
      cumulativeCounters: {
        pageins: sampleSequenceFor(request),
        pageouts: 50,
        swapins: 2,
        swapouts: 1,
      },
    },
    nextCounters: {
      pageins: sampleSequenceFor(request),
      pageouts: 50,
      swapins: 2,
      swapouts: 1,
    },
  };
  return createHostCheckpointResponse({
    artifact: "PREFLIGHT_REVEAL_HOST_CHECKPOINT",
    version: 1,
    status: "HEALTHY",
    run: request.run,
    checkpointSequence:
      overrides.checkpointSequence ?? request.checkpointSequence,
    completedChildOrdinal: request.completedChildOrdinal,
    requestDigest: request.requestDigest,
    predecessorCheckpointDigest: request.previousCheckpointDigest,
    controllerObservationTimestamp:
      overrides.controllerObservationTimestamp ?? CONTROLLER_TIMESTAMP,
    baselineReceiptDigest: "d".repeat(DIGEST_LENGTH),
    sample,
    coverage: {
      priorSequence: request.previousSampleSequence ?? 0,
      firstSequence: (request.previousSampleSequence ?? 0) + 1,
      lastSequence: sample.eventSequence,
      coveredCount:
        sample.eventSequence - (request.previousSampleSequence ?? 0),
    },
    thresholdDigest: hostCheckpointThresholdDigest(),
    hostRecordDigest: hostRecordDigestFor(sample),
  });
};
