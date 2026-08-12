import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { expect, test, type TestInfo } from "@playwright/test";

import { inventoryDom } from "../replay/dom/dom-inventory.ts";
import { NO_ROUTE_CACHE_CONTRACT_POLICY } from "../source/contracts.ts";
import { captureRouteEvidence } from "./evidence-capture.ts";
import type {
  EvidenceCaptureInput,
  EvidenceCaptureResult,
  FunctionalAssertion,
  GeometryOracle,
  VisualBaseline,
} from "./evidence-types.ts";

const SOURCE_SHA = "0123456789abcdef0123456789abcdef01234567";
const GEOMETRY_ORACLE: GeometryOracle = {
  viewport: { width: 1440, height: 900 },
  maxHorizontalOverflow: 0,
  requireNoZeroSize: true,
};

type CaptureOverrides = Readonly<{
  cellId?: string;
  capturePhase?: EvidenceCaptureInput["capturePhase"];
  inventory?: EvidenceCaptureInput["inventory"];
  functionalAssertion?: FunctionalAssertion;
  visualBaseline?: VisualBaseline;
  geometryOracle?: GeometryOracle;
}>;

const capture = async (
  page: Parameters<typeof inventoryDom>[0],
  testInfo: TestInfo,
  overrides: CaptureOverrides = {},
): Promise<EvidenceCaptureResult> => {
  const optional = {
    ...(overrides.capturePhase === undefined
      ? {}
      : { capturePhase: overrides.capturePhase }),
    ...(overrides.functionalAssertion === undefined
      ? {}
      : { functionalAssertion: overrides.functionalAssertion }),
    ...(overrides.visualBaseline === undefined
      ? {}
      : { visualBaseline: overrides.visualBaseline }),
    ...(overrides.geometryOracle === undefined
      ? {}
      : { geometryOracle: overrides.geometryOracle }),
  };
  return captureRouteEvidence({
    page,
    archiveRoot: testInfo.outputPath("archive"),
    sourceSha: SOURCE_SHA,
    profile: "minimal",
    role: "viewer",
    catalogRoute: "/harness",
    resolvedRoute: "/harness",
    cellId: overrides.cellId ?? "harness-cell",
    inventory: overrides.inventory ?? (await inventoryDom(page)),
    consoleMessages: [],
    pageErrors: [],
    requestFailures: [],
    networkPolicy: NO_ROUTE_CACHE_CONTRACT_POLICY,
    responseStatus: 200,
    capturedAt: "2026-08-04T00:00:00.000Z",
    ...optional,
  });
};

const baselineFor = async (
  page: Parameters<typeof inventoryDom>[0],
  testInfo: TestInfo,
): Promise<VisualBaseline> => {
  const archivePath = testInfo.outputPath("immutable-baseline.png");
  const content = await page.screenshot({ path: archivePath, fullPage: true });
  return {
    archivePath,
    digest: createHash("sha256").update(content).digest("hex"),
    sourceSha: SOURCE_SHA,
    reviewedMasks: [],
  };
};

const observationOutcome = (
  result: EvidenceCaptureResult,
  observationId: string,
): string => {
  const observation = result.bundle.observations.find(
    ({ observationId: currentId }) => currentId === observationId,
  );
  if (!observation) throw new Error(`Missing ${observationId} observation`);
  return observation.outcome;
};

test("passes visual evidence only when the immutable baseline digest matches", async ({
  page,
}, testInfo) => {
  await page.setContent('<main><button type="button">Continue</button></main>');
  const baseline = await baselineFor(page, testInfo);

  const result = await capture(page, testInfo, {
    visualBaseline: baseline,
  });

  expect(observationOutcome(result, "visual")).toBe("pass");
});

test("blocks a visual digest change outside reviewed masks", async ({
  page,
}, testInfo) => {
  await page.setContent(
    '<main style="background:white"><button type="button">Continue</button></main>',
  );
  const baseline = await baselineFor(page, testInfo);
  await page.locator("main").evaluate((element) => {
    element.style.background = "black";
  });

  const result = await capture(page, testInfo, { visualBaseline: baseline });
  const visual = result.bundle.observations.find(
    ({ observationId }) => observationId === "visual",
  );

  expect(visual?.outcome).toBe("fail");
  expect(visual?.message).toContain("visual digest changed");
});

test("rejects a visual baseline from a different source SHA", async ({
  page,
}, testInfo) => {
  await page.setContent('<main><button type="button">Continue</button></main>');
  const baseline = await baselineFor(page, testInfo);

  await expect(
    capture(page, testInfo, {
      visualBaseline: { ...baseline, sourceSha: "f".repeat(40) },
    }),
  ).rejects.toThrow("does not match capture");
});

test("fails visual geometry evidence when the viewport overflows", async ({
  page,
}, testInfo) => {
  await page.setContent(
    '<main><div style="width:2000px;height:20px">Wide</div><button>Continue</button></main>',
  );

  const result = await capture(page, testInfo, {
    geometryOracle: GEOMETRY_ORACLE,
  });

  expect(observationOutcome(result, "visual")).toBe("fail");
  expect(
    result.bundle.observations.find(
      ({ observationId }) => observationId === "visual",
    )?.message,
  ).toContain("horizontal overflow");
});

test("fails accessibility evidence when axe reports a violation", async ({
  page,
}, testInfo) => {
  await page.setContent(
    '<main><img style="width:20px;height:20px" src="data:image/png;base64,iVBORw0KGgo=" /></main>',
  );

  const result = await capture(page, testInfo, {
    geometryOracle: GEOMETRY_ORACLE,
  });

  expect(observationOutcome(result, "axe")).toBe("fail");
});

