import { expect, test } from "@playwright/test";

import {
  axeEvidenceFor,
  finalizeAxeContext,
  prepareAxeContext,
  settleEvidenceAnimations,
} from "./axe-context.ts";

test("settles CSS transitions before sampling a control state", async ({
  page,
}) => {
  await page.setContent(`
    <style>
      #tab { color: rgb(0, 0, 0); transition: color 50ms; }
      #tab.active { color: rgb(0, 98, 65); }
    </style>
    <button id="tab" type="button">Products</button>
    <script>
      document.querySelector('#tab').addEventListener('click', (event) =>
        event.currentTarget.classList.add('active'));
    </script>
  `);

  await page.getByRole("button", { name: "Products" }).click();
  await settleEvidenceAnimations(page);

  await expect(page.locator("#tab")).toHaveCSS("color", "rgb(0, 98, 65)");
});

test("scans an active portal and then a full page after it closes", async ({
  page,
}) => {
  await page.setContent(`
    <html lang="en">
      <head><title>Portal fixture</title></head>
      <body>
        <main id="main-content" aria-hidden="true">
          <h1>Admin</h1>
          <button type="button">Continue</button>
        </main>
        <div data-radix-popper-content-wrapper>
          <div role="menu" aria-label="User actions">
            <button type="button">Delete user</button>
          </div>
        </div>
        <script>
          document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            document.querySelector('[data-radix-popper-content-wrapper]')?.remove();
            document.querySelector('#main-content')?.removeAttribute('aria-hidden');
          });
        </script>
      </body>
    </html>
  `);

  const prepared = await prepareAxeContext(page);
  const result = await finalizeAxeContext(page, prepared);
  const evidence = axeEvidenceFor(result);

  expect(result.activePortalSelectors).toEqual([
    "[data-radix-popper-content-wrapper]",
  ]);
  expect(result.fullPageAfterPortalClose).toEqual(
    expect.objectContaining({ violations: [] }),
  );
  expect(evidence.passes[0]).toEqual(
    expect.objectContaining({
      id: expect.any(String),
      nodeCount: expect.any(Number),
    }),
  );
  expect(evidence.passes[0]).not.toHaveProperty("nodes");
  expect(evidence.fullPageAfterPortalClose.passes[0]).not.toHaveProperty(
    "nodes",
  );
  await expect(page.locator("[data-radix-popper-content-wrapper]")).toHaveCount(
    0,
  );
  await expect(page.locator("#main-content")).not.toHaveAttribute(
    "aria-hidden",
  );
});

test("keeps rich toast content in the active portal scan", async ({ page }) => {
  await page.setContent(`
    <html lang="en">
      <head><title>Toast fixture</title></head>
      <body>
        <main><h1>Reports</h1></main>
        <div data-sonner-toaster>
          <div
            data-sonner-toast
            data-rich-colors="true"
            data-styled="true"
            data-type="success"
            style="background: #ecfdf3; color: #008a2e"
          >
            <div data-title>Acknowledged</div>
          </div>
        </div>
      </body>
    </html>
  `);

  const prepared = await prepareAxeContext(page);

  expect(prepared.activePortalSelectors).toContain("[data-sonner-toaster]");
  expect(prepared.active.violations).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: "color-contrast" })]),
  );
});
