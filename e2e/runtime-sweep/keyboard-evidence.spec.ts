import { expect, test } from "@playwright/test";

import { captureKeyboardTrace } from "./keyboard-evidence";

test("captures a bounded keyboard focus transition", async ({ page }) => {
  await page.setContent('<main><button type="button">Continue</button></main>');

  await expect(captureKeyboardTrace(page)).resolves.toMatchObject({
    after: "button:Continue",
    focusMoved: true,
  });
  await expect(
    page.evaluate(() => document.activeElement?.tagName),
  ).resolves.toBe("BODY");
});

test("requires one reachable tab stop for a native radio group", async ({
  page,
}) => {
  await page.setContent(`
    <label><input type="radio" name="choice" aria-label="First">First</label>
    <label><input type="radio" name="choice" aria-label="Second" checked>Second</label>
    <button type="button">Continue</button>
  `);

  const trace = await captureKeyboardTrace(page);
  const radios = trace.controls.filter(({ role }) => role === "radio");

  expect(
    radios.map(({ accessibleName, outcome }) => [accessibleName, outcome]),
  ).toEqual([
    ["First", "not-applicable"],
    ["Second", "pass"],
  ]);
  expect(trace.focusGaps).toEqual([]);
});

test("keeps the roving radio member as the group's tab stop", async ({
  page,
}) => {
  await page.setContent(`
    <div role="radiogroup" aria-label="Scope">
      <button type="button" role="radio" aria-checked="true" tabindex="0">Summary</button>
      <button type="button" role="radio" aria-checked="false" tabindex="-1">Product</button>
    </div>
  `);

  const trace = await captureKeyboardTrace(page);
  const radios = trace.controls.filter(({ role }) => role === "radio");

  expect(
    radios.map(({ accessibleName, outcome }) => [accessibleName, outcome]),
  ).toEqual([
    ["Summary", "pass"],
    ["Product", "not-applicable"],
  ]);
});

test("keeps a standalone tabindex-minus-one button as a keyboard gap", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button" tabindex="-1">Skip</button>
    <button type="button">Continue</button>
  `);

  const trace = await captureKeyboardTrace(page);
  const skip = trace.controls.find(
    ({ accessibleName }) => accessibleName === "Skip",
  );

  expect(skip).toMatchObject({
    expectedFocusable: true,
    focusable: false,
    outcome: "fail",
  });
});

test("requires modal controls while excluding background controls from scope", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button">Background</button>
    <div role="dialog" aria-modal="true" aria-label="Confirm" style="width:240px;height:120px">
      <button type="button">Confirm</button>
      <button type="button">Cancel</button>
    </div>
  `);
  await page.getByRole("button", { name: "Confirm" }).focus();

  const trace = await captureKeyboardTrace(page);
  const evidence = new Map(
    trace.controls.map(({ accessibleName, expectedFocusable, outcome }) => [
      accessibleName,
      { expectedFocusable, outcome },
    ]),
  );

  expect(evidence.get("Background")).toEqual({
    expectedFocusable: false,
    outcome: "not-applicable",
  });
  expect(evidence.get("Confirm")).toEqual({
    expectedFocusable: true,
    outcome: "pass",
  });
  expect(evidence.get("Cancel")).toEqual({
    expectedFocusable: true,
    outcome: "pass",
  });
});
