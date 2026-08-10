import { expect, test } from "@playwright/test";

import type { Action } from "../../source/contracts.ts";
import { executeControlAction } from "../control-actions.ts";

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
