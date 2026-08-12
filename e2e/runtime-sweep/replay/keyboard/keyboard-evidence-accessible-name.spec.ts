import { expect, test } from "@playwright/test";

import { captureKeyboardTrace } from "./keyboard-evidence.ts";

test("matches focused controls by their source accessible text", async ({
  page,
}) => {
  await page.setContent(`
    <a href="#users" style="text-transform: capitalize">users</a>
    <button type="button">
      Summary
      <span style="display: none">Hidden details</span>
      <span style="visibility: hidden">Hidden visibility</span>
      <span hidden>Hidden attribute</span>
      <span aria-hidden="true">Visible ignored</span>
    </button>
  `);

  await expect(
    page.getByRole("link", { name: "users", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("link", { name: "Users", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Summary", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", {
      name: "Summary Hidden details",
      exact: true,
    }),
  ).toHaveCount(0);

  const trace = await captureKeyboardTrace(page);
  expect(
    trace.controls.map(({ accessibleName, focusable, outcome }) => ({
      accessibleName,
      focusable,
      outcome,
    })),
  ).toEqual([
    { accessibleName: "users", focusable: true, outcome: "pass" },
    { accessibleName: "Summary", focusable: true, outcome: "pass" },
  ]);
  expect(trace.focusGaps).toEqual([]);
});
