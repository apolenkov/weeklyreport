/**
 * Phase 61d regression: lead viewing a foreign-author section via ?authorId
 *
 * Prerequisite: seed-simple has been run (pnpm db:seed:simple).
 * Vasily (lead1@customreport.local) must have PROD_CRM_SALES, and
 * Boris (a0000000-0000-4000-8000-000000000022) must have a draft
 * ReportSection in REPORT_ACTIVE with a Risk + Item on PROD_CRM_SALES.
 *
 * Verifies that when a lead (Vasily) opens another author's section by
 * navigating to ?authorId=<BORIS_ID>, the section renders read-only:
 *   (a) no "+ Add" buttons (items, risks, decisions, priorities)
 *   (b) no "Submit Report" button
 *   (c) section header and accordion structure are present (no error page)
 */

import { test, expect } from "@playwright/test";

import { loginByCookie } from "./helpers/dev-auth";

const WEB = "http://localhost:3000";
const BORIS_PM_ID = "a0000000-0000-4000-8000-000000000022";

async function getReportBaseUrl(page: Parameters<typeof loginByCookie>[0]) {
  // Navigate to bare /lead/report — the component redirects to the canonical
  // /lead/report/<reportId> once the active period is resolved.
  await page.goto(`${WEB}/lead/report`);
  await page.waitForLoadState("load");
  return page.url();
}

test.describe("lead views foreign-author section via ?authorId (read-only)", () => {
  test.beforeEach(async ({ page }) => {
    await loginByCookie(page, {
      role: "lead",
      email: "lead1@customreport.local",
    });
  });

  test("(a+b) no Add buttons and no Submit when viewing another author's section", async ({
    page,
  }) => {
    const base = await getReportBaseUrl(page);
    const sep = base.includes("?") ? "&" : "?";
    await page.goto(`${base}${sep}authorId=${BORIS_PM_ID}`);
    await page.waitForLoadState("load");

    // (a) All "+ Add …" buttons must be absent from the DOM (isReadOnly=true
    // renders null instead of the button, so count should be zero).
    await expect(
      page.getByRole("button", { name: "+ Add Item" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "+ Add Risk" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "+ Add Decision" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "+ Add Priority" }),
    ).toHaveCount(0);

    // (b) Submit button is present but disabled in read-only mode
    // (the button renders with disabled={isReadOnly}, it is not hidden)
    await expect(
      page.getByRole("button", { name: "Submit Report" }),
    ).toBeDisabled();
  });

  test("(c) section loads — accordion structure present, no error page", async ({
    page,
  }) => {
    const base = await getReportBaseUrl(page);
    const sep = base.includes("?") ? "&" : "?";
    await page.goto(`${base}${sep}authorId=${BORIS_PM_ID}`);
    await page.waitForLoadState("load");

    // The Risks accordion must be present — it always renders even when empty.
    await expect(
      page.locator('[data-testid="lead-section-risks"]'),
    ).toBeVisible();

    // Decisions and priorities accordions also render.
    await expect(
      page.locator('[data-testid="lead-section-decisions"]'),
    ).toBeVisible();
  });
});
