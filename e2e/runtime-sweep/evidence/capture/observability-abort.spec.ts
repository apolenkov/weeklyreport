import { expect, test } from "@playwright/test";

import type { MatrixExecutableCase } from "../../matrix/matrix-finalizer.ts";
import type { SpecializedRuntimeEventWindow } from "../../matrix/specialized-case-emission.ts";
import { captureSpecializedPagePhase } from "../../matrix/specialized-case-emission.ts";
import {
  captureNetworkWithFailures,
  responseRecord,
} from "../evidence-capture-network-fixture.ts";
import type { RequestFailureRecord } from "../evidence-types.ts";

const CAPTURED_AT = "2026-08-08T00:00:00.000Z";
const SOURCE_SHA = "a".repeat(40);
const BUGSINK_DSN = "http://runtime@bugsink.test/1";
const ENVELOPE_URL =
  "http://bugsink.test/api/1/envelope/?sentry_version=7&sentry_key=runtime&sentry_client=sentry.javascript.browser%2F10.22.0";

const requestFailure = (url: string): RequestFailureRecord => ({
  requestId: "sentry-envelope-request",
  url,
  method: "POST",
  resourceType: "fetch",
  failure: "net::ERR_ABORTED",
  startedAt: CAPTURED_AT,
  endedAt: "2026-08-08T00:00:00.001Z",
  durationMs: 1,
});

const networkObservation = (
  result: Awaited<ReturnType<typeof captureNetworkWithFailures>>,
) => {
  const observation = result.bundle.observations.find(
    ({ observationId }) => observationId === "network",
  );
  if (observation === undefined)
    throw new Error("Network observation is missing");
  return observation;
};

test("passes an expected Sentry envelope abort and reports the ignored count", async ({
  page,
}, testInfo) => {
  await page.setContent('<main><button type="button">Continue</button></main>');

  const result = await captureNetworkWithFailures(
    page,
    testInfo,
    [requestFailure(ENVELOPE_URL)],
    [
      responseRecord("sentry-envelope", {
        requestId: "sentry-envelope-request",
        url: ENVELOPE_URL,
        correlationId: null,
      }),
    ],
  );
  const observation = networkObservation(result);

  expect(observation.outcome).toBe("pass");
  expect(observation.message).toContain(
    "1 expected observability abort(s) ignored",
  );
});

test("fails a product transport abort with the same failure text", async ({
  page,
}, testInfo) => {
  await page.setContent('<main><button type="button">Continue</button></main>');

  const result = await captureNetworkWithFailures(page, testInfo, [
    requestFailure("/trpc/report.get"),
  ]);
  const observation = networkObservation(result);

  expect(observation.outcome).toBe("fail");
  expect(observation.message).toContain("1 unexpected transport failure(s)");
});

const matrixCase = (suffix: string): MatrixExecutableCase => ({
  caseId: `case-specialized-observability-${suffix}`,
  stateId: `state-specialized-observability-${suffix}`,
  sourceSha: SOURCE_SHA,
  profile: "full",
  role: "head",
  catalogRoute: "/head/report/[reportId]",
  resolvedRoute: "/head/report/active",
  state: {
    profileCapability: "publish-flow",
    lifecycle: "open",
    submission: "draft",
    ownershipDensity: "single",
    permission: "head",
    fault: "http-5xx",
    controlTransition: "publish",
  },
  kind: "executable",
  execution: {
    kind: "fault",
    faultId: "publish-http-5xx",
    action: {
      controlKey: "declaration:publish-http-5xx",
      operation: "publish",
      safety: "irreversible",
      transition: "publish",
    },
  },
});

const initialEvents = (
  responseRequestId: string,
): SpecializedRuntimeEventWindow => ({
  consoleMessages: [],
  pageErrors: [],
  requestFailures: [requestFailure(ENVELOPE_URL)],
  responses: [
    responseRecord("specialized-envelope", {
      requestId: responseRequestId,
      url: ENVELOPE_URL,
      correlationId: null,
    }),
  ],
});

const captureSpecialized = async (
  page: Parameters<typeof captureSpecializedPagePhase>[0]["page"],
  archiveRoot: string,
  suffix: string,
  responseRequestId: string,
) =>
  captureSpecializedPagePhase({
    page,
    archiveRoot,
    bugsinkDsn: BUGSINK_DSN,
    matrixCase: matrixCase(suffix),
    phase: "before",
    capturedAt: CAPTURED_AT,
    responseStatus: 200,
    initialEvents: initialEvents(responseRequestId),
    functionalAssertion: {
      assertionId: `specialized-observability-${suffix}`,
      expected: { reachable: true },
      actual: { reachable: true },
      message: "Specialized initial navigation reached the report surface",
    },
  });

const specializedNetworkOutcome = (
  bundle: Awaited<ReturnType<typeof captureSpecialized>>,
): string | undefined =>
  bundle.observations.find(({ observationId }) => observationId === "network")
    ?.outcome;

test("accepts an exact specialized initial-navigation abort with the same request response", async ({
  page,
}, testInfo) => {
  await page.setContent('<main><button type="button">Continue</button></main>');

  const bundle = await captureSpecialized(
    page,
    testInfo.outputPath("exact"),
    "exact",
    "sentry-envelope-request",
  );

  expect(specializedNetworkOutcome(bundle)).toBe("pass");
});

test("rejects an unrelated specialized envelope response", async ({
  page,
}, testInfo) => {
  await page.setContent('<main><button type="button">Continue</button></main>');

  const bundle = await captureSpecialized(
    page,
    testInfo.outputPath("foreign"),
    "foreign",
    "different-envelope-request",
  );

  expect(specializedNetworkOutcome(bundle)).toBe("fail");
});
