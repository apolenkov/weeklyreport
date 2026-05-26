/**
 * Admin Panel E2E Tests
 *
 * Validates the admin panel at /admin — all 5 tabs (users, products,
 * periods, reminders, settings), CRUD operations, and tab navigation.
 * All data is currently mock; tests verify UI rendering and interactions.
 *
 * Covers: SC-35..SC-38 (Admin), SC-63 stage assignment
 */

import { test, expect } from "./fixtures";

// ---------------------------------------------------------------------------
// Users Tab (default)
// ---------------------------------------------------------------------------

test.describe("Admin Panel — Users Tab", () => {
  test.beforeEach(async ({ headPage }) => {
    await headPage.goto("/admin");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });
  });

  test('shows "Admin Panel" heading', async ({ headPage }) => {
    await expect(
      headPage.getByRole("heading", { name: "Admin Panel" }),
    ).toBeVisible();
  });

  test("users tab shows table with user names", async ({ headPage }) => {
    // Default tab is users — verify table headers
    await expect(
      headPage.getByRole("columnheader", { name: "Name" }),
    ).toBeVisible();
    await expect(
      headPage.getByRole("columnheader", { name: "Email" }),
    ).toBeVisible();
    await expect(
      headPage.getByRole("columnheader", { name: "Role" }),
    ).toBeVisible();
    // Verify mock user names appear in the table
    await expect(headPage.getByText("Alexey Petrov")).toBeVisible();
    await expect(headPage.getByText("Maria Ivanova")).toBeVisible();
    await expect(headPage.getByText("Igor Smirnov")).toBeVisible();
  });

  test('"Add User" button is visible', async ({ headPage }) => {
    const addBtn = headPage.getByRole("button", { name: "Add new user" });
    await expect(addBtn).toBeVisible();
    await expect(addBtn).toHaveText(/Add User/);
  });

  test("user rows show role badges", async ({ headPage }) => {
    // Each role type should appear as a badge
    await expect(headPage.getByText("lead").first()).toBeVisible();
    await expect(headPage.getByText("head").first()).toBeVisible();
    await expect(headPage.getByText("viewer").first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Products Tab
// ---------------------------------------------------------------------------

test.describe("Admin Panel — Products Tab", () => {
  test.beforeEach(async ({ headPage }) => {
    await headPage.goto("/admin?tab=products");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });
  });

  test("products tab shows product names", async ({ headPage }) => {
    await expect(headPage.getByText("CRM Portal")).toBeVisible();
    await expect(headPage.getByText("Analytics Dashboard")).toBeVisible();
    await expect(headPage.getByText("Mobile App")).toBeVisible();
  });

  test("products show lead owner names", async ({ headPage }) => {
    // Owner labels next to product names
    await expect(
      headPage.getByText("Owner: Alexey Petrov").first(),
    ).toBeVisible();
    await expect(
      headPage.getByText("Owner: Maria Ivanova").first(),
    ).toBeVisible();
  });

  test("stage assignment section visible after expanding product", async ({
    headPage,
  }) => {
    // Click expand button on CRM Portal
    const expandBtn = headPage.getByLabel(
      /Expand stage assignments for CRM Portal/,
    );
    await expandBtn.click();

    // Wait for stage labels to appear (7 stages)
    await expect(headPage.getByText("Planning").first()).toBeVisible();
    await expect(headPage.getByText("Analysis").first()).toBeVisible();
    await expect(headPage.getByText("Design").first()).toBeVisible();
    await expect(headPage.getByText("Development").first()).toBeVisible();
    await expect(headPage.getByText("Testing").first()).toBeVisible();
    await expect(headPage.getByText("DevOps").first()).toBeVisible();
    await expect(headPage.getByText("Support").first()).toBeVisible();
  });
});

// Periods Tab was removed from Admin UI in v8.1.
// Period lifecycle is scheduler-owned (PeriodCreatorScheduler).
// Manual period management is intentionally out of scope for v8.2+.

// ---------------------------------------------------------------------------
// Reminders Tab
// ---------------------------------------------------------------------------

test.describe("Admin Panel — Reminders Tab", () => {
  test.beforeEach(async ({ headPage }) => {
    await headPage.goto("/admin?tab=reminders");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });
  });

  test("reminders tab shows toggle switches", async ({ headPage }) => {
    // Three reminder rules with toggle switches
    const toggles = headPage.getByRole("switch");
    await expect(toggles).toHaveCount(3);
    // First two should be active (checked)
    await expect(toggles.nth(0)).toHaveAttribute("aria-checked", "true");
    await expect(toggles.nth(1)).toHaveAttribute("aria-checked", "true");
    // Third should be paused (unchecked)
    await expect(toggles.nth(2)).toHaveAttribute("aria-checked", "false");
  });

  test('"Send Now" buttons are visible for each reminder', async ({
    headPage,
  }) => {
    const sendButtons = headPage.getByRole("button", { name: /Send .* now/i });
    await expect(sendButtons).toHaveCount(3);
    await expect(sendButtons.first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Settings Tab
// ---------------------------------------------------------------------------

test.describe("Admin Panel — Settings Tab", () => {
  test.beforeEach(async ({ headPage }) => {
    await headPage.goto("/admin?tab=settings");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });
  });

  test("settings tab shows form fields", async ({ headPage }) => {
    await expect(headPage.getByLabel("Department Name")).toBeVisible();
    await expect(
      headPage.getByLabel("Toggle auto-create periods"),
    ).toBeVisible();
    await expect(headPage.getByLabel(/Default Deadline/)).toBeVisible();
  });

  test("department name input shows current value", async ({ headPage }) => {
    const input = headPage.getByLabel("Department Name");
    await expect(input).toHaveValue("Software Development");
  });

  test("save button is visible", async ({ headPage }) => {
    const saveBtn = headPage.getByRole("button", { name: "Save settings" });
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toHaveText(/Save Settings/);
  });
});
