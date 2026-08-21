import { expect, type Page, test, type TestInfo } from "@playwright/test";

import { captureRouteEvidence } from "../../evidence/evidence-capture";
import type { RequestFailureRecord } from "../../evidence/evidence-types.ts";
import { NO_ROUTE_CACHE_CONTRACT_POLICY } from "../../source/contracts.ts";
import { inventoryDom } from "./dom-inventory";

const SOURCE_SHA = "0123456789abcdef0123456789abcdef01234567";

async function captureHarnessEvidence(
  page: Page,
  testInfo: TestInfo,
  input: Readonly<{
    capturePhase?: "before" | "after";
    consoleMessages?: readonly { type: string; text: string }[];
    requestFailures?: readonly RequestFailureRecord[];
  }> = {},
) {
  return captureRouteEvidence({
    page,
    archiveRoot: testInfo.outputPath("evidence"),
    sourceSha: SOURCE_SHA,
    profile: "minimal",
    role: "viewer",
    catalogRoute: "/harness",
    resolvedRoute: "/harness",
    cellId: "harness-cell",
    inventory: await inventoryDom(page),
    consoleMessages: input.consoleMessages ?? [],
    pageErrors: [],
    requestFailures: input.requestFailures ?? [],
    responses: [],
    networkPolicy: NO_ROUTE_CACHE_CONTRACT_POLICY,
    responseStatus: 200,
    capturedAt: "2026-08-04T00:00:00.000Z",
    ...(input.capturePhase === undefined
      ? {}
      : { capturePhase: input.capturePhase }),
  });
}

test("inventories visible semantic controls and their metadata", async ({
  page,
}) => {
  await page.setContent(`
    <main>
      <a href="/reports">Reports</a>
      <button type="button">Save</button>
      <label for="title">Title</label><input id="title" type="text">
      <label><input type="checkbox">Agree</label>
      <select aria-label="Status" data-interaction-effect="mutation-required"><option>Open</option></select>
      <button aria-expanded="false" aria-controls="panel-row" data-reveal-independence="source-bound-row-local">Row details</button>
      <textarea aria-label="Notes"></textarea>
      <details open><summary>More</summary></details>
      <div contenteditable="true" aria-label="Editor">Text</div>
      <div role="tab" aria-selected="true">Overview</div>
      <div role="dialog" aria-label="Help" style="width:100px;height:20px"></div>
    </main>
  `);

  const inventory = await inventoryDom(page);
  const roles = inventory.controls.map((control) => control.role);

  expect(roles).toEqual([
    "link",
    "button",
    "textbox",
    "checkbox",
    "combobox",
    "textbox",
    "button",
    "textbox",
    "tab",
    "dialog",
  ]);
  expect(inventory.controls[0]?.href).toBe("/reports");
  expect(inventory.controls[2]?.inputType).toBe("text");
  expect(inventory.controls[4]?.interactionEffect).toBe("mutation-required");
  expect(inventory.controls[5]?.disclosureIndependence).toBe(
    "source-bound-row-local",
  );
  expect(inventory.controls[2]?.interactionEffect).toBeUndefined();
  expect(inventory.controls.every((control) => control.visible)).toBe(true);
  expect(inventory.issues).toHaveLength(0);
});

test("preserves mutation metadata for reopen decision buttons", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button">Cancel</button>
    <button type="button" data-interaction-effect="mutation-required">Reject</button>
    <button type="button" data-interaction-effect="mutation-required">Approve</button>
  `);

  const controls = (await inventoryDom(page)).controls;

  expect(
    controls.map(({ accessibleName, interactionEffect }) => ({
      accessibleName,
      interactionEffect,
    })),
  ).toEqual([
    { accessibleName: "Cancel", interactionEffect: undefined },
    { accessibleName: "Reject", interactionEffect: "mutation-required" },
    { accessibleName: "Approve", interactionEffect: "mutation-required" },
  ]);
});

test("keeps visible disabled controls and omits hidden controls", async ({
  page,
}) => {
  await page.setContent(`
    <button hidden>Hidden</button>
    <button disabled>Disabled</button>
    <button aria-disabled="true">Locked</button>
  `);

  const controls = (await inventoryDom(page)).controls;

  expect(controls).toHaveLength(2);
  expect(controls.map((control) => control.accessibleName)).toEqual([
    "Disabled",
    "Locked",
  ]);
  expect(controls.map((control) => control.disabled)).toEqual([true, true]);
  expect(controls.map((control) => control.enabled)).toEqual([false, false]);
});

test("omits controls inside a closed details disclosure", async ({ page }) => {
  await page.setContent(`
    <details>
      <summary>Advanced</summary>
      <button type="button">Hidden advanced action</button>
    </details>
    <button type="button">Visible action</button>
  `);

  const controls = (await inventoryDom(page)).controls;

  expect(controls.map(({ accessibleName }) => accessibleName)).toEqual([
    "Advanced",
    "Visible action",
  ]);
});

test("assigns distinct stable keys to duplicate semantic controls", async ({
  page,
}) => {
  await page.setContent(`
    <button data-record-stable-id="88888888-8888-4888-8888-888888888888">Repeat</button>
    <button>Repeat</button>
  `);

  const controls = (await inventoryDom(page)).controls;

  expect(controls.map((control) => control.controlKey)).toEqual([
    "button:Repeat:1",
    "button:Repeat:2",
  ]);
  expect(controls.map((control) => control.order)).toEqual([1, 2]);
  expect(controls[0]?.domOrderKey).toBe("0001:button:Repeat:1");
  expect(controls.map(({ recordStableId }) => recordStableId)).toEqual([
    "88888888-8888-4888-8888-888888888888",
    undefined,
  ]);
});

test("uses a composite name that Playwright can locate exactly", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button">
      <span style="display: flex">
        <span>Product Status</span><span>0 assigned products</span>
      </span>
      <span style="display: block">Assigned stages</span>
    </button>
  `);

  const control = (await inventoryDom(page)).controls[0];
  if (control === undefined) throw new Error("Composite control is missing");

  expect(control.accessibleName).toBe(
    "Product Status 0 assigned products Assigned stages",
  );
  await expect(
    page.getByRole("button", {
      name: control.accessibleName,
      exact: true,
    }),
  ).toHaveCount(1);
});

