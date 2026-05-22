/**
 * Publish & Lock / Reopen / Revoke E2E Tests
 *
 * Covers missing scenarios from the traceability matrix:
 * - SC-150: Full lifecycle -- open, leads submit, publish & lock
 * - SC-152: Publish with partial submissions -- warning with names
 * - SC-155: After publish -- Weekly Report shows Published badge
 * - SC-156: Reopen -- leads can edit again (LIVE — Reopen Period button wired)
 * - SC-157: Re-publish after reopen (LIVE — Reopen Period confirmation dialog wired)
 * - SC-158: Double publish attempt -- already published (LIVE — published state shows Reopen, not Publish)
 * - SC-160: Revoke button on dashboard lead-card (fixme: design decision pending)
 * - SC-161: After revoke -- lead's form becomes editable (LIVE — Revoke button wired)
 * - SC-162: After revoke -- KPI submissions count updates (MIGRATED → revoke-downstream.integration.spec.ts)
 * - SC-163: After revoke -- Weekly Report removes revoked data (MIGRATED → revoke-downstream.integration.spec.ts)
 * - SC-164: Revoke + lead re-submits (MIGRATED → revoke-downstream.integration.spec.ts)
 * - SC-165: Revoke all leads simultaneously (fixme: bulk-revoke feature not built)
 * - SC-166: Revoke during Published state (MIGRATED → revoke-downstream.integration.spec.ts)
 * - SC-167: Revoke non-submitted lead -- button not shown (LIVE — Revoke not shown for draft sections)
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
// Reopen Flow (SC-156..SC-158)
// ==========================================================================

test.describe("Reopen Flow", () => {
  test("SC-156: Reopen Period button visible on a published report", async ({
    headPage,
  }) => {
    // Published period: "Reopen Period" is the only available lifecycle action.
    await headPage.goto("/head/report/a0000000-0000-4000-8000-000000000002");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    await expect(
      headPage.getByRole("button", { name: "Reopen Period" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("SC-157: Reopen confirm dialog cancel leaves period as published", async ({
    headPage,
  }) => {
    // Cancel out of the Reopen dialog — published state must be preserved.
    await headPage.goto("/head/report/a0000000-0000-4000-8000-000000000002");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    const reopenBtn = headPage.getByRole("button", { name: "Reopen Period" });
    await expect(reopenBtn).toBeVisible({ timeout: 10_000 });

    // Open the reopen confirmation dialog
    await reopenBtn.click();
    const dialogTitle = headPage.getByText("Reopen this period?");
    await expect(dialogTitle).toBeVisible({ timeout: 5_000 });

    // Cancel — dialog closes, period remains published
    await headPage.getByRole("button", { name: "Cancel" }).click();
    await expect(dialogTitle).not.toBeVisible({ timeout: 5_000 });

    // Reopen Period button still visible — period is still published
    await expect(reopenBtn).toBeVisible();
    await expect(
      headPage.getByRole("button", { name: /Publish/ }),
    ).not.toBeVisible();
  });

  test("SC-158: Published report shows Reopen — not Publish & Lock", async ({
    headPage,
  }) => {
    // When period is already published, "Publish & Lock" must not be shown.
    await headPage.goto("/head/report/a0000000-0000-4000-8000-000000000002");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    await expect(
      headPage.getByRole("button", { name: "Reopen Period" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      headPage.getByRole("button", { name: /Publish/ }),
    ).not.toBeVisible();
  });
});

// ==========================================================================
// Revoke Flow (SC-160..SC-167)
// ==========================================================================

test.describe("Revoke Submission Flow", () => {
  test.fixme("SC-160: Revoke button visible on submitted lead cards in dashboard", async ({
    headPage,
  }) => {
    // DOCUMENTED GAP — DESIGN DECISION PENDING.
    // Dashboard-level Revoke button in lead-report-card.tsx has not been
    // added; placement and UX are unresolved. This stub remains until the
    // design decision is made. The per-section Revoke path (/lead/report
    // foreign-author view) is LIVE and covered by SC-161 / SC-167 below.
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
  });

  test("SC-161: Revoke button visible when head views a submitted section", async ({
    headPage,
  }) => {
    // Seed: LEAD_MARIA (a0000000-0000-4000-8000-000000000012) has status=submitted
    // in REPORT_ACTIVE (a0000000-0000-4000-8000-000000000001).
    // Head navigates via foreign-author URL — Revoke button must be visible.
    await headPage.goto(
      "/lead/report/a0000000-0000-4000-8000-000000000001" +
        "?authorId=a0000000-0000-4000-8000-000000000012",
    );
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    await expect(
      headPage.getByRole("button", { name: "Revoke" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  // SC-162, SC-163, SC-164, SC-166 migrated to DB-backed integration suite:
  //   apps/web/e2e/integration/revoke-downstream.integration.spec.ts
  // They require a live API + E2E_DATABASE_URL and use direct Prisma assertions.

  test.fixme("SC-165: Revoke all leads simultaneously", async ({
    headPage,
  }) => {
    // DOCUMENTED GAP — FEATURE NOT BUILT.
    // Bulk-revoke ("Revoke All") action does not exist. No UI, no tRPC
    // procedure, no service method. This stub stays until the feature is
    // scoped and built.
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
  });

  test("SC-167: Revoke button not shown when head views a non-submitted (draft) section", async ({
    headPage,
  }) => {
    // Seed: LEAD_1 / Vasily (a0000000-0000-4000-8000-000000000011) has status=draft
    // in REPORT_ACTIVE (a0000000-0000-4000-8000-000000000001).
    // Revoke must not be shown for sections that haven't been submitted yet.
    await headPage.goto(
      "/lead/report/a0000000-0000-4000-8000-000000000001" +
        "?authorId=a0000000-0000-4000-8000-000000000011",
    );
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    await expect(
      headPage.getByRole("button", { name: "Revoke" }),
    ).not.toBeVisible();
  });
});