test("stores compact axe evidence without duplicating successful node payloads", async ({
  page,
}, testInfo) => {
  await page.setContent(
    '<html lang="en"><head><title>Evidence</title></head><body><main><h1>Evidence</h1></main></body></html>',
  );

  const result = await capture(page, testInfo, {
    geometryOracle: GEOMETRY_ORACLE,
  });
  const axeRef = result.all.find(({ kind }) => kind === "axe");
  if (axeRef === undefined) throw new Error("Axe evidence is missing");
  const content = await readFile(axeRef.archivePath, "utf8");
  const evidence = JSON.parse(content) as {
    readonly passes: readonly Record<string, unknown>[];
    readonly fullPageAfterPortalClose: {
      readonly passes: readonly Record<string, unknown>[];
    };
  };

  expect(content).not.toContain('\n  "');
  expect(evidence.passes[0]).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      nodeCount: expect.any(Number),
    }),
  );
  expect(evidence.passes[0]).not.toHaveProperty("nodes");
  expect(evidence.fullPageAfterPortalClose.passes[0]).not.toHaveProperty(
    "nodes",
  );
});

test("fails accessibility evidence when an enabled control misses keyboard focus", async ({
  page,
}, testInfo) => {
  await page.setContent('<main><button tabindex="-1">Skip</button></main>');

  const result = await capture(page, testInfo, {
    geometryOracle: GEOMETRY_ORACLE,
  });

  expect(observationOutcome(result, "keyboard")).toBe("fail");
});

test("refreshes action inventory after a rerender before keyboard capture", async ({
  page,
}, testInfo) => {
  await page.setContent(`
    <style>@keyframes settle { from { opacity: 1; } to { opacity: 0.99; } } #transition { width: 1px; height: 1px; animation: settle 100ms linear; }</style>
    <main><button type="button">Before</button>
      <div id="transition"></div>
    </main>
    <script>
      document.querySelector("#transition")?.addEventListener("animationend", () => {
        const current = document.querySelector("button");
        const replacement = document.createElement("button");
        replacement.type = "button";
        replacement.textContent = "After";
        current?.replaceWith(replacement);
      });
    </script>
  `);
  const staleInventory = await inventoryDom(page);

  const result = await capture(page, testInfo, {
    capturePhase: "action",
    geometryOracle: GEOMETRY_ORACLE,
    inventory: staleInventory,
  });
  const readArtifact = async (kind: string): Promise<unknown> => {
    const ref = result.all.find((candidate) => candidate.kind === kind);
    if (ref === undefined) throw new Error(`Missing ${kind} artifact`);
    return JSON.parse(await readFile(ref.archivePath, "utf8"));
  };
  const dom = (await readArtifact("dom")) as {
    readonly controls: readonly { readonly accessibleName: string }[];
  };
  const keyboard = (await readArtifact("keyboard")) as {
    readonly controls: readonly { readonly accessibleName: string }[];
  };

  expect(dom.controls.map(({ accessibleName }) => accessibleName)).toEqual([
    "After",
  ]);
  expect(keyboard.controls.map(({ accessibleName }) => accessibleName)).toEqual(
    ["After"],
  );
});

test("does not claim functional evidence from navigation status alone", async ({
  page,
}, testInfo) => {
  await page.setContent('<main><button type="button">Continue</button></main>');

  const result = await capture(page, testInfo, {
    geometryOracle: GEOMETRY_ORACLE,
  });

  expect(result.bundle.inapplicable).toContainEqual({
    dimension: "function",
    reason:
      "Route capture observed navigation only; a functionalAssertion is required for functional evidence",
  });
  expect(
    result.bundle.observations.some(
      ({ observationId }) => observationId === "functional",
    ),
  ).toBe(false);
});

test("records a machine-checkable functional assertion when supplied", async ({
  page,
}, testInfo) => {
  await page.setContent('<main><button type="button">Continue</button></main>');

  const result = await capture(page, testInfo, {
    geometryOracle: GEOMETRY_ORACLE,
    functionalAssertion: {
      assertionId: "route-rendered",
      expected: { ready: true },
      actual: { ready: true },
      message: "Route state assertion matched",
    },
  });

  expect(observationOutcome(result, "functional")).toBe("pass");
  expect(result.bundle.inapplicable).not.toContainEqual({
    dimension: "function",
  });
});

test("keeps artifacts in cell-scoped directories for the same route", async ({
  page,
}, testInfo) => {
  await page.setContent('<main><button type="button">Continue</button></main>');

  const first = await capture(page, testInfo, {
    cellId: "state-cell-a",
    capturePhase: "after",
    geometryOracle: GEOMETRY_ORACLE,
  });
  const second = await capture(page, testInfo, {
    cellId: "state-cell-b",
    capturePhase: "after",
    geometryOracle: GEOMETRY_ORACLE,
  });
  const firstPaths = first.all.map(({ archivePath }) => archivePath);
  const secondPaths = second.all.map(({ archivePath }) => archivePath);

  expect(new Set([...firstPaths, ...secondPaths]).size).toBe(
    firstPaths.length + secondPaths.length,
  );
  expect(
    firstPaths.every((archivePath) => archivePath.includes("state-cell-a")),
  ).toBe(true);
  expect(
    secondPaths.every((archivePath) => archivePath.includes("state-cell-b")),
  ).toBe(true);
});
