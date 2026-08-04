import { expect, type Page, test } from "@playwright/test";

import type { Action } from "./contracts.ts";
import { executeControlAction } from "./control-actions.ts";
import type { ControlActionRecovery } from "./control-recovery.ts";
import { inventoryDom } from "./dom-inventory.ts";
import {
  executeLiveControlPlans,
  planLiveControlActions,
} from "./live-control-lane.ts";

const statefulActions = [
  ["publish", "Publish & Lock", "Publish & Lock", "irreversible"],
  ["delete", "Delete period", "Delete", "irreversible"],
  ["revoke", "Revoke submission", "Revoke", "irreversible"],
  ["restore", "Restore report", "Restore", "reversible"],
] as const;

const recoveryFixture = (events: string[]): ControlActionRecovery => ({
  databaseUrl: "postgres://localhost/customreport_e2e",
  resetAndReseed: (): Promise<void> => {
    events.push("reset");
    return Promise.resolve();
  },
  assertBaseline: (): Promise<void> => {
    events.push("oracle");
    return Promise.resolve();
  },
});

const actionFor = (
  operation: Action["operation"],
  safety: Action["safety"],
): Action => ({
  controlKey: `button:${operation}:1`,
  operation,
  safety,
  transition:
    operation === "publish" ||
    operation === "delete" ||
    operation === "revoke" ||
    operation === "restore"
      ? operation
      : "none",
});

type StatefulCase = (typeof statefulActions)[number];

const runStatefulAction = async (
  page: Page,
  [operation, trigger, confirm, safety]: StatefulCase,
): Promise<void> => {
  const events: string[] = [];
  await page.setContent(`
    <button type="button" id="trigger">${trigger}</button>
    <div role="alertdialog" aria-label="Confirm" hidden>
      <button type="button" id="confirm">${confirm}</button>
    </div>
    <output id="result"></output>
    <script>
      (() => {
        const trigger = document.getElementById("trigger");
        const dialog = document.querySelector("[role=alertdialog]");
        const confirmButton = document.getElementById("confirm");
        trigger.addEventListener("click", () => { dialog.hidden = false; });
        confirmButton.addEventListener("click", () => {
          dialog.hidden = true;
          document.getElementById("result").textContent = "done";
        });
      })();
    </script>
  `);
  const result = await executeControlAction({
    page,
    control: {
      controlKey: `button:${operation}:1`,
      ariaRole: "button",
      accessibleName: trigger,
      enabled: true,
    },
    action: actionFor(operation, safety),
    recovery: recoveryFixture(events),
    observeOutcome: async (): Promise<"pass"> => {
      await expect(page.locator("#result")).toHaveText("done");
      return "pass";
    },
  });

  expect(result).toMatchObject({
    status: "pass",
    operation,
    resetPerformed: true,
  });
  expect(events).toEqual(["reset", "oracle"]);
};

test("executes publish, delete, revoke, and restore one at a time", async ({
  page,
}) => {
  for (const statefulCase of statefulActions)
    await runStatefulAction(page, statefulCase);
});

test("resets after a confirmation becomes ambiguous", async ({ page }) => {
  const events: string[] = [];
  await page.setContent(`
      <button type="button">Delete period</button>
      <div role="alertdialog" aria-label="Confirm">
        <p>Confirmation is unavailable.</p>
      </div>
    `);

  const result = await executeControlAction({
    page,
    control: {
      controlKey: "button:delete:1",
      ariaRole: "button",
      accessibleName: "Delete period",
      enabled: true,
    },
    action: actionFor("delete", "irreversible"),
    recovery: recoveryFixture(events),
  });

  expect(result).toMatchObject({
    status: "ambiguous",
    operation: "delete",
    resetPerformed: true,
  });
  expect(events).toEqual(["reset", "oracle"]);
});

