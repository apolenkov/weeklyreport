import { z } from "zod";

import {
  evidenceObservationSchema,
  type EvidenceRef,
} from "../../source/contracts.ts";
import type {
  EvidenceCaptureInput,
  ExpectedFault,
  RequestFailureRecord,
  ResponseRecord,
} from "../evidence-types.ts";
import { isExpectedObservabilityAbort } from "../expected-observability-abort.ts";

type Observation = z.infer<typeof evidenceObservationSchema>;

const OK_STATUS_LIMIT = 400;
const DEFAULT_NETWORK_POLICY = {
  maxRepeatedApiRequests: 3,
  retryStormThreshold: 5,
  slowRequestThresholdMs: 5000,
  cacheExpectedOperations: [],
} as const;

const faultUrlMatches = (url: string, expected: ExpectedFault): boolean =>
  url.includes(`/trpc/${expected.operation}`);

const expectedFaultResponses = (
  responses: readonly ResponseRecord[],
  expected: ExpectedFault | undefined,
): readonly ResponseRecord[] =>
  expected?.expectedStatus === null || expected === undefined
    ? []
    : responses.filter(
        ({ method, status, url }) =>
          method === expected.method &&
          status === expected.expectedStatus &&
          faultUrlMatches(url, expected),
      );

const expectedFaultFailures = (
  failures: readonly RequestFailureRecord[],
  expected: ExpectedFault | undefined,
): readonly RequestFailureRecord[] =>
  expected?.expectedTransportFailure === null || expected === undefined
    ? []
    : failures.filter(
        ({ failure, method, url }) =>
          method === expected.method &&
          faultUrlMatches(url, expected) &&
          failure?.includes(expected.expectedTransportFailure ?? "") === true,
      );

const apiOperationKey = (
  response: Pick<ResponseRecord, "method" | "url">,
): string => {
  try {
    return `${response.method} ${new URL(response.url, "https://runtime.invalid").pathname}`;
  } catch {
    return `${response.method} ${response.url}`;
  }
};

const networkFailures = (input: EvidenceCaptureInput) => {
  const responses = input.responses ?? [];
  const policy = input.networkPolicy ?? DEFAULT_NETWORK_POLICY;
  const expectedObservabilityAbortCount = input.requestFailures.filter(
    (failure) =>
      isExpectedObservabilityAbort(failure, responses, input.bugsinkDsn),
  ).length;
  const apiResponses = responses.filter(
    ({ resourceType, url }) =>
      ["fetch", "xhr"].includes(resourceType) && url.includes("/trpc/"),
  );
  const httpErrors = responses.filter(
    ({ status }) => status >= OK_STATUS_LIMIT,
  );
  const matchedFaultResponses = expectedFaultResponses(
    httpErrors,
    input.expectedFault,
  );
  const matchedFaultFailures = expectedFaultFailures(
    input.requestFailures,
    input.expectedFault,
  );
  const expectedFaultCount =
    matchedFaultResponses.length + matchedFaultFailures.length;
  const expectedFaultMismatch =
    input.expectedFault === undefined ||
    expectedFaultCount === input.expectedFault.expectedCount
      ? 0
      : 1;
  const requestCounts = apiResponses.reduce<ReadonlyMap<string, number>>(
    (counts, response) => {
      const key = apiOperationKey(response);
      return new Map(counts).set(key, (counts.get(key) ?? 0) + 1);
    },
    new Map(),
  );
  return {
    unexpectedHttpErrors: httpErrors.filter(
      (response) => !matchedFaultResponses.includes(response),
    ),
    unexpectedRequestFailures: input.requestFailures.filter(
      (failure) =>
        !matchedFaultFailures.includes(failure) &&
        !isExpectedObservabilityAbort(failure, responses, input.bugsinkDsn),
    ),
    repeatedRequests: [...requestCounts.entries()].filter(
      ([, count]) => count > policy.maxRepeatedApiRequests,
    ),
    retryStorms: [...requestCounts.entries()].filter(
      ([, count]) => count >= policy.retryStormThreshold,
    ),
    cacheContractMisses: policy.cacheExpectedOperations.filter(
      (operation) =>
        apiResponses.filter(({ url }) => url.includes(operation)).length > 1,
    ),
    slowRequests: apiResponses.filter(
      ({ durationMs }) => durationMs > policy.slowRequestThresholdMs,
    ),
    missingCorrelations: apiResponses.filter(
      (response) =>
        response.correlationId === null &&
        !matchedFaultResponses.includes(response),
    ),
    expectedObservabilityAbortCount,
    expectedFaultMismatch,
  } as const;
};

export const networkObservation = (
  input: EvidenceCaptureInput,
  refs: readonly EvidenceRef[],
): Observation => {
  const failures = networkFailures(input);
  const failureCount =
    [
      ...failures.unexpectedRequestFailures,
      ...failures.unexpectedHttpErrors,
      ...failures.repeatedRequests,
      ...failures.retryStorms,
      ...failures.cacheContractMisses,
      ...failures.slowRequests,
      ...failures.missingCorrelations,
    ].length + failures.expectedFaultMismatch;
  return evidenceObservationSchema.parse({
    observationId: "network",
    kind: "network",
    outcome: failureCount > 0 ? "fail" : "pass",
    message: `${failures.unexpectedRequestFailures.length} unexpected transport failure(s), ${failures.expectedObservabilityAbortCount} expected observability abort(s) ignored, ${failures.unexpectedHttpErrors.length} unexpected HTTP error response(s), ${failures.expectedFaultMismatch} expected fault mismatch(es), ${failures.repeatedRequests.length} repeated API request(s), ${failures.retryStorms.length} retry storm(s), ${failures.cacheContractMisses.length} cache contract miss(es), ${failures.slowRequests.length} slow API request(s), ${failures.missingCorrelations.length} API response(s) without correlation id`,
    evidenceIds: refs
      .filter(({ kind }) => kind === "request")
      .map(({ artifactId }) => artifactId),
  });
};
