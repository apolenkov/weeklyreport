/**
 * Publish & Lock / Reopen / Revoke E2E Tests
 *
 * Covers missing scenarios from the traceability matrix:
 * - SC-150: Full lifecycle -- open, leads submit, publish & lock
 * - SC-152: Publish with partial submissions -- warning with names
 * - SC-155: After publish -- Weekly Report shows Published badge
 * - SC-156: Reopen -- leads can edit again (fixme: UI not yet implemented)
 * - SC-157: Re-publish after reopen (fixme: UI not yet implemented)
 * - SC-158: Double publish attempt -- already published (fixme: UI not yet implemented)
 * - SC-160: Revoke specific lead's submission (fixme: UI not yet implemented)
 * - SC-161: After revoke -- lead's form becomes editable (fixme: UI not yet implemented)
 * - SC-162: After revoke -- KPI submissions count updates (fixme: UI not yet implemented)
 * - SC-163: After revoke -- Weekly Report removes revoked data (fixme: UI not yet implemented)
 * - SC-164: Revoke + lead re-submits (fixme: UI not yet implemented)
 * - SC-165: Revoke all leads simultaneously (fixme: UI not yet implemented)
 * - SC-166: Revoke during Published state (fixme: UI not yet implemented)
 * - SC-167: Revoke non-submitted lead -- button not shown (fixme: UI not yet implemented)
 *
 * All data is currently mock; tests verify UI rendering and interactions.
 */

import { test, expect } from "./fixtures";

// ==========================================================================
// Publish & Lock Flow
// ==========================================================================

