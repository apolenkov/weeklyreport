import { expect, test } from "@playwright/test";

import { inventoryDom } from "./dom-inventory";
import { captureKeyboardTrace } from "./keyboard-evidence";

test("inventories visible semantic controls and their metadata", async ({
  page,
}) => {
  await page.setContent(`
    <main>
      <a href="/reports">Reports</a>
      <button type="button">Save</button>
      <label for="title">Title</label><input id="title" type="text">
      <label><input type="checkbox">Agree</label>
      <select aria-label="Status"><option>Open</option></select>
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
  expect(inventory.controls.every((control) => control.visible)).toBe(true);
  expect(inventory.issues).toHaveLength(0);
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

test("assigns distinct stable keys to duplicate semantic controls", async ({
  page,
}) => {
  await page.setContent(`
    <button>Repeat</button>
    <button>Repeat</button>
  `);

  const controls = (await inventoryDom(page)).controls;

  expect(controls.map((control) => control.controlKey)).toEqual([
    "button:Repeat:1",
    "button:Repeat:2",
  ]);
  expect(controls.map((control) => control.order)).toEqual([1, 2]);
  expect(controls[0]?.domOrderKey).toBe("0001:button:Repeat:1");
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

test("captures a bounded keyboard focus transition", async ({ page }) => {
  await page.setContent('<main><button type="button">Continue</button></main>');

  await expect(captureKeyboardTrace(page)).resolves.toMatchObject({
    after: "button:Continue",
    focusMoved: true,
  });
});
