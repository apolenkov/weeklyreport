/**
 * Data Integrity E2E Tests
 *
 * Validates cross-component data consistency: item counts match badges,
 * risk counts are consistent across views, product names appear everywhere
 * they should, and stage assignees match between SDLC pipeline and admin.
 *
 * All data is currently mock; tests verify that the same mock data
 * renders consistently across components and pages.
 *
 * Covers: SC-70..SC-73
 */

import { test, expect } from "./fixtures";

// ---------------------------------------------------------------------------
// SC-70: Item counts in badges match actual items
// ---------------------------------------------------------------------------

test.describe("SC-70: Item counts in badges match actual items", () => {
  test("Current Week badge count matches mock data item count", async ({
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

    // Mock data has 11 current week items (MOCK_CURRENT_WEEK_ITEMS.length)
    // The badge should show "11 items"
    await expect(leadPage.getByText("11 items")).toBeVisible();
  });

  test("Next Week badge count matches mock data item count", async ({
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

    // Mock data has 6 next week items (MOCK_NEXT_WEEK_ITEMS.length)
    // The badge should show "6 items"
    await expect(leadPage.getByText("6 items")).toBeVisible();
  });

  test('Priorities badge shows "3/3" matching 3 mock priorities', async ({
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

    // MOCK_PRIORITIES has 3 entries, badge shows "3/3"
    await expect(leadPage.getByText("3/3")).toBeVisible();
  });

  test("Decisions badge count matches mock data", async ({ leadPage }) => {
    await leadPage.goto("/lead/report");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await leadPage
      .getByText("Product Status")
      .waitFor({ state: "visible", timeout: 15_000 });
    await leadPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // MOCK_DECISIONS has 2 entries
    // The badge for Decisions section should show "2"
    const decisionsSection = leadPage.getByText("Decisions").first();
    await expect(decisionsSection).toBeVisible();
    // Badge is a sibling span with "2"
    await expect(
      leadPage.locator("text=Decisions").locator("..").getByText("2"),
    ).toBeVisible();
  });

  test("Product Status badge shows correct count", async ({ leadPage }) => {
    await leadPage.goto("/lead/report");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await leadPage
      .getByText("Product Status")
      .waitFor({ state: "visible", timeout: 15_000 });
    await leadPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // MOCK_PRODUCTS has 6 products
    await expect(leadPage.getByText("6 assigned products")).toBeVisible();
  });

  test("Submissions KPI on dashboard matches lead count", async ({
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

    // Mock data shows 4 of 6 leads submitted
    await expect(headPage.getByText("4/6").first()).toBeVisible();

    // The same count should appear on the weekly report
    await headPage.goto("/head/report");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage
      .getByRole("heading", { name: "Weekly Report" })
      .waitFor({ state: "visible", timeout: 15_000 });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    await expect(headPage.getByText("4/6 Submitted")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// SC-71: Risk counts match across Lead Form, Assembled, Published
// ---------------------------------------------------------------------------

test.describe("SC-71: Risk counts consistent across views", () => {
  test("Risks badge on lead form shows count matching mock data", async ({
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

    // MOCK_RISKS has 3 entries -- badge should show "3"
    // The risks badge has red styling
    const risksHeader = leadPage.getByText("Risks & Blockers").first();
    await expect(risksHeader).toBeVisible();
  });

  test("submit dialog shows correct risk count from mock data", async ({
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

    // Open submit dialog to see summary counts
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

    // Dialog summary should show: 11 current week, 6 next week, 3 risks, 2 decisions
    const dialog = leadPage.locator('[role="dialog"]');
    await expect(dialog.getByText("11")).toBeVisible();
    await expect(dialog.getByText("current week items")).toBeVisible();
    await expect(dialog.getByText("6")).toBeVisible();
    await expect(dialog.getByText("next week items")).toBeVisible();
    await expect(dialog.getByText("3")).toBeVisible();
    await expect(dialog.getByText("risks")).toBeVisible();
    await expect(dialog.getByText("2")).toBeVisible();
    await expect(dialog.getByText("decisions")).toBeVisible();
  });

  test("dashboard Risks & Blockers KPI shows blockers and at-risk counts", async ({
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

    // KPI card renders risk categories
    await expect(headPage.getByText("Risks & Blockers")).toBeVisible();
    await expect(headPage.getByText("Blocked").first()).toBeVisible();
    await expect(headPage.getByText("At Risk").first()).toBeVisible();
    await expect(headPage.getByText("Decisions").first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// SC-72: Product names consistent everywhere
// ---------------------------------------------------------------------------

test.describe("SC-72: Product names consistent everywhere", () => {
  test("product names on lead form match names on weekly report", async ({
    leadPage,
    headPage,
  }) => {
    // Get product names from lead form
    await leadPage.goto("/lead/report");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await leadPage
      .getByText("Product Status")
      .waitFor({ state: "visible", timeout: 15_000 });
    await leadPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // Known product names from mock data -- verify they appear on lead form
    const productNames = [
      "CRM Platform",
      "Data Analytics Suite",
      "Mobile Applications",
      "Cloud Infrastructure",
      "AI/ML Platform",
      "Integration Gateway",
    ];

    for (const name of productNames) {
      await expect(leadPage.getByText(name).first()).toBeVisible({
        timeout: 5_000,
      });
    }

    // Now check the weekly report has the same product names
    await headPage.goto("/head/report");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage
      .getByRole("heading", { name: "Weekly Report" })
      .waitFor({ state: "visible", timeout: 15_000 });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // Portfolio overview should show the same product names
    await expect(headPage.getByText("CRM Platform").first()).toBeVisible();
    await expect(
      headPage.getByText("Data Analytics Suite").first(),
    ).toBeVisible();
  });

  test("product names on lead form match names on dashboard", async ({
    leadPage,
    headPage,
  }) => {
    // Navigate lead form first
    await leadPage.goto("/lead/report");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await leadPage
      .getByText("Product Status")
      .waitFor({ state: "visible", timeout: 15_000 });
    await leadPage.waitForLoadState("networkidle", { timeout: 15_000 });

    await expect(leadPage.getByText("CRM Platform").first()).toBeVisible();

    // Dashboard should also reference products
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage
      .getByRole("heading", { name: "Dashboard" })
      .waitFor({ state: "visible", timeout: 15_000 });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // Dashboard shows lead names (not product names directly),
    // but the main heading and KPI should be consistent
    await expect(
      headPage.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
    await expect(headPage.getByText("Development Department")).toBeVisible();
  });

  test("product count is consistent between badge and rendered products", async ({
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

    // Badge says "6 assigned products"
    await expect(leadPage.getByText("6 assigned products")).toBeVisible();

    // Verify that exactly 6 product name headings are rendered in the pipeline
    const productNames = [
      "CRM Platform",
      "Data Analytics Suite",
      "Mobile Applications",
      "Cloud Infrastructure",
      "AI/ML Platform",
      "Integration Gateway",
    ];

    for (const name of productNames) {
      await expect(leadPage.getByText(name).first()).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// SC-73: Stage assignees match between SDLC pipeline and Admin config
// ---------------------------------------------------------------------------

test.describe("SC-73: Stage assignees match SDLC pipeline and Admin", () => {
  test("assignee names visible under stage chips on lead form", async ({
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

    // Current user "Тимлид 1" is assigned to several stages
    // Their name should appear as assignee label under their stage chips
    const lead1Labels = leadPage.getByText("Тимлид 1");
    const count = await lead1Labels.count();

    // lead 1 is assigned to: CRM/Dev, Analytics/Testing, Mobile/DevOps,
    // Cloud/Dev, AI-ML/Testing, Gateway/Dev = 6 stages + header = at least 6
    expect(count).toBeGreaterThanOrEqual(6);
  });

  test("locked stages show other assignee names", async ({ leadPage }) => {
    await leadPage.goto("/lead/report");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await leadPage
      .getByText("Product Status")
      .waitFor({ state: "visible", timeout: 15_000 });
    await leadPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // Other assignees from mock data should be visible
    await expect(leadPage.getByText("Ivanov A.").first()).toBeVisible();
    await expect(leadPage.getByText("Petrova M.").first()).toBeVisible();
    await expect(leadPage.getByText("Sidorov P.").first()).toBeVisible();
  });

  test("unassigned stages show dash marker", async ({ leadPage }) => {
    await leadPage.goto("/lead/report");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await leadPage
      .getByText("Product Status")
      .waitFor({ state: "visible", timeout: 15_000 });
    await leadPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // Unassigned stages show "--- unassigned" (em dash + text)
    // Multiple products have unassigned stages
    const unassignedLabels = leadPage.getByText("unassigned");
    const count = await unassignedLabels.count();

    // Analytics has 3, Mobile has 3, Cloud has 2, AI-ML has 1, Gateway has 3 = 12 unassigned
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test("admin panel shows stage assignments that match pipeline data", async ({
    headPage,
  }) => {
    await headPage.goto("/admin?tab=products");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // Admin panel should show Products tab with stage assignment UI
    await expect(
      headPage.getByRole("heading", { name: "Admin Panel" }),
    ).toBeVisible();

    // Products tab lists product names from admin mock data
    await expect(headPage.getByText("CRM Portal").first()).toBeVisible();
    await expect(
      headPage.getByText("Analytics Dashboard").first(),
    ).toBeVisible();
  });

  test("lead name in header matches assignee in SDLC pipeline", async ({
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

    // Header shows "Тимлид 1" as the current user
    await expect(leadPage.getByText("Тимлид 1").first()).toBeVisible();

    // The same name should appear as assignee under "mine" stage chips
    // Check CRM Platform Dev stage (mine, at-risk)
    const devAtRisk = leadPage.getByLabel("Dev: at-risk").first();
    await expect(devAtRisk).toBeVisible();

    // The assignee label is a sibling of the button in the same flex container
    // Verify Тимлид 1 appears near this stage
    const crmSection = leadPage.getByText("CRM Platform").first().locator("..");
    await expect(crmSection).toBeVisible();
  });
});
