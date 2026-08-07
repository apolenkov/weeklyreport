import { z } from "zod";

import type { KeyboardTrace } from "../../replay/keyboard-evidence.ts";
import {
  evidenceObservationSchema,
  type EvidenceRef,
} from "../../source/contracts.ts";
import type { EvidenceCaptureInput } from "../evidence-types.ts";
import type {
  ExpectedFault,
  RequestFailureRecord,
  ResponseRecord,
} from "../evidence-types.ts";
import type { ServerLogEvidence } from "../evidence-types.ts";

type Observation = z.infer<typeof evidenceObservationSchema>;
type CountObservation = readonly [
  string,
  Observation["kind"],
  number,
  string,
  EvidenceRef["kind"],
];

const PAGE_ERROR_KIND = "page-error" as const;
const OK_STATUS_LIMIT = 400;
const DEFAULT_NETWORK_POLICY = {
  maxRepeatedApiRequests: 3,
  retryStormThreshold: 5,
  slowRequestThresholdMs: 5000,
  cacheExpectedOperations: [],
} as const;
const byKind = (
  refs: readonly EvidenceRef[],
  kind: EvidenceRef["kind"],
): EvidenceRef => {
  const value = refs.find((candidate) => candidate.kind === kind);
  if (!value) throw new Error(`Runtime sweep evidence ref ${kind} is missing`);
  return value;
};

const countObservation = (
  spec: CountObservation,
  refs: readonly EvidenceRef[],
): Observation => {
  const [id, kind, count, label, refKind] = spec;
  return evidenceObservationSchema.parse({
    observationId: id,
    kind,
    outcome: count > 0 ? "fail" : "pass",
    message: `${count} ${label} observed`,
    evidenceIds: [byKind(refs, refKind).artifactId],
  });
};

const keyboardObservation = (
  input: EvidenceCaptureInput,
  refs: readonly EvidenceRef[],
  keyboard: KeyboardTrace,
): Observation => {
  const keyboardPass =
    keyboard.focusMoved &&
    keyboard.focusGaps.length === 0 &&
    input.inventory.issues.length === 0;
  return evidenceObservationSchema.parse({
    observationId: "keyboard",
    kind: "keyboard",
    outcome: keyboardPass ? "pass" : "fail",
    message: keyboardPass
      ? `Keyboard focus reached all ${keyboard.controls.length} controls with usable role/name evidence`
      : `${keyboard.focusGaps.length} enabled control(s) missed keyboard focus; ${input.inventory.issues.length} accessible-name issue(s) observed`,
    evidenceIds: [
      byKind(refs, "keyboard").artifactId,
      byKind(refs, "dom").artifactId,
    ],
  });
};

const functionalObservation = (
  refs: readonly EvidenceRef[],
  functional: Readonly<{ matches: boolean; message: string }>,
): Observation =>
  evidenceObservationSchema.parse({
    observationId: "functional",
    kind: "api",
    outcome: functional.matches ? "pass" : "fail",
    message: functional.message,
    evidenceIds: [byKind(refs, "api").artifactId],
  });

const navigationObservation = (
  input: EvidenceCaptureInput,
  refs: readonly EvidenceRef[],
): Observation =>
  evidenceObservationSchema.parse({
    observationId: "navigation",
    kind: "api",
    outcome:
      input.responseStatus !== null && input.responseStatus < OK_STATUS_LIMIT
        ? "pass"
        : "fail",
    message: `Navigation returned HTTP ${input.responseStatus ?? "no response"}`,
    evidenceIds: [byKind(refs, "url").artifactId],
  });

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
      (failure) => !matchedFaultFailures.includes(failure),
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
    expectedFaultMismatch,
  } as const;
};

const networkObservation = (
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
    message: `${failures.unexpectedRequestFailures.length} unexpected transport failure(s), ${failures.unexpectedHttpErrors.length} unexpected HTTP error response(s), ${failures.expectedFaultMismatch} expected fault mismatch(es), ${failures.repeatedRequests.length} repeated API request(s), ${failures.retryStorms.length} retry storm(s), ${failures.cacheContractMisses.length} cache contract miss(es), ${failures.slowRequests.length} slow API request(s), ${failures.missingCorrelations.length} API response(s) without correlation id`,
    evidenceIds: refs
      .filter(({ kind }) => kind === "request")
      .map(({ artifactId }) => artifactId),
  });
};

const visualObservation = (
  refs: readonly EvidenceRef[],
  screenshot: EvidenceRef,
  visualOracle: EvidenceRef,
  visual: Readonly<{ outcome: "pass" | "fail"; message: string }>,
): Observation =>
  evidenceObservationSchema.parse({
    observationId: "visual",
    kind: "geometry",
    outcome: visual.outcome,
    message: visual.message,
    evidenceIds: [
      byKind(refs, "geometry").artifactId,
      screenshot.artifactId,
      visualOracle.artifactId,
    ],
  });

const serverLogObservation = (
  refs: readonly EvidenceRef[],
  serverLogs: ServerLogEvidence,
): Observation => {
  const unexpectedErrors = serverLogs.errorCount;
  const failures =
    Number(!serverLogs.available) +
    serverLogs.malformedCount +
    serverLogs.missingCorrelationIds.length +
    unexpectedErrors +
    serverLogs.warningCount +
    serverLogs.slowCount;
  return evidenceObservationSchema.parse({
    observationId: "server-log",
    kind: "api",
    outcome: failures === 0 ? "pass" : "fail",
    message: `${serverLogs.records.length} correlated server/worker log record(s), ${serverLogs.malformedCount} malformed log line(s), ${serverLogs.missingCorrelationIds.length} missing correlation id(s), ${unexpectedErrors} unexpected error(s), ${serverLogs.warningCount} warning(s), ${serverLogs.slowCount} slow operation(s), ${serverLogs.workerCount} worker record(s)`,
    evidenceIds: [byKind(refs, "log").artifactId],
  });
};

export const observations = (
  input: EvidenceCaptureInput,
  refs: readonly EvidenceRef[],
  screenshot: EvidenceRef,
  visualOracle: EvidenceRef,
  visual: Readonly<{ outcome: "pass" | "fail"; message: string }>,
  violations: readonly unknown[],
  keyboard: KeyboardTrace,
  functional: Readonly<{ matches: boolean; message: string }> | null,
  serverLogs: ServerLogEvidence | null,
): readonly Observation[] => {
  const counts: readonly CountObservation[] = [
    [
      "console",
      "console",
      input.consoleMessages.length,
      "console message(s)",
      "console",
    ],
    [
      "page-error",
      PAGE_ERROR_KIND,
      input.pageErrors.length,
      "page error(s)",
      PAGE_ERROR_KIND,
    ],
    ["axe", "axe", violations.length, "axe violation(s)", "axe"],
  ];
  return Object.freeze([
    ...counts.map((spec) => countObservation(spec, refs)),
    networkObservation(input, refs),
    keyboardObservation(input, refs, keyboard),
    ...(functional === null ? [] : [functionalObservation(refs, functional)]),
    ...(serverLogs === null ? [] : [serverLogObservation(refs, serverLogs)]),
    navigationObservation(input, refs),
    visualObservation(refs, screenshot, visualOracle, visual),
  ]);
};
