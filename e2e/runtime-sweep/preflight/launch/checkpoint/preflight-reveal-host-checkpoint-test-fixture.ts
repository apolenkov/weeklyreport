import {
  createHostCheckpointRequest,
  createHostCheckpointResponse,
  type HostCheckpointRequest,
  type HostCheckpointRun,
  hostCheckpointThresholdDigest,
  hostRecordDigestFor,
  PREFLIGHT_REVEAL_HOST_CHECKPOINT,
  PREFLIGHT_REVEAL_HOST_CHECKPOINT_REQUEST,
  PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION,
} from "./preflight-reveal-host-checkpoint-contract.ts";

const DIGEST_LENGTH = 64;
const SOURCE_LENGTH = 40;
const GIBIBYTE = 1_073_741_824;
const RAW_FREE_GIBIBYTES = 10;
const AVAILABLE_GIBIBYTES = 9;
const TOTAL_GIBIBYTES = 16;
const SWAP_FREE_GIBIBYTES = 4;
const CONTROLLER_TIMESTAMP = 201;

export const digest = "a".repeat(DIGEST_LENGTH);
export const run = {
  campaignId: "campaign",
  sourceSha: "b".repeat(SOURCE_LENGTH),
  sourceTree: "c".repeat(SOURCE_LENGTH),
  treeDigest: digest,
  sourceDigest: digest,
  planDigest: digest,
  attemptId: "attempt-1",
  stateId: "state-1",
  stateDigest: digest,
  profile: "demo",
  role: "admin",
  route: "/demo",
  routeDigest: digest,
} as const satisfies HostCheckpointRun;

export const request = createHostCheckpointRequest({
  artifact: PREFLIGHT_REVEAL_HOST_CHECKPOINT_REQUEST,
  version: PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION,
  run,
  checkpointSequence: 1,
  completedChildOrdinal: 0,
  boundaryTimestamp: 100,
  receiptHead: null,
  receiptCount: 1,
  chunkHead: digest,
  chunkCount: 1,
  completedCandidateCount: 1,
  previousCheckpointDigest: null,
  previousSampleSequence: null,
});

export const sample = {
  eventSequence: 61,
  timestampWall: 200,
  status: "healthy" as const,
  reasons: [],
  breachStreaks: {
    rawFreeBytes: 0,
    availableBytes: 0,
    pressureFreePercent: 0,
    compressedBytes: 0,
  },
  pressureState: "normal" as const,
  metrics: {
    rawFreeBytes: RAW_FREE_GIBIBYTES * GIBIBYTE,
    availableBytes: AVAILABLE_GIBIBYTES * GIBIBYTE,
    totalBytes: TOTAL_GIBIBYTES * GIBIBYTE,
    swapFreeBytes: SWAP_FREE_GIBIBYTES * GIBIBYTE,
    pressureFreePercent: 80,
    swapUsedBytes: 0,
    compressedBytes: 1024,
    cumulativeCounters: {
      pageins: 100,
      pageouts: 50,
      swapins: 2,
      swapouts: 1,
    },
  },
  nextCounters: { pageins: 100, pageouts: 50, swapins: 2, swapouts: 1 },
};

export const response = createHostCheckpointResponse({
  artifact: PREFLIGHT_REVEAL_HOST_CHECKPOINT,
  version: PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION,
  status: "HEALTHY",
  run,
  checkpointSequence: 1,
  completedChildOrdinal: 0,
  requestDigest: request.requestDigest,
  predecessorCheckpointDigest: null,
  controllerObservationTimestamp: 201,
  sample,
  coverage: {
    priorSequence: 0,
    firstSequence: 1,
    lastSequence: 61,
    coveredCount: 61,
  },
  thresholdDigest: hostCheckpointThresholdDigest(),
  hostRecordDigest: hostRecordDigestFor(sample),
});

export const requestBodyFor = (
  value: HostCheckpointRequest,
  overrides: Partial<HostCheckpointRequest> = {},
): HostCheckpointRequest => {
  const { requestDigest: _requestDigest, ...body } = { ...value, ...overrides };
  return createHostCheckpointRequest(body);
};

export const responseFor = (
  value: HostCheckpointRequest,
  overrides: Readonly<{
    readonly controllerObservationTimestamp?: number;
    readonly sampleTimestamp?: number;
  }> = {},
) => {
  const nextSample = {
    ...sample,
    timestampWall: overrides.sampleTimestamp ?? sample.timestampWall,
  };
  return createHostCheckpointResponse({
    artifact: PREFLIGHT_REVEAL_HOST_CHECKPOINT,
    version: PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION,
    status: "HEALTHY",
    run: value.run,
    checkpointSequence: value.checkpointSequence,
    completedChildOrdinal: value.completedChildOrdinal,
    requestDigest: value.requestDigest,
    predecessorCheckpointDigest: value.previousCheckpointDigest,
    controllerObservationTimestamp:
      overrides.controllerObservationTimestamp ?? CONTROLLER_TIMESTAMP,
    sample: nextSample,
    coverage: {
      priorSequence: value.previousSampleSequence ?? 0,
      firstSequence: (value.previousSampleSequence ?? 0) + 1,
      lastSequence: nextSample.eventSequence,
      coveredCount:
        nextSample.eventSequence - (value.previousSampleSequence ?? 0),
    },
    thresholdDigest: hostCheckpointThresholdDigest(),
    hostRecordDigest: hostRecordDigestFor(nextSample),
  });
};