test("preserves DOM order while annotating keyboard focus policy", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button">Before</button>
    <div role="radiogroup" aria-label="Scope">
      <button type="button" role="radio" aria-checked="true">Summary</button>
      <button type="button" role="radio" aria-checked="false">Product</button>
    </div>
  `);

  const controls = (await inventoryDom(page)).controls;

  expect(
    controls.map(
      ({
        accessibleName,
        order,
        keyboardExpectedFocusable,
        keyboardFocusPolicy,
      }) => [
        accessibleName,
        order,
        keyboardExpectedFocusable,
        keyboardFocusPolicy,
      ],
    ),
  ).toEqual([
    ["Before", 1, true, "required"],
    ["Summary", 2, true, "required"],
    ["Product", 3, false, "forbidden"],
  ]);
});

test("reports a visible interactive control with no accessible name", async ({
  page,
}) => {
  await page.setContent(
    '<button aria-label="" style="width:100px;height:20px"></button>',
  );

  const inventory = await inventoryDom(page);

  expect(inventory.controls).toHaveLength(1);
  expect(inventory.controls[0]?.accessibleName).toBe("");
  expect(inventory.issues).toEqual([
    {
      kind: "missing-accessible-name",
      controlKey: "button:(unnamed):1",
      message: "Visible button is missing an accessible name",
    },
  ]);
});

test("inventories controls revealed by a bounded menu transition", async ({
  page,
}) => {
  await page.setContent(`
    <button onclick="document.getElementById('menu').hidden = false">Open menu</button>
    <div id="menu" role="menu" hidden style="width:160px;height:40px">
      <button>Delete</button>
    </div>
  `);

  const before = await inventoryDom(page);
  await page.getByRole("button", { name: "Open menu" }).click();
  const after = await inventoryDom(page);
  const beforeKeys = new Set(
    before.controls.map((control) => control.controlKey),
  );
  const revealed = after.controls.filter(
    (control) => !beforeKeys.has(control.controlKey),
  );

  expect(revealed.map((control) => control.role)).toEqual(["menu", "button"]);
  expect(revealed.map((control) => control.accessibleName)).toEqual([
    "",
    "Delete",
  ]);
  expect(after.issues.map((issue) => issue.controlKey)).toEqual([
    "menu:(unnamed):1",
  ]);
});

test("fails the owning observations for console and network errors", async ({
  page,
}, testInfo) => {
  await page.setContent('<main><button type="button">Continue</button></main>');

  const { bundle } = await captureHarnessEvidence(page, testInfo, {
    consoleMessages: [{ type: "error", text: "planted console failure" }],
    requestFailures: [
      {
        requestId: "planted-network-failure",
        url: "http://example.invalid/trpc/report",
        method: "POST",
        resourceType: "fetch",
        failure: "net::ERR_FAILED",
        startedAt: "2026-08-07T00:00:00.000Z",
        endedAt: "2026-08-07T00:00:00.100Z",
        durationMs: 100,
      },
    ],
  });
  const outcomes = new Map(
    bundle.observations.map(({ observationId, outcome }) => [
      observationId,
      outcome,
    ]),
  );

  expect(outcomes.get("console")).toBe("fail");
  expect(outcomes.get("network")).toBe("fail");
});

test("binds a visual change to a different screenshot digest", async ({
  page,
}, testInfo) => {
  await page.setContent(
    '<main style="background:white"><button type="button">Continue</button></main>',
  );
  const before = await captureHarnessEvidence(page, testInfo, {
    capturePhase: "before",
  });
  await page.locator("main").evaluate((element) => {
    element.style.background = "black";
  });
  const after = await captureHarnessEvidence(page, testInfo, {
    capturePhase: "after",
  });
  const screenshotDigest = (result: typeof before): string => {
    const ref = result.all.find(({ kind }) => kind === "screenshot");
    if (!ref) throw new Error("Harness screenshot evidence is missing");
    return ref.digest;
  };

  expect(screenshotDigest(after)).not.toBe(screenshotDigest(before));
});
