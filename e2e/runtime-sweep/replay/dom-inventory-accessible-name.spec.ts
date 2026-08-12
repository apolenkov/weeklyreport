import { expect, test } from "@playwright/test";

import { inventoryDom } from "./dom-inventory.ts";

test("uses source text for CSS-transformed accessible names", async ({
  page,
}) => {
  await page.setContent(`
    <label for="comment" style="text-transform: uppercase">
      Comment (optional, up to 500 characters)
    </label>
    <textarea id="comment"></textarea>
    <span id="status-label" style="text-transform: uppercase">Status details</span>
    <button type="button" aria-labelledby="status-label"></button>
    <button type="button"><span style="text-transform: uppercase">Open details</span></button>
  `);

  const controls = (await inventoryDom(page)).controls;
  expect(
    controls.map(({ role, accessibleName }) => ({ role, accessibleName })),
  ).toEqual([
    {
      role: "textbox",
      accessibleName: "Comment (optional, up to 500 characters)",
    },
    { role: "button", accessibleName: "Status details" },
    { role: "button", accessibleName: "Open details" },
  ]);
  await expect(
    page.getByRole("textbox", {
      name: "Comment (optional, up to 500 characters)",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", {
      name: "Status details",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", {
      name: "Open details",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", {
      name: "OPEN DETAILS",
      exact: true,
    }),
  ).toHaveCount(0);
});

test("matches exact accessible names for hidden descendants and references", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button">
      Summary
      <span style="display: none">Hidden details</span>
      <span style="visibility: hidden">Hidden visibility</span>
      <span hidden>Hidden attribute</span>
      <span aria-hidden="true">Visible ignored</span>
    </button>
    <button type="button">Visible<span aria-hidden="true">Visible ignored</span></button>
    <span id="hidden-reference" hidden>Hidden reference</span>
    <button type="button" aria-labelledby="hidden-reference"></button>
    <label id="hidden-label" hidden for="hidden-input">Hidden label</label>
    <input id="hidden-input" />
  `);

  const controls = (await inventoryDom(page)).controls;
  expect(
    controls.map(({ role, accessibleName }) => ({ role, accessibleName })),
  ).toEqual([
    { role: "button", accessibleName: "Summary" },
    { role: "button", accessibleName: "Visible" },
    { role: "button", accessibleName: "Hidden reference" },
    { role: "textbox", accessibleName: "Hidden label" },
  ]);
  for (const [role, name] of [
    ["button", "Summary"],
    ["button", "Visible"],
    ["button", "Hidden reference"],
    ["textbox", "Hidden label"],
  ] as const)
    await expect(page.getByRole(role, { name, exact: true })).toHaveCount(1);
  await expect(
    page.getByRole("button", {
      name: "Summary Hidden details",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Visible Visible ignored",
      exact: true,
    }),
  ).toHaveCount(0);
});
