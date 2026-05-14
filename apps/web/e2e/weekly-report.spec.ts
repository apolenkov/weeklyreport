/**
 * Weekly Report E2E Tests
 *
 * Validates the head weekly report at /head/report -- period navigation,
 * portfolio overview, product accordions, publish & lock, and export PDF.
 * All data is currently mock; tests verify UI rendering and interactions.
 *
 * Covers: SC-26..SC-30 (Weekly Report)
 */

import { test, expect } from "./fixtures";

test.describe("Weekly Report", () => {
  test.beforeEach(async ({ headPage }) => {
    await headPage.goto("/head/report");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    // Wait for client-side hydration: the Weekly Report heading is rendered
    // by the WeeklyReportPage client component
    await headPage
      .getByRole("heading", { name: "Weekly Report" })
      .waitFor({ state: "visible", timeout: 15_000 });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });
  });

  // -----------------------------------------------------------------------
  // Page header
  // -----------------------------------------------------------------------

  test('shows "Weekly Report" heading', async ({ headPage }) => {
    await expect(
      headPage.getByRole("heading", { name: "Weekly Report" }),
    ).toBeVisible();
  });

  test('"Live" badge shows submission count', async ({ headPage }) => {
    // Badge renders "Live . 4/6 Submitted" (middot separates)
    // Use specific text to avoid strict mode violation with "Live portfolio review"
    await expect(headPage.getByText("4/6 Submitted")).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Period Navigator
  // -----------------------------------------------------------------------

  test("period navigator shows current week selection", async ({
    headPage,
  }) => {
    const periodSelect = headPage.getByLabel("Select reporting period");
    await expect(periodSelect).toBeVisible();
    // Default selection should be the current period (Week 16)
    await expect(periodSelect).toHaveValue("2026-W16");
  });

  test("period navigator arrows are present", async ({ headPage }) => {
    const prevButton = headPage.getByLabel("Previous week");
    const nextButton = headPage.getByLabel("Next week");
    await expect(prevButton).toBeVisible();
    await expect(nextButton).toBeVisible();
    // Previous should be enabled (there are past periods)
    await expect(prevButton).toBeEnabled();
    // Next should be disabled (we are on the latest period)
    await expect(nextButton).toBeDisabled();
  });

  // -----------------------------------------------------------------------
  // Portfolio Overview
  // -----------------------------------------------------------------------

  test("Portfolio Overview section shows product cards with status", async ({
    headPage,
  }) => {
    await expect(headPage.getByText("Portfolio Overview")).toBeVisible();
    await expect(headPage.getByText("12 products")).toBeVisible();
    // Verify at least some product names are visible
    await expect(headPage.getByText("CRM Platform").first()).toBeVisible();
    await expect(
      headPage.getByText("Data Analytics Suite").first(),
    ).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Product Accordions
  // -----------------------------------------------------------------------

  test("product accordion expands on click to show Current Week items", async ({
    headPage,
  }) => {
    // All accordions start collapsed (defaultOpen={false})
    // Click the CRM Platform accordion to expand it
    const crmAccordionBtn = headPage.locator(
      "#report-product-crm button[aria-expanded]",
    );

    // Retry click until expanded (handles hydration timing)
    for (let i = 0; i < 10; i++) {
      await crmAccordionBtn.click();
      try {
        await headPage
          .locator("#report-product-crm")
          .getByText("Current Week")
          .waitFor({ state: "visible", timeout: 1_000 });
        break;
      } catch {
        // Retry
      }
    }

    // Current Week section should be visible inside expanded accordion
    await expect(
      headPage.locator("#report-product-crm").getByText("Current Week"),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("expanded accordion shows Risks section", async ({ headPage }) => {
    // Expand the Data Analytics accordion (has risks)
    const analyticsBtn = headPage.locator(
      "#report-product-analytics button[aria-expanded]",
    );

    for (let i = 0; i < 10; i++) {
      await analyticsBtn.click();
      try {
        await headPage
          .locator("#report-product-analytics")
          .getByText("Risks & Blockers")
          .waitFor({ state: "visible", timeout: 1_000 });
        break;
      } catch {
        // Retry
      }
    }

    await expect(
      headPage
        .locator("#report-product-analytics")
        .getByText("Risks & Blockers"),
    ).toBeVisible({ timeout: 5_000 });
  });

  // -----------------------------------------------------------------------
  // Publish & Lock
  // -----------------------------------------------------------------------

  test('"Publish & Lock" button is visible', async ({ headPage }) => {
    await expect(
      headPage.getByRole("button", { name: "Publish & Lock" }),
    ).toBeVisible();
  });

  test('clicking "Publish & Lock" opens confirmation dialog', async ({
    headPage,
  }) => {
    const publishBtn = headPage.getByRole("button", { name: "Publish & Lock" });
    const dialogTitle = headPage.getByText("Publish & Lock Report?");

    // Retry click until the dialog appears (handles hydration timing)
    for (let i = 0; i < 10; i++) {
      await publishBtn.click();
      try {
        await dialogTitle.waitFor({ state: "visible", timeout: 1_000 });
        break;
      } catch {
        // Retry
      }
    }

    await expect(dialogTitle).toBeVisible({ timeout: 5_000 });
    // Should show pending leads warning (2 of 6 haven't submitted)
    await expect(headPage.getByText("haven't submitted yet")).toBeVisible();
    await expect(
      headPage.getByRole("button", { name: "Cancel" }),
    ).toBeVisible();
    await expect(
      headPage.getByRole("button", { name: "Publish Anyway" }),
    ).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Export PDF
  // -----------------------------------------------------------------------

  test('"Export PDF" button is visible', async ({ headPage }) => {
    await expect(
      headPage.getByRole("button", {
        name: /^(Export PDF|Publish to export PDF)$/,
      }),
    ).toBeVisible();
  });
});
