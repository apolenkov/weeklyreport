import { expect, test } from "@playwright/test";

import type { Action } from "../source/contracts.ts";
import { executeControlAction } from "./control-actions.ts";
import { inventoryDom } from "./dom-inventory.ts";

const clickAction = (controlKey: string): Action => ({
  controlKey,
  operation: "click",
  safety: "read-only",
  transition: "none",
});

test("locates a title-labelled control when its visible name differs", async ({
  page,
}) => {
  await page.setContent(
    '<span title="Past weeks and closed reports">Tooltip</span><a href="/reports" title="Past weeks and closed reports">History</a>',
  );

  const result = await executeControlAction({
    page,
    control: {
      controlKey: "link:Past%20weeks%20and%20closed%20reports:1",
      ariaRole: "link",
      accessibleName: "Past weeks and closed reports",
      enabled: true,
      href: "/reports",
    },
    action: clickAction("link:Past%20weeks%20and%20closed%20reports:1"),
    observeOutcome: (): Promise<"pass"> => Promise.resolve("pass"),
  });

  expect(result).toMatchObject({ status: "pass" });
});

test("uses the frozen href when a link accessible name changes", async ({
  page,
}) => {
  await page.setContent('<a href="#settings">Current label</a>');

  const result = await executeControlAction({
    page,
    control: {
      controlKey: "link:Settings:1",
      ariaRole: "link",
      accessibleName: "Settings",
      enabled: true,
      href: "#settings",
    },
    action: clickAction("link:Settings:1"),
    observeOutcome: async (): Promise<"pass"> => {
      await expect(page).toHaveURL(/#settings$/u);
      return "pass";
    },
  });

  expect(result).toMatchObject({ status: "pass" });
});

test("uses rendered inner text when CSS transforms the role name", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button">
      <div>MP</div>
      <div>Marketing portal</div>
      <div style="text-transform: uppercase">No status</div>
      <div>unassigned</div>
    </button>
    <output></output>
    <script>
      document.querySelector("button").addEventListener("click", () => {
        document.querySelector("output").textContent = "opened";
      });
    </script>
  `);
  const control = (await inventoryDom(page)).controls[0];
  if (control === undefined) throw new Error("Composite control is missing");
  expect(control.accessibleName).toBe(
    "MP Marketing portal NO STATUS unassigned",
  );
  await expect(
    page.getByRole("button", {
      name: control.accessibleName,
      exact: true,
    }),
  ).toHaveCount(0);

  const result = await executeControlAction({
    page,
    control: { ...control, ariaRole: "button" },
    action: clickAction(control.controlKey),
    observeOutcome: async (): Promise<"pass"> => {
      await expect(page.locator("output")).toHaveText("opened");
      return "pass";
    },
  });

  expect(result).toMatchObject({ status: "pass" });
});

test("waits for a transient control before exercising it", async ({ page }) => {
  await page.setContent(`
    <button type="button" hidden>Open details</button>
    <script>
      setTimeout(() => { document.querySelector("button").hidden = false; }, 25);
    </script>
  `);

  const result = await executeControlAction({
    page,
    control: {
      controlKey: "button:Open%20details:1",
      ariaRole: "button",
      accessibleName: "Open details",
      enabled: true,
    },
    action: clickAction("button:Open%20details:1"),
    observeOutcome: (): Promise<"pass"> => Promise.resolve("pass"),
    timeoutMs: 250,
  });

  expect(result).toMatchObject({ status: "pass" });
});

test("preserves observer errors instead of swallowing them", async ({
  page,
}) => {
  await page.setContent('<button type="button">Observe</button>');

  const result = await executeControlAction({
    page,
    control: {
      controlKey: "button:Observe:1",
      ariaRole: "button",
      accessibleName: "Observe",
      enabled: true,
    },
    action: clickAction("button:Observe:1"),
    observeOutcome: (): Promise<"pass"> =>
      Promise.reject(new Error("observer exploded")),
  });

  expect(result).toMatchObject({
    status: "fail",
    reason: "observer exploded",
  });
});
