import { expect, type Page, test, type TestInfo } from "@playwright/test";

import { inventoryDom } from "./dom-inventory.ts";
import { captureRouteEvidence } from "./evidence-capture.ts";
import {
  LEAD_FORM_UNAVAILABLE_MARKER,
  observeRuntimeSurface,
} from "./runtime-surface-expectation.ts";

const SOURCE_SHA = "0123456789abcdef0123456789abcdef01234567";
const EXPECTED_UNAVAILABLE_SURFACE = {
  productContent: "denied",
  productActions: "inapplicable",
  marker: {
    kind: "lead-form-unavailable",
    present: true,
    heading: { text: LEAD_FORM_UNAVAILABLE_MARKER.heading, count: 1 },
    status: { text: LEAD_FORM_UNAVAILABLE_MARKER.status, count: 1 },
  },
} as const;

const captureSurfaceEvidence = async (
  page: Page,
  testInfo: TestInfo,
): Promise<Awaited<ReturnType<typeof captureRouteEvidence>>> => {
  const observed = await observeRuntimeSurface(page);
  return captureRouteEvidence({
    page,
    archiveRoot: testInfo.outputPath("archive"),
    sourceSha: SOURCE_SHA,
    profile: "minimal",
    role: "lead",
    catalogRoute: "/lead/report/[reportId]",
    resolvedRoute: "/lead/report/report-id",
    cellId: "runtime-surface-harness",
    inventory: await inventoryDom(page),
    consoleMessages: [],
    pageErrors: [],
    requestFailures: [],
    responseStatus: 200,
    capturedAt: "2026-08-05T00:00:00.000Z",
    functionalAssertion: {
      assertionId: "lead-form-unavailable-surface",
      expected: { reachable: true, surface: EXPECTED_UNAVAILABLE_SURFACE },
      actual: { reachable: true, surface: observed },
      message: "Lead form unavailable surface was observed in live DOM",
    },
    geometryOracle: {
      viewport: { width: 1440, height: 900 },
      maxHorizontalOverflow: 0,
      requireNoZeroSize: false,
    },
  });
};

const pageWithSurface = async (page: Page, status: string): Promise<void> => {
  await page.setContent(`
    <html lang="en"><body>
      <main id="main-content">
        <h1>${LEAD_FORM_UNAVAILABLE_MARKER.heading}</h1>
        <p role="status">${status}</p>
        <button type="button">Sign out</button>
      </main>
    </body></html>
  `);
};

test("passes functional evidence only for the observed denied marker", async ({
  page,
}, testInfo) => {
  await pageWithSurface(page, LEAD_FORM_UNAVAILABLE_MARKER.status);

  const observed = await observeRuntimeSurface(page);
  expect(observed.marker.present).toBe(true);
  const result = await captureSurfaceEvidence(page, testInfo);
  expect(
    result.bundle.observations.find(
      ({ observationId }) => observationId === "functional",
    )?.outcome,
  ).toBe("pass");
});

test("fails functional evidence when the denied marker is absent or wrong", async ({
  page,
}, testInfo) => {
  await pageWithSurface(page, "A different status");

  const observed = await observeRuntimeSurface(page);
  expect(observed.marker.present).toBe(false);
  const result = await captureSurfaceEvidence(page, testInfo);
  expect(
    result.bundle.observations.find(
      ({ observationId }) => observationId === "functional",
    )?.outcome,
  ).toBe("fail");
});

test("fails functional evidence when the unavailable marker is absent", async ({
  page,
}, testInfo) => {
  await page.setContent(`
    <html lang="en"><body>
      <main id="main-content"><button type="button">Sign out</button></main>
    </body></html>
  `);

  const observed = await observeRuntimeSurface(page);
  expect(observed.marker.present).toBe(false);
  const result = await captureSurfaceEvidence(page, testInfo);
  expect(
    result.bundle.observations.find(
      ({ observationId }) => observationId === "functional",
    )?.outcome,
  ).toBe("fail");
});
