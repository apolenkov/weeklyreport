import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { eventsFor } from "../matrix/runtime-matrix-evidence.ts";
import { NO_ROUTE_CACHE_CONTRACT_POLICY } from "../source/contracts.ts";
import {
  captureNetwork,
  controlledFault,
  errorResponse,
  networkOutcome,
  responseRecord,
  writeServerLog,
} from "./evidence-capture-network-fixture.ts";
import type { NetworkEvidencePolicy } from "./evidence-types.ts";

test("fails network evidence for an unexpected HTTP error response", async ({
  page,
}, testInfo) => {
  await page.setContent('<main><button type="button">Continue</button></main>');

  const result = await captureNetwork(
    page,
    testInfo,
    [errorResponse("report.get")],
    NO_ROUTE_CACHE_CONTRACT_POLICY,
  );

  expect(networkOutcome(result)).toBe("fail");
});

test("permits a declared HTTP error during a controlled fault phase", async ({
  page,
}, testInfo) => {
  await page.setContent('<main><button type="button">Continue</button></main>');

  const result = await captureNetwork(
    page,
    testInfo,
    [errorResponse("period.publish")],
    NO_ROUTE_CACHE_CONTRACT_POLICY,
    controlledFault,
  );

  expect(networkOutcome(result)).toBe("pass");
});

test("rejects an additional HTTP error during a controlled fault phase", async ({
  page,
}, testInfo) => {
  await page.setContent('<main><button type="button">Continue</button></main>');

  const result = await captureNetwork(
    page,
    testInfo,
    [errorResponse("period.publish"), errorResponse("user.get")],
    NO_ROUTE_CACHE_CONTRACT_POLICY,
    controlledFault,
  );

  expect(networkOutcome(result)).toBe("fail");
});

test("rejects an unrelated server error during a controlled fault phase", async ({
  page,
}, testInfo) => {
  await page.setContent('<main><button type="button">Continue</button></main>');
  const logPath = await writeServerLog(testInfo, {
    timestamp: "2026-08-07T00:00:01.000Z",
    level: "error",
    message: "unrelated server failure",
    correlationId: "unrelated-correlation",
    service: "customreport-api",
  });

  const result = await captureNetwork(
    page,
    testInfo,
    [errorResponse("period.publish")],
    NO_ROUTE_CACHE_CONTRACT_POLICY,
    controlledFault,
    logPath,
  );
  const serverLog = result.bundle.observations.find(
    ({ observationId }) => observationId === "server-log",
  );

  expect(networkOutcome(result)).toBe("pass");
  expect(serverLog?.outcome).toBe("fail");
});

test("rejects a correlated slow server operation", async ({
  page,
}, testInfo) => {
  await page.setContent('<main><button type="button">Continue</button></main>');
  const logPath = await writeServerLog(testInfo, {
    timestamp: "2026-08-07T00:00:00.050Z",
    level: "info",
    message: "slow database query",
    correlationId: "runtime-network-test",
    service: "customreport-api",
  });

  const result = await captureNetwork(
    page,
    testInfo,
    [responseRecord("report.get")],
    NO_ROUTE_CACHE_CONTRACT_POLICY,
    undefined,
    logPath,
  );
  const serverLog = result.bundle.observations.find(
    ({ observationId }) => observationId === "server-log",
  );

  expect(serverLog?.outcome).toBe("fail");
  expect(serverLog?.message).toContain("1 slow operation(s)");
});

test("fails an API response without a correlation id", async ({
  page,
}, testInfo) => {
  await page.setContent('<main><button type="button">Continue</button></main>');

  const result = await captureNetwork(
    page,
    testInfo,
    [responseRecord("report.get", { correlationId: null })],
    NO_ROUTE_CACHE_CONTRACT_POLICY,
  );

  expect(networkOutcome(result)).toBe("fail");
});

test("fails slow, repeated, and cache-contract API requests", async ({
  page,
}, testInfo) => {
  await page.setContent('<main><button type="button">Continue</button></main>');
  const policy: NetworkEvidencePolicy = {
    maxRepeatedApiRequests: 1,
    retryStormThreshold: 3,
    slowRequestThresholdMs: 50,
    cacheExpectedOperations: ["report.get"],
  };

  const result = await captureNetwork(
    page,
    testInfo,
    [responseRecord("report.get"), responseRecord("report.get")],
    policy,
    undefined,
  );
  const observation = result.bundle.observations.find(
    ({ observationId }) => observationId === "network",
  );

  expect(observation?.outcome).toBe("fail");
  expect(observation?.message).toContain("1 repeated API request(s)");
  expect(observation?.message).toContain("1 cache contract miss(es)");
  expect(observation?.message).toContain("2 slow API request(s)");
});

