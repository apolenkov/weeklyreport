/**
 * Phase 61b regression: lead slides read-only mode
 *
 * Verifies that ?mode=slides renders a clean read-only view:
 *   (a) no period/version toolbar
 *   (b) no Submit / Request Reopen / Toggle All buttons
 *   (c) no carousel prev/next/counter (single-lead view)
 *   (d) product content is visible (SDLC inline text, product name)
 *   (e) ↩ Edit link is present in the header sub-row
 */

import { test, expect } from "@playwright/test";
import { loginByCookie } from "./helpers/dev-auth";

const WEB = "http://localhost:3000";

test.describe("lead slides read-only mode", () => {
  test.beforeEach(async ({ page }) => {
    await loginByCookie(page, { role: "lead" });
  });

  test("(a+b+c) no chrome in slides mode — no toolbar, no submit, no carousel", async ({
    page,
  }) => {
    await page.goto(WEB + "/lead/report");
    await page.waitForLoadState("load");

    // Get the current URL after redirect (contains reportId)
    const reportUrl = page.url();
    const slidesUrl = reportUrl.includes("?")
      ? reportUrl + "&mode=slides"
      : reportUrl + "?mode=slides";

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
    await page.goto(WEB + "/lead/report");
    await page.waitForLoadState("load");

    const reportUrl = page.url();
    const slidesUrl = reportUrl.includes("?")
      ? reportUrl + "&mode=slides"
      : reportUrl + "?mode=slides";

    await page.goto(slidesUrl);
    await page.waitForLoadState("load");

    // (d) Lead slide deck is rendered
    const deck = page.locator('[data-testid="lead-slides-deck"]');
    await expect(deck).toBeVisible();

    // (e) ↩ Edit link is in the page header sub-row
    const editLink = page.getByRole("link", { name: /edit/i });
    await expect(editLink).toBeVisible();
    const href = await editLink.getAttribute("href");
    expect(href).toMatch(/\/lead\/report\//);
    expect(href).not.toMatch(/mode=slides/);
  });
});
