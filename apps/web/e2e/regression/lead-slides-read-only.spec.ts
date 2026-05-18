/**
 * Phase 61b regression: lead slides read-only mode
 *
 * Verifies that ?mode=slides renders a clean read-only view:
 *   (a) no period/version toolbar
 *   (b) no Submit / Request Reopen / Toggle All buttons
 *   (c) no carousel prev/next/counter (single-lead view)
 *   (d) product content is visible (lead-slides-deck rendered)
 *   (e) ↩ Edit link (data-testid="slides-edit-link") is present and
 *       points back to edit mode (href without mode=slides)
 */

import { test, expect } from "@playwright/test";
import { loginByCookie } from "./helpers/dev-auth";

const WEB = "http://localhost:3000";

async function getSlidesUrl(page: Parameters<typeof loginByCookie>[0]) {
  await page.goto(WEB + "/lead/report");
  await page.waitForLoadState("load");
  const reportUrl = page.url();
  return reportUrl.includes("?")
    ? reportUrl + "&mode=slides"
    : reportUrl + "?mode=slides";
}

test.describe("lead slides read-only mode", () => {
  test.beforeEach(async ({ page }) => {
    await loginByCookie(page, { role: "lead" });
  });

  test("(a+b+c) no chrome in slides mode — no toolbar, no submit, no carousel", async ({
    page,
  }) => {
    const slidesUrl = await getSlidesUrl(page);
    await page.goto(slidesUrl);
    await page.waitForLoadState("load");

    // (a) No period navigator / version history toolbar
    await expect(
      page.getByRole("button", { name: /previous week|next week/i }),
    ).not.toBeVisible();
    await expect(page.getByText("Fill from previous")).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: /version/i }),
    ).not.toBeVisible();

    // (b) No submit/reopen/toggle chrome
    await expect(
      page.getByRole("button", { name: "Submit Report" }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: /request reopen/i }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Toggle All" }),
    ).not.toBeVisible();

    // (c) No carousel (single lead = single slide)
    await expect(
      page.getByRole("button", { name: "Previous slide" }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Next slide" }),
    ).not.toBeVisible();
  });

  test("(d+e) product content visible and ↩ Edit link present in slides mode", async ({
    page,
  }) => {
    const slidesUrl = await getSlidesUrl(page);
    await page.goto(slidesUrl);
    await page.waitForLoadState("load");

    // (d) Lead slide deck is rendered
    await expect(
      page.locator('[data-testid="lead-slides-deck"]'),
    ).toBeVisible();

    // (e) ↩ Edit link in the header sub-row (unambiguous selector)
    const editLink = page.locator('[data-testid="slides-edit-link"]');
    await expect(editLink).toBeVisible();
    const href = await editLink.getAttribute("href");
    expect(href).toMatch(/\/lead\/report/);
    expect(href).not.toMatch(/mode=slides/);
  });
});
