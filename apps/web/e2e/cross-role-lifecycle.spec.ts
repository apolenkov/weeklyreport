/**
 * Cross-Role Lifecycle & Revoke Flow E2E Tests
 *
 * Validates multi-role workflows between lead and head views.
 * Tests use both leadPage and headPage fixtures to verify that
 * UI elements for cross-role features render correctly:
 * - Lead submission flow and resulting read-only state
 * - Head dashboard reflecting lead submission statuses
 * - Publish & Lock workflow and its effect on the report
 * - Published report rendering
 * - Lock/submitted state indicators across roles
 *
 * All data is currently mock; tests verify UI rendering
 * of cross-role state indicators and navigation between views.
 *
 * Covers: SC-39..SC-46 (Access Control partial), E2E-04, E2E-05
 */

import { test, expect } from "./fixtures";

test.describe("Cross-Role Lifecycle", () => {
  // -----------------------------------------------------------------------
  // Cross-Role UI Elements (E2E-04)
  // -----------------------------------------------------------------------

  test('lead form shows "Submitted" badge after submitting', async ({
    leadPage,
  }) => {
    await leadPage.goto("/lead/report");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await leadPage
      .getByText("Product Status")
      .waitFor({ state: "visible", timeout: 15_000 });
    await leadPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // Submit the report via confirmation dialog
    const submitBtn = leadPage
      .getByRole("button", { name: "Submit Report" })
      .first();
    const dialogTitle = leadPage.getByText("Submit Report?");

    for (let i = 0; i < 10; i++) {
      await submitBtn.click();
      try {
        await dialogTitle.waitFor({ state: "visible", timeout: 1_000 });
        break;
      } catch {
        // Retry until hydrated
      }
    }
    await expect(dialogTitle).toBeVisible({ timeout: 5_000 });

    // Confirm submission
    const confirmBtn = leadPage
      .getByRole("button", { name: "Submit Report" })
      .last();
    await confirmBtn.click();

    // Verify "Submitted" badge appears in header
    await expect(leadPage.getByText("Submitted").first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("lead form in submitted state has disabled Submit button", async ({
    leadPage,
  }) => {
    await leadPage.goto("/lead/report");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await leadPage
      .getByText("Product Status")
      .waitFor({ state: "visible", timeout: 15_000 });
    await leadPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // Submit the report
    const submitBtn = leadPage
      .getByRole("button", { name: "Submit Report" })
      .first();
    const dialogTitle = leadPage.getByText("Submit Report?");

    for (let i = 0; i < 10; i++) {
      await submitBtn.click();
      try {
        await dialogTitle.waitFor({ state: "visible", timeout: 1_000 });
        break;
      } catch {
        // Retry
      }
    }
    await expect(dialogTitle).toBeVisible({ timeout: 5_000 });

    const confirmBtn = leadPage
      .getByRole("button", { name: "Submit Report" })
      .last();
    await confirmBtn.click();
    await expect(dialogTitle).not.toBeVisible({ timeout: 5_000 });

    // Verify Submit button is now disabled (read-only mode)
    const disabledBtn = leadPage
      .getByRole("button", { name: "Submit Report" })
      .first();
    await expect(disabledBtn).toBeDisabled();

    // Verify read-only banner appears
    await expect(
      leadPage.getByText("Report submitted. This form is now read-only."),
    ).toBeVisible();
  });

  test('head dashboard shows lead cards with "Submitted" status', async ({
    headPage,
  }) => {
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage
      .getByRole("heading", { name: "Dashboard" })
      .waitFor({ state: "visible", timeout: 15_000 });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // Mock data has 4 submitted leads -- verify "Submitted" badges exist
    const submittedBadges = headPage.getByText("Submitted", { exact: true });
    const count = await submittedBadges.count();
    expect(count).toBeGreaterThanOrEqual(4);

    // Also verify lead names are visible for submitted leads
    await expect(headPage.getByText("Тимлид 1").first()).toBeVisible();
    await expect(headPage.getByText("Maria K.").first()).toBeVisible();
    await expect(headPage.getByText("Igor V.").first()).toBeVisible();
    await expect(headPage.getByText("Dmitry S.").first()).toBeVisible();
  });

  test("head weekly report shows submission count badge", async ({
    headPage,
  }) => {
    await headPage.goto("/head/report");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage
      .getByRole("heading", { name: "Weekly Report" })
      .waitFor({ state: "visible", timeout: 15_000 });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // Live badge shows "4/6 Submitted"
    await expect(headPage.getByText("4/6 Submitted")).toBeVisible();
  });

  test("submitted lead cards on dashboard show lock icon and disabled state", async ({
    headPage,
  }) => {
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage
      .getByRole("heading", { name: "Dashboard" })
      .waitFor({ state: "visible", timeout: 15_000 });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // Non-current-user submitted cards have role="listitem" and aria-disabled="true"
    // Maria K. is a submitted non-current-user lead
    const mariaCard = headPage
      .locator('div[role="listitem"]')
      .filter({ hasText: "Maria K." });
    await expect(mariaCard).toBeVisible();
    await expect(mariaCard).toHaveAttribute("aria-disabled", "true");

    // Lock icon (SVG with rect element) should be visible
    const lockSvg = mariaCard.locator("svg").last();
    await expect(lockSvg).toBeVisible();
  });

  test('published report page renders with "Published" badge and metadata', async ({
    headPage,
  }) => {
    await headPage.goto("/reports/w16");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    // Published badge
    await expect(headPage.getByText("Published").first()).toBeVisible();

    // Published metadata line
    await expect(
      headPage.getByText("Published by Department Head"),
    ).toBeVisible();

    // Report title
    await expect(
      headPage.getByRole("heading", { name: "Weekly Status Report" }),
    ).toBeVisible();

    // Submission summary
    await expect(headPage.getByText("4/6 leads submitted")).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Revoke UI Flow (E2E-05)
  // -----------------------------------------------------------------------

  test('head weekly report has "Publish & Lock" button', async ({
    headPage,
  }) => {
    await headPage.goto("/head/report");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage
      .getByRole("heading", { name: "Weekly Report" })
      .waitFor({ state: "visible", timeout: 15_000 });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    await expect(
      headPage.getByRole("button", { name: "Publish & Lock" }),
    ).toBeVisible();
  });

  test("publish confirmation dialog mentions pending leads", async ({
    headPage,
  }) => {
    await headPage.goto("/head/report");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage
      .getByRole("heading", { name: "Weekly Report" })
      .waitFor({ state: "visible", timeout: 15_000 });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    const publishBtn = headPage.getByRole("button", { name: "Publish & Lock" });
    const dialogTitle = headPage.getByText("Publish & Lock Report?");

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

    // Dialog warns about pending leads (2 of 6)
    await expect(headPage.getByText("haven't submitted yet")).toBeVisible();
    // "Publish Anyway" button appears because there are pending leads
    await expect(
      headPage.getByRole("button", { name: "Publish Anyway" }),
    ).toBeVisible();
  });

  test('publishing transforms button to "Published" state', async ({
    headPage,
  }) => {
    await headPage.goto("/head/report");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage
      .getByRole("heading", { name: "Weekly Report" })
      .waitFor({ state: "visible", timeout: 15_000 });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    const publishBtn = headPage.getByRole("button", { name: "Publish & Lock" });
    const dialogTitle = headPage.getByText("Publish & Lock Report?");

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

    // Click "Publish Anyway"
    await headPage.getByRole("button", { name: "Publish Anyway" }).click();

    // Dialog should close
    await expect(dialogTitle).not.toBeVisible({ timeout: 5_000 });

    // Button should transform to "Published" label (not a button anymore)
    await expect(headPage.getByText("Published").first()).toBeVisible({
      timeout: 5_000,
    });
    // Original "Publish & Lock" button should no longer exist
    await expect(
      headPage.getByRole("button", { name: "Publish & Lock" }),
    ).not.toBeVisible();
  });

  test("lead history shows consistent submission statuses per period", async ({
    leadPage,
  }) => {
    await leadPage.goto("/lead/history");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    // All 6 history entries should be present
    const historyCards = leadPage.locator('a[href*="/lead/report?period="]');
    await expect(historyCards).toHaveCount(6);

    // Each card has a "Submitted" badge (all mock history entries are submitted)
    const submittedBadges = leadPage.getByText("Submitted", { exact: true });
    await expect(submittedBadges).toHaveCount(6);

    // Cards cover different periods with distinct week labels
    await expect(leadPage.getByText("Week 15")).toBeVisible();
    await expect(leadPage.getByText("Week 14")).toBeVisible();
    await expect(leadPage.getByText("Week 13")).toBeVisible();
    await expect(leadPage.getByText("Week 12")).toBeVisible();
    await expect(leadPage.getByText("Week 11")).toBeVisible();
    await expect(leadPage.getByText("Week 10")).toBeVisible();
  });
});
