import { describe, expect, it } from "vitest";

import {
  canonicalHostCheckpointBytes,
  createHostCheckpointRequest,
  createHostCheckpointResponse,
  type HostCheckpointRun,
  hostCheckpointThresholdDigest,
  hostRecordDigestFor,
  parseCanonicalHostCheckpointRequest,
  parseCanonicalHostCheckpointResponse,
  parseHostCheckpointRequest,
  parseHostCheckpointResponse,
  PREFLIGHT_REVEAL_HOST_CHECKPOINT,
  PREFLIGHT_REVEAL_HOST_CHECKPOINT_REQUEST,
  PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION,
  requestDigestForBody,
  responseDigestForBody,
} from "./preflight-reveal-host-checkpoint-contract.ts";

const digest = "a".repeat(64);
const run = {
  campaignId: "campaign",
  sourceSha: "b".repeat(40),
  sourceTree: "c".repeat(40),
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
const request = createHostCheckpointRequest({
  artifact: PREFLIGHT_REVEAL_HOST_CHECKPOINT_REQUEST,
  version: PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION,
  run,
  checkpointSequence: 1,
  completedChildOrdinal: 0,
  boundaryTimestamp: 100,
  receiptHead: digest,
  receiptCount: 1,
  chunkHead: digest,
  chunkCount: 1,
  completedCandidateCount: 1,
  previousCheckpointDigest: null,
  previousSampleSequence: null,
});
const sample = {
  eventSequence: 61,
  timestampWall: 200,
  phase: "runtime" as const,
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
    rawFreeBytes: 10 * 1024 ** 3,
    availableBytes: 9 * 1024 ** 3,
    totalBytes: 16 * 1024 ** 3,
    swapFreeBytes: 4 * 1024 ** 3,
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
const response = createHostCheckpointResponse({
  artifact: PREFLIGHT_REVEAL_HOST_CHECKPOINT,
  version: PREFLIGHT_REVEAL_HOST_CHECKPOINT_VERSION,
  status: "HEALTHY",
  run,
  checkpointSequence: 1,
  completedChildOrdinal: 0,
  requestDigest: request.requestDigest,
  predecessorCheckpointDigest: null,
  controllerObservationTimestamp: 201,
  baselineReceiptDigest: "d".repeat(64),
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

describe("source-bound host checkpoint contract", () => {
  it("round-trips canonical request and response bytes", () => {
    const { requestDigest: _requestDigest, ...requestBody } = request;
    const { responseDigest: _responseDigest, ...responseBody } = response;
    expect(parseHostCheckpointRequest(request)).toEqual(request);
    expect(parseHostCheckpointResponse(response)).toEqual(response);
    expect(requestDigestForBody(requestBody)).toBe(request.requestDigest);
    expect(responseDigestForBody(responseBody)).toBe(response.responseDigest);
    expect(
      parseCanonicalHostCheckpointRequest(
        canonicalHostCheckpointBytes(request),
      ),
    ).toEqual(request);
    expect(
      parseCanonicalHostCheckpointResponse(
        canonicalHostCheckpointBytes(response),
      ),
    ).toEqual(response);
  });

  it("rejects tampered and noncanonical bytes while leaving freshness to the client", () => {
    const bytes = canonicalHostCheckpointBytes(response);
    expect(() =>
      parseCanonicalHostCheckpointResponse(
        bytes.replace("HEALTHY", "HEALTHY "),
      ),
    ).toThrow();
    expect(() =>
      parseCanonicalHostCheckpointResponse(`${bytes.trim()}\n `),
    ).toThrow();
    expect(() =>
      parseCanonicalHostCheckpointResponse(
        canonicalHostCheckpointBytes({ ...response, thresholdDigest: digest }),
      ),
    ).toThrow();
    const { responseDigest: _responseDigest, ...responseBody } = response;
    const structurallyValidOlder = createHostCheckpointResponse({
      ...responseBody,
      controllerObservationTimestamp: 99,
    });
    expect(() =>
      parseHostCheckpointResponse(structurallyValidOlder),
    ).not.toThrow();
  });

  it("rejects malformed, oversized, gapped, breach and non-normal projections", () => {
    expect(() => parseCanonicalHostCheckpointResponse("{\n")).toThrow();
    expect(() =>
      parseCanonicalHostCheckpointResponse("x".repeat(16 * 1024 + 1)),
    ).toThrow();
    expect(() =>
      parseHostCheckpointResponse({
        ...response,
        coverage: { ...response.coverage, coveredCount: 1 },
      }),
    ).toThrow();
    expect(() =>
      createHostCheckpointResponse({
        ...response,
        sample: { ...sample, status: "breach" },
      } as never),
    ).toThrow();
    expect(() =>
      createHostCheckpointResponse({
        ...response,
        sample: { ...sample, pressureState: "warning" },
      } as never),
    ).toThrow();
  });

  it("rejects sequence and predecessor shape drift before publication", () => {
    const { requestDigest: _requestDigest, ...requestBody } = request;
    expect(() =>
      createHostCheckpointRequest({
        ...requestBody,
        checkpointSequence: 2,
      }),
    ).toThrow(/next child ordinal/u);
    expect(() =>
      createHostCheckpointRequest({
        ...requestBody,
        previousCheckpointDigest: digest,
      }),
    ).toThrow(/no predecessor/u);
    expect(() =>
      createHostCheckpointRequest({
        ...requestBody,
        checkpointSequence: 2,
        completedChildOrdinal: 1,
      }),
    ).toThrow(/requires a predecessor/u);

    const { responseDigest: _responseDigest, ...responseBody } = response;
    expect(() =>
      createHostCheckpointResponse({
        ...responseBody,
        completedChildOrdinal: 1,
      }),
    ).toThrow(/completed child successor/u);
  });
});