test("does not reset a bounded read-only click", async ({ page }) => {
  const events: string[] = [];
  await page.setContent('<button type="button">Open details</button>');

  const result = await executeControlAction({
    page,
    control: {
      controlKey: "button:Open%20details:1",
      ariaRole: "button",
      accessibleName: "Open details",
      enabled: true,
    },
    action: actionFor("click", "read-only"),
    recovery: recoveryFixture(events),
  });

  expect(result).toEqual({
    status: "pass",
    controlKey: "button:Open%20details:1",
    operation: "click",
    resetPerformed: false,
  });
  expect(events).toEqual([]);
});

test("refuses stateful actions without a disposable recovery", async ({
  page,
}) => {
  await page.setContent('<button type="button">Publish & Lock</button>');

  const result = await executeControlAction({
    page,
    control: {
      controlKey: "button:publish:1",
      ariaRole: "button",
      accessibleName: "Publish & Lock",
      enabled: true,
    },
    action: actionFor("publish", "irreversible"),
  });

  expect(result).toMatchObject({
    status: "not-exercised",
    policy: "unsafe",
    resetPerformed: false,
  });
});

test("refuses an irreversible click without a disposable recovery", async ({
  page,
}) => {
  await page.setContent('<button type="button">Save</button>');

  const result = await executeControlAction({
    page,
    control: {
      controlKey: "button:Save:1",
      ariaRole: "button",
      accessibleName: "Save",
      enabled: true,
    },
    action: {
      controlKey: "button:Save:1",
      operation: "click",
      safety: "irreversible",
      transition: "none",
    },
  });

  expect(result).toMatchObject({
    status: "not-exercised",
    policy: "unsafe",
    resetPerformed: false,
  });
});

test("executes retry only with reversible recovery", async ({ page }) => {
  const events: string[] = [];
  await page.setContent(
    '<button type="button">Try again</button><output>ready</output>',
  );

  const result = await executeControlAction({
    page,
    control: {
      controlKey: "button:Try%20again:1",
      ariaRole: "button",
      accessibleName: "Try again",
      enabled: true,
    },
    action: {
      controlKey: "button:Try%20again:1",
      operation: "retry",
      safety: "reversible",
      transition: "retry",
    },
    recovery: recoveryFixture(events),
    observeOutcome: (): Promise<"pass"> => Promise.resolve("pass"),
  });

  expect(result).toMatchObject({
    status: "pass",
    operation: "retry",
    resetPerformed: true,
  });
  expect(events).toEqual(["reset", "oracle"]);
});

test("does not click a control that became hidden after inventory", async ({
  page,
}) => {
  await page.setContent('<button type="button" hidden>Open details</button>');

  const result = await executeControlAction({
    page,
    control: {
      controlKey: "button:Open%20details:1",
      ariaRole: "button",
      accessibleName: "Open details",
      enabled: true,
    },
    action: actionFor("click", "read-only"),
  });

  expect(result).toMatchObject({
    status: "not-exercised",
    policy: "unavailable",
    reason: "Control is not present in the live DOM",
  });
});

test("re-inventories and exercises a newly revealed menu control", async ({
  page,
}) => {
  await page.setContent(`
      <button type="button" id="open">Open menu</button>
      <div id="menu" role="menu" hidden>
        <button type="button" id="details">View details</button>
      </div>
      <output id="result"></output>
      <script>
        document.getElementById("open").addEventListener("click", () => {
          document.getElementById("menu").hidden = false;
        });
        document.getElementById("details").addEventListener("click", () => {
          document.getElementById("result").textContent = "opened";
        });
      </script>
    `);
  const initial = await inventoryDom(page);
  const records = await executeLiveControlPlans({
    page,
    plans: planLiveControlActions(initial.controls),
    preparePage: () => Promise.resolve(),
    reinventory: async () => (await inventoryDom(page)).controls,
  });

  expect(records.map(({ controlKey }) => controlKey)).toEqual([
    "button:Open%20menu:1",
    "menu:(unnamed):1",
    "button:View%20details:1",
  ]);
  expect(records.map(({ status }) => status)).toEqual([
    "pass",
    "not-exercised",
    "pass",
  ]);
});
