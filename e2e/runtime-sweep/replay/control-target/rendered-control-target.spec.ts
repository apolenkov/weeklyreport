import { expect, test } from "@playwright/test";

import type { Action } from "../../source/contracts.ts";
import { executeControlAction } from "../control-actions/control-actions.ts";
import { inventoryDom } from "../dom/dom-inventory.ts";
import {
  inventoryTargetLocator,
  targetLocator,
} from "./rendered-control-target.ts";

const clickAction = (controlKey: string): Action => ({
  controlKey,
  operation: "click",
  safety: "read-only",
  transition: "none",
});

const clickFrozenButton = async (
  page: Parameters<typeof executeControlAction>[0]["page"],
  controlKey: string,
  accessibleName: string,
  timeoutMs = 250,
) =>
  executeControlAction({
    page,
    control: {
      controlKey,
      ariaRole: "button",
      accessibleName,
      enabled: true,
    },
    action: clickAction(controlKey),
    observeOutcome: (): Promise<"pass"> => Promise.resolve("pass"),
    timeoutMs,
  });

test("waits for a transient CSS-transformed control", async ({ page }) => {
  await page.setContent(`
    <button type="button" hidden>
      <span style="text-transform: uppercase">Open details</span>
    </button>
    <output></output>
    <script>
      const button = document.querySelector("button");
      button.addEventListener("click", () => {
        document.querySelector("output").textContent = "opened";
      });
      setTimeout(() => { button.hidden = false; }, 25);
    </script>
  `);

  const result = await clickFrozenButton(
    page,
    "button:OPEN%20DETAILS:1",
    "OPEN DETAILS",
  );

  expect(result).toMatchObject({ status: "pass" });
  await expect(page.locator("output")).toHaveText("opened");
});

test("does not treat an explicit switch as a button", async ({ page }) => {
  await page.setContent(`
    <button role="switch" type="button" title="OPEN DETAILS">
      <span style="text-transform: uppercase">Open details</span>
    </button>
    <button id="button" type="button" title="OPEN DETAILS">
      <span style="text-transform: uppercase">Open details</span>
    </button>
    <output></output>
    <script>
      document.querySelector('[role="switch"]').addEventListener("click", () => {
        document.querySelector("output").textContent = "wrong";
      });
      document.querySelector("#button").addEventListener("click", () => {
        document.querySelector("output").textContent = "button";
      });
    </script>
  `);

  const result = await clickFrozenButton(
    page,
    "button:OPEN%20DETAILS:1",
    "OPEN DETAILS",
  );

  expect(result).toMatchObject({ status: "pass" });
  await expect(page.locator("output")).toHaveText("button");
});

test("does not recover an invalid explicit role as an implicit button", async ({
  page,
}) => {
  await page.setContent(`
    <button role="foo" type="button"><span style="text-transform: uppercase">Open</span></button>
    <button id="button" type="button"><span style="text-transform: uppercase">Open</span></button>
    <output></output>
    <script>
      document.querySelector('[role="foo"]').addEventListener("click", () => {
        document.querySelector("output").textContent = "wrong";
      });
      document.querySelector("#button").addEventListener("click", () => {
        document.querySelector("output").textContent = "button";
      });
    </script>
  `);

  const result = await clickFrozenButton(page, "button:OPEN:1", "OPEN");

  expect(result).toMatchObject({ status: "pass" });
  await expect(page.locator("output")).toHaveText("button");
});

test("supports a summary with its implicit button role", async ({ page }) => {
  await page.setContent(`
    <details>
      <summary><span style="text-transform: uppercase">More info</span></summary>
      <p>Details</p>
    </details>
  `);

  const result = await clickFrozenButton(
    page,
    "button:MORE%20INFO:1",
    "MORE INFO",
  );

  expect(result).toMatchObject({ status: "pass" });
  await expect(page.locator("details")).toHaveAttribute("open", "");
});

test("resolves a native summary with the inventory button semantics", async ({
  page,
}) => {
  await page.setContent(`
    <details>
      <summary>Advanced</summary>
      <p>Details</p>
    </details>
  `);

  await expect(
    inventoryTargetLocator(page, {
      accessibleName: "Advanced",
      ariaRole: "button",
      controlKey: "button:Advanced:1",
      enabled: true,
    }),
  ).toBeVisible();
});