test("groups retry attempts by operation when technical query values change", async ({
  page,
}, testInfo) => {
  await page.setContent('<main><button type="button">Continue</button></main>');
  const policy: NetworkEvidencePolicy = {
    maxRepeatedApiRequests: 1,
    retryStormThreshold: 3,
    slowRequestThresholdMs: 5000,
    cacheExpectedOperations: [],
  };
  const first = responseRecord("report.get", {
    url: "/trpc/report.get?input=first&nonce=1",
  });
  const second = responseRecord("report.get", {
    url: "/trpc/report.get?input=second&nonce=2",
  });

  const result = await captureNetwork(
    page,
    testInfo,
    [first, second],
    policy,
    undefined,
  );
  const observation = result.bundle.observations.find(
    ({ observationId }) => observationId === "network",
  );

  expect(observation?.outcome).toBe("fail");
  expect(observation?.message).toContain("1 repeated API request(s)");
});

test("captures API response timing and correlation from the browser", async ({
  page,
}) => {
  await page.route("http://runtime.test/**", async (route) => {
    if (route.request().resourceType() === "document") {
      await route.fulfill({
        contentType: "text/html",
        body: '<main>Runtime</main><script>void fetch("/trpc/report.get")</script>',
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      headers: { "x-request-id": "runtime-browser-correlation" },
      body: JSON.stringify({ result: { data: { ok: true } } }),
    });
  });
  const events = eventsFor(page);
  try {
    await page.goto("http://runtime.test/harness");
    await expect
      .poll(() =>
        events.responses.find(({ url }) => url.includes("/trpc/report.get")),
      )
      .toBeDefined();
    const response = events.responses.find(({ url }) =>
      url.includes("/trpc/report.get"),
    );

    expect(response).toMatchObject({
      correlationId: "runtime-browser-correlation",
      status: 200,
      ok: true,
    });
    expect(response?.durationMs).toBeGreaterThanOrEqual(0);
    expect(Date.parse(response?.startedAt ?? "")).not.toBeNaN();
    expect(Date.parse(response?.endedAt ?? "")).not.toBeNaN();
  } finally {
    events.detach();
  }
});

test("keeps the response ledger open until delayed API work settles", async ({
  page,
}, testInfo) => {
  await page.route("http://runtime-tail.test/**", async (route) => {
    if (route.request().resourceType() === "document") {
      await route.fulfill({
        contentType: "text/html",
        body: '<main><button type="button">Continue</button></main>',
      });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    await route.fulfill({
      contentType: "application/json",
      headers: { "x-request-id": "runtime-tail-correlation" },
      body: JSON.stringify({ result: { data: { ok: true } } }),
    });
  });
  const events = eventsFor(page);
  try {
    await page.goto("http://runtime-tail.test/harness");
    await page.evaluate(() => {
      setTimeout(() => {
        void fetch("/trpc/report.tail");
      }, 10);
    });

    await captureNetwork(
      page,
      testInfo,
      events.responses,
      NO_ROUTE_CACHE_CONTRACT_POLICY,
      undefined,
      undefined,
      events.waitForIdle,
    );

    expect(
      events.responses.some(({ url }) => url.includes("/trpc/report.tail")),
    ).toBe(true);
  } finally {
    events.detach();
  }
});

test("freezes geometry before keyboard traversal scrolls the page", async ({
  page,
}, testInfo) => {
  await page.setContent(`
    <main data-layout-key="report-page" style="min-height:2200px">
      <button type="button">Top</button>
      <button type="button" style="position:absolute;top:2000px"
        onfocus="document.querySelector('main').style.transform='translateY(-500px)'">Bottom</button>
    </main>
  `);
  const result = await captureNetwork(
    page,
    testInfo,
    [],
    NO_ROUTE_CACHE_CONTRACT_POLICY,
  );
  const ref = result.all.find(({ kind }) => kind === "geometry");
  if (ref === undefined) throw new Error("Geometry evidence is missing");
  const geometry = JSON.parse(await readFile(ref.archivePath, "utf8")) as {
    readonly elements: readonly {
      readonly layoutKey: string | null;
      readonly y: number;
    }[];
  };
  const pageGeometry = geometry.elements.find(
    ({ layoutKey }) => layoutKey === "report-page",
  );
  const liveY = await page
    .locator("main")
    .evaluate((element) => element.getBoundingClientRect().y);
  expect(pageGeometry?.y).toBeGreaterThanOrEqual(0);
  expect(liveY).toBeLessThan(0);
});
