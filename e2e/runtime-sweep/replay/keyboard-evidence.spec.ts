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

test("starts the tab trace at the document start after a mid-page focus", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button">First</button>
    <button type="button">Middle</button>
    <button type="button">Last</button>
  `);
  await page.getByRole("button", { name: "Middle" }).focus();

  await expect(captureKeyboardTrace(page)).resolves.toMatchObject({
    after: "button:First",
    focusMoved: true,
  });
});

test("captures an expanded disclosure before document-start traversal replaces it", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button">Before</button>
    <div>
      <button type="button" aria-expanded="true">Quick add</button>
      <div role="group" aria-label="Record type">
        <button type="button">Current item</button>
        <button type="button">Next item</button>
        <button type="button">Risk</button>
      </div>
    </div>
    <button type="button">After</button>
  `);
  await page.getByRole("button", { name: "Quick add" }).focus();
  await page.evaluate(() => {
    const removeDisclosureAtDocumentStart = (event: FocusEvent) => {
      const target = event.target;
      if (
        !(target instanceof HTMLElement) ||
        target.id !== "runtime-sweep-keyboard-start"
      )
        return;
      document
        .querySelector('[role="group"][aria-label="Record type"]')
        ?.remove();
      document.removeEventListener("focusin", removeDisclosureAtDocumentStart);
    };
    document.addEventListener("focusin", removeDisclosureAtDocumentStart);
  });

  const trace = await captureKeyboardTrace(page);

  expect(
    trace.controls
      .filter(({ accessibleName }) =>
        ["Current item", "Next item", "Risk"].includes(accessibleName),
      )
      .map(({ outcome }) => outcome),
  ).toEqual(["pass", "pass", "pass"]);
  expect(trace.focusGaps).toEqual([]);
});

test("matches focused controls by their rendered accessible text", async ({
  page,
}) => {
  await page.setContent(`
    <a href="#users" style="text-transform: capitalize">users</a>
    <button type="button">
      Summary
      <span style="display: none">Hidden details</span>
    </button>
  `);

  const trace = await captureKeyboardTrace(page);

  expect(
    trace.controls.map(({ accessibleName, focusable, outcome }) => ({
      accessibleName,
      focusable,
      outcome,
    })),
  ).toEqual([
    { accessibleName: "Users", focusable: true, outcome: "pass" },
    { accessibleName: "Summary", focusable: true, outcome: "pass" },
  ]);
  expect(trace.focusGaps).toEqual([]);
});

test("fails closed when the keyboard start marker already belongs to the page", async ({
  page,
}) => {
  await page.setContent(`
    <span id="runtime-sweep-keyboard-start"></span>
    <button type="button">Continue</button>
  `);

  await expect(captureKeyboardTrace(page)).rejects.toThrow(
    "Keyboard trace marker runtime-sweep-keyboard-start already exists",
  );
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

test("requires only the active roving tab as a tab stop", async ({ page }) => {
  await page.setContent(`
    <div role="tablist" aria-label="Sections">
      <button type="button" role="tab" aria-selected="true" tabindex="0">Overview</button>
      <button type="button" role="tab" aria-selected="false" tabindex="-1">Settings</button>
    </div>
  `);

  const trace = await captureKeyboardTrace(page);
  const tabs = trace.controls.filter(({ role }) => role === "tab");

  expect(
    tabs.map(({ accessibleName, expectedFocusable, outcome }) => [
      accessibleName,
      expectedFocusable,
      outcome,
    ]),
  ).toEqual([
    ["Overview", true, "pass"],
    ["Settings", false, "not-applicable"],
  ]);
  expect(trace.focusGaps).toEqual([]);
});

test("does not require a non-tabbable listbox panel", async ({ page }) => {
  await page.setContent(`
    <main>
      <button type="button">Before</button>
      <select multiple aria-label="Native periods">
        <option>Current</option>
        <option>Previous</option>
      </select>
    </main>
    <div
      role="listbox"
      aria-label="Reporting period"
      tabindex="-1"
      style="width:240px;height:40px"
    >
      <div role="option" aria-selected="true" tabindex="-1">Current</div>
    </div>
  `);

  const trace = await captureKeyboardTrace(page);
  const panel = trace.controls.find(
    ({ role, accessibleName }) =>
      role === "listbox" && accessibleName === "Reporting period",
  );
  const native = trace.controls.find(
    ({ role, accessibleName }) =>
      role === "listbox" && accessibleName === "Native periods",
  );

  expect(panel).toMatchObject({
    expectedFocusable: false,
    focusable: false,
    focusPolicy: "unreachable",
    outcome: "not-applicable",
  });
  expect(native).toMatchObject({
    expectedFocusable: true,
    focusable: true,
    focusPolicy: "required",
    outcome: "pass",
  });
  expect(trace.focusGaps).toEqual([]);
});

test("fails when an extra ARIA radio member is tabbable", async ({ page }) => {
  await page.setContent(`
    <div role="radiogroup" aria-label="Scope">
      <button type="button" role="radio" aria-checked="true">Summary</button>
      <button type="button" role="radio" aria-checked="false">Product</button>
    </div>
  `);

  const trace = await captureKeyboardTrace(page);
  const product = trace.controls.find(
    ({ accessibleName }) => accessibleName === "Product",
  );

  expect(product).toMatchObject({
    expectedFocusable: false,
    focusable: true,
    focusPolicy: "forbidden",
    outcome: "fail",
  });
  expect(trace.focusGaps).toContainEqual(product);
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

test("fails when focus escapes an active modal", async ({ page }) => {
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
    outcome: "fail",
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

test("keeps unreachable modal background controls not-applicable", async ({
  page,
}) => {
  await page.setContent(`
    <main inert>
      <button type="button">Background</button>
    </main>
    <div role="dialog" aria-modal="true" aria-label="Confirm" style="width:240px;height:120px">
      <button type="button">Confirm</button>
      <button type="button">Cancel</button>
    </div>
  `);
  await page.getByRole("button", { name: "Confirm" }).focus();

  const trace = await captureKeyboardTrace(page);
  const background = trace.controls.find(
    ({ accessibleName }) => accessibleName === "Background",
  );

  expect(background).toMatchObject({
    expectedFocusable: false,
    focusable: false,
    focusPolicy: "unreachable",
    outcome: "not-applicable",
  });
  expect(
    trace.controls
      .filter(
        ({ accessibleName, role }) =>
          role === "button" && ["Confirm", "Cancel"].includes(accessibleName),
      )
      .map(({ outcome }) => outcome),
  ).toEqual(["pass", "pass"]);
  expect(trace.focusGaps).toEqual([]);
});