test.describe("Publish & Lock Flow", () => {
  test.beforeEach(async ({ headPage }) => {
    await headPage.goto("/head/report");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage
      .getByRole("heading", { name: "Weekly Report" })
      .waitFor({ state: "visible", timeout: 15_000 });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });
  });

  // -----------------------------------------------------------------------
  // SC-150: Full lifecycle publish
  // -----------------------------------------------------------------------

  test("SC-150: Publish & Lock freezes report into Published state", async ({
    headPage,
  }) => {
    // 1. Verify "Publish & Lock" button is visible (report is not yet published)
    const publishBtn = headPage.getByRole("button", { name: "Publish & Lock" });
    await expect(publishBtn).toBeVisible();

    // 2. Click Publish & Lock to open confirmation dialog
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

    // 3. Confirm publish
    await headPage.getByRole("button", { name: "Publish Anyway" }).click();

    // 4. Dialog closes
    await expect(dialogTitle).not.toBeVisible({ timeout: 5_000 });

    // 5. "Published" label replaces the button
    await expect(headPage.getByText("Published").first()).toBeVisible({
      timeout: 5_000,
    });

    // 6. "Publish & Lock" button is gone
    await expect(
      headPage.getByRole("button", { name: "Publish & Lock" }),
    ).not.toBeVisible();
  });

  // -----------------------------------------------------------------------
  // SC-152: Publish with partial submissions
  // -----------------------------------------------------------------------

  test("SC-152: Publish dialog warns about pending leads with count", async ({
    headPage,
  }) => {
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

    // Mock data: 2 of 6 haven't submitted
    await expect(headPage.getByText("2 of 6")).toBeVisible();
    // Warning about empty sections
    await expect(
      headPage.getByText("empty in the published report"),
    ).toBeVisible();
    // "Publish Anyway" appears because there are pending leads
    await expect(
      headPage.getByRole("button", { name: "Publish Anyway" }),
    ).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // SC-155: After publish -- Published badge on Weekly Report
  // -----------------------------------------------------------------------

  test("SC-155: After publish, Weekly Report header shows Published badge", async ({
    headPage,
  }) => {
    // Publish the report
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
    await headPage.getByRole("button", { name: "Publish Anyway" }).click();
    await expect(dialogTitle).not.toBeVisible({ timeout: 5_000 });

    // Verify Published badge is a lock icon + "Published" text
    const publishedBadge = headPage.getByText("Published").first();
    await expect(publishedBadge).toBeVisible({ timeout: 5_000 });

    // Export PDF button should still be visible
    await expect(
      headPage.getByRole("button", { name: "Export PDF" }),
    ).toBeVisible();
  });

  test("SC-155: After publish, Publish & Lock button is replaced (not just hidden)", async ({
    headPage,
  }) => {
    // Publish the report
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
    await headPage.getByRole("button", { name: "Publish Anyway" }).click();
    await expect(dialogTitle).not.toBeVisible({ timeout: 5_000 });

    // The Published label is a <span>, not a <button>
    const publishedSpan = headPage
      .locator("span")
      .filter({ hasText: "Published" })
      .first();
    await expect(publishedSpan).toBeVisible({ timeout: 5_000 });

    // No publish button remains
    await expect(
      headPage.getByRole("button", { name: "Publish & Lock" }),
    ).toHaveCount(0);
  });

  // -----------------------------------------------------------------------
  // SC-150: Published state preserves all product accordions
  // -----------------------------------------------------------------------

  test("SC-150: After publish, product accordions remain accessible", async ({
    headPage,
  }) => {
    // Publish first
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
    await headPage.getByRole("button", { name: "Publish Anyway" }).click();
    await expect(dialogTitle).not.toBeVisible({ timeout: 5_000 });

    // Product accordions should still be expandable
    const crmBtn = headPage.locator(
      "#report-product-crm button[aria-expanded]",
    );
    await expect(crmBtn).toBeVisible();

    for (let i = 0; i < 10; i++) {
      await crmBtn.click();
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
    await expect(
      headPage.locator("#report-product-crm").getByText("Current Week"),
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ==========================================================================
// Reopen Flow (SC-156..SC-158) -- UI not yet implemented
// ==========================================================================

test.describe("Reopen Flow", () => {
  test.fixme("SC-156: Reopen button appears after publish and allows leads to edit again", async ({
    headPage,
  }) => {
    // TODO: Implement when Reopen button is added to publish-lock-button.tsx
    // Expected flow:
    // 1. After publish, a "Reopen" button appears
    // 2. Click Reopen -> confirmation dialog
    // 3. After reopen, leads can edit their forms again
    // 4. Published badge is removed, Live badge returns
    await headPage.goto("/head/report");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
  });

  test.fixme("SC-157: Re-publish after reopen works correctly", async ({
    headPage,
  }) => {
    // TODO: Implement when Reopen + Re-publish flow exists
    // Expected flow:
    // 1. Publish -> Reopen -> leads edit -> Re-publish
    // 2. Report returns to Published state
    await headPage.goto("/head/report");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
  });

  test.fixme("SC-158: Double publish attempt shows already-published state", async ({
    headPage,
  }) => {
    // TODO: Implement when Published state has proper guard
    // Expected: after publish, attempting to publish again is blocked
    // (currently the button disappears, so this is partially handled)
    await headPage.goto("/head/report");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
  });
});

// ==========================================================================
// Revoke Flow (SC-160..SC-167) -- UI not yet implemented
// ==========================================================================

test.describe("Revoke Submission Flow", () => {
  test.fixme("SC-160: Revoke button visible on submitted lead cards in dashboard", async ({
    headPage,
  }) => {
    // TODO: Implement when Revoke button is added to lead-report-card.tsx
    // Expected: Head sees "Revoke" action on each submitted lead card
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
  });

  test.fixme("SC-161: After revoke, lead form becomes editable again", async ({
    headPage,
  }) => {
    // TODO: Implement when Revoke flow is wired
    // Expected: Revoking a lead's submission unlocks their form
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
  });

  test.fixme("SC-162: After revoke, KPI submissions count updates", async ({
    headPage,
  }) => {
    // TODO: Implement when Revoke flow is wired
    // Expected: Submissions count decreases (e.g., 4/6 -> 3/6)
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
  });

  test.fixme("SC-163: After revoke, Weekly Report removes revoked lead data", async ({
    headPage,
  }) => {
    // TODO: Implement when Revoke flow is wired
    // Expected: Product accordions no longer show revoked lead's items
    await headPage.goto("/head/report");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
  });

  test.fixme("SC-164: Revoke + lead re-submits full cycle", async ({
    headPage,
  }) => {
    // TODO: Implement when Revoke flow is wired
    // Expected: Revoke -> lead edits -> lead re-submits -> data reappears
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
  });

  test.fixme("SC-165: Revoke all leads simultaneously", async ({
    headPage,
  }) => {
    // TODO: Implement when bulk Revoke action exists
    // Expected: "Revoke All" action revokes all submitted leads at once
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
  });

  test.fixme("SC-166: Revoke during Published state requires reopen first", async ({
    headPage,
  }) => {
    // TODO: Implement when Revoke + Reopen flow exists
    // Expected: Cannot revoke while report is published; must reopen first
    await headPage.goto("/head/report");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
  });

  test.fixme("SC-167: Revoke button not shown for non-submitted leads", async ({
    headPage,
  }) => {
    // TODO: Implement when Revoke button exists
    // Expected: Pending/Draft leads do not show Revoke action
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
  });
});