test("selects the requested rendered-name occurrence", async ({ page }) => {
  await page.setContent(`
    <button type="button"><span style="text-transform: uppercase">Open</span></button>
    <button type="button"><span style="text-transform: uppercase">Open</span></button>
    <output></output>
    <script>
      [...document.querySelectorAll("button")].forEach((button, index) => {
        button.addEventListener("click", () => {
          document.querySelector("output").textContent = String(index + 1);
        });
      });
    </script>
  `);

  const result = await clickFrozenButton(page, "button:OPEN:2", "OPEN");

  expect(result).toMatchObject({ status: "pass" });
  await expect(page.locator("output")).toHaveText("2");
});

test("preserves inventory name sources before rendered text", async ({
  page,
}) => {
  await page.setContent(`
    <button aria-label="Other" type="button"><span style="text-transform: uppercase">Open</span></button>
    <button type="button"><span style="text-transform: uppercase">Open</span></button>
    <output></output>
    <script>
      [...document.querySelectorAll("button")].forEach((button, index) => {
        button.addEventListener("click", () => {
          document.querySelector("output").textContent = String(index + 1);
        });
      });
    </script>
  `);

  const result = await clickFrozenButton(page, "button:OPEN:1", "OPEN");

  expect(result).toMatchObject({ status: "pass" });
  await expect(page.locator("output")).toHaveText("2");
});

test("executes a composite card whose source name needs boundary spaces", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button"><span>Внутренний BI</span><span>Ветров И.О. / Липов В.</span><span><svg aria-hidden="true"></svg>100% ready</span></button>
    <output></output>
    <script>
      document.querySelector("button").addEventListener("click", () => {
        document.querySelector("output").textContent = "clicked";
      });
    </script>
  `);

  const control = (await inventoryDom(page)).controls.find(
    ({ role }) => role === "button",
  );
  if (control === undefined) throw new Error("Composite card is missing");
  expect(control.controlKey).toBe(
    "button:%D0%92%D0%BD%D1%83%D1%82%D1%80%D0%B5%D0%BD%D0%BD%D0%B8%D0%B9%20BI%20%D0%92%D0%BE%D0%BB%D0%BA%D0%BE%D0%B2%20%D0%98.%D0%9E.%20%2F%20%D0%9B%D0%B5%D0%B1%D0%B5%D0%B4%D0%B5%D0%B2%20%D0%92.100%25%20ready:1",
  );
  const actionControl = {
    ...control,
    ariaRole: control.role,
  } as const;
  await expect(targetLocator(page, actionControl)).toHaveCount(0);
  const result = await executeControlAction({
    page,
    control: actionControl,
    action: clickAction(control.controlKey),
    observeOutcome: (): Promise<"pass"> => Promise.resolve("pass"),
    timeoutMs: 250,
  });

  expect(result).toMatchObject({ status: "pass" });
  await expect(page.locator("output")).toHaveText("clicked");
});

test("matches a CSS-transformed aria-labelledby inventory name", async ({
  page,
}) => {
  await page.setContent(`
    <span id="label" style="text-transform: uppercase">Open details</span>
    <button type="button" aria-labelledby="label"></button>
    <output></output>
    <script>
      document.querySelector("button").addEventListener("click", () => {
        document.querySelector("output").textContent = "opened";
      });
    </script>
  `);

  const result = await clickFrozenButton(
    page,
    "button:OPEN%20DETAILS:1",
    "OPEN DETAILS",
  );

  expect(result).toMatchObject({ status: "pass" });
  await expect(page.locator("output")).toHaveText("opened");
});

test("bounds a slow rendered-name browser probe", async ({ page }) => {
  await page.setContent(`
    <button type="button"><span style="text-transform: uppercase">Open</span></button>
    <script>
      const descriptor = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        "innerText",
      );
      Object.defineProperty(HTMLElement.prototype, "innerText", {
        configurable: true,
        get() {
          const deadline = performance.now() + 300;
          while (performance.now() < deadline) {}
          document.body.dataset.probeComplete = "true";
          return descriptor.get.call(this);
        },
      });
    </script>
  `);
  const startedAt = Date.now();

  const result = await clickFrozenButton(page, "button:OPEN:1", "OPEN", 50);

  expect(result).toMatchObject({
    status: "not-exercised",
    policy: "unavailable",
  });
  expect(Date.now() - startedAt).toBeLessThan(200);
  await expect(page.locator("body")).toHaveAttribute(
    "data-probe-complete",
    "true",
  );
  const validatorCount = await page.locator("button").evaluateAll(
    (buttons) =>
      buttons.filter((button) => {
        const guarded = button as HTMLElement & Record<string, unknown>;
        return "__runtimeSweepActionValidator" in guarded;
      }).length,
  );
  expect(validatorCount).toBe(0);
});
