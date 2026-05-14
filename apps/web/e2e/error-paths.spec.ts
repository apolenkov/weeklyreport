/**
 * Error Paths + Edge Cases E2E Tests
 *
 * Validates error handling, invalid parameters, form validation UI,
 * and navigation edge cases across the application.
 * All data is currently mock; tests verify graceful degradation.
 *
 * Covers: SC-47..SC-58 (Data Integrity, UI States, Edge Cases), E2E-09
 */

import { test, expect } from "./fixtures";

// ---------------------------------------------------------------------------
// Auth Error Page
// ---------------------------------------------------------------------------

test.describe("Auth Error Page", () => {
  test("renders at /auth/error with default message", async ({ leadPage }) => {
    await leadPage.goto("/auth/error");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    await expect(
      leadPage.getByRole("heading", { name: "Authentication Error" }),
    ).toBeVisible();
    await expect(
      leadPage.getByText("An authentication error occurred."),
    ).toBeVisible();
  });

  test("shows specific message for reason=invalid_assertion", async ({
    leadPage,
  }) => {
    await leadPage.goto("/auth/error?reason=invalid_assertion");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    await expect(
      leadPage.getByText("The SSO response was invalid. Please try again."),
    ).toBeVisible();
  });

  test('has "Return to Login" link pointing to /', async ({ leadPage }) => {
    await leadPage.goto("/auth/error");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    const link = leadPage.getByLabel("Return to login page");
    await expect(link).toBeVisible();
    await expect(link).toHaveText("Return to Login");
    await expect(link).toHaveAttribute("href", "/");
  });
});

// ---------------------------------------------------------------------------
// 404 — Invalid Route
// ---------------------------------------------------------------------------

test.describe("Not Found", () => {
  test("invalid route renders 404 page", async ({ leadPage }) => {
    const response = await leadPage.goto("/this-page-does-not-exist");

    // Next.js returns 404 for unknown routes
    expect(response?.status()).toBe(404);
    // Page should contain 404 text (Next.js default or custom)
    await expect(leadPage.getByText(/404/)).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// Invalid Parameters
// ---------------------------------------------------------------------------

test.describe("Invalid Parameters", () => {
  test('/admin?tab=invalid defaults to "users" tab', async ({ headPage }) => {
    await headPage.goto("/admin?tab=invalid");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // Admin Panel heading still renders
    await expect(
      headPage.getByRole("heading", { name: "Admin Panel" }),
    ).toBeVisible();
    // Users tab should be active (default fallback)
    const usersTab = headPage.getByLabel("Users tab");
    await expect(usersTab).toHaveAttribute("aria-current", "page");
  });

  test("/lead/report without period param renders correctly", async ({
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

    // Page renders the full form without a period param
    await expect(
      leadPage.getByRole("heading", { name: "My Report" }),
    ).toBeVisible();
    await expect(leadPage.getByText("Product Status")).toBeVisible();
  });

  test("/reports/nonexistent-uuid renders report viewer page", async ({
    headPage,
  }) => {
    await headPage.goto("/reports/nonexistent-uuid");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    // The report viewer renders with mock data regardless of reportId
    await expect(
      headPage.getByRole("heading", { name: "Weekly Status Report" }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Form Validation UI
// ---------------------------------------------------------------------------

test.describe("Form Validation UI", () => {
  test.beforeEach(async ({ leadPage }) => {
    await leadPage.goto("/lead/report");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await leadPage
      .getByText("Product Status")
      .waitFor({ state: "visible", timeout: 15_000 });
    await leadPage.waitForLoadState("networkidle", { timeout: 15_000 });
  });

  test("lead form has Submit Report button", async ({ leadPage }) => {
    const submitBtn = leadPage
      .getByRole("button", { name: "Submit Report" })
      .first();
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
  });

  test("Priorities section shows numbered list with count", async ({
    leadPage,
  }) => {
    await expect(leadPage.getByText("Top 3 Priorities")).toBeVisible();
    // Shows "3/3" badge indicating required count
    await expect(leadPage.getByText("3/3")).toBeVisible();
  });

  test("all form sections have proper labels", async ({ leadPage }) => {
    // Core accordion sections are present with headings/labels
    await expect(leadPage.getByText("Current Week")).toBeVisible();
    await expect(leadPage.getByText("Next Week")).toBeVisible();
    await expect(leadPage.getByText("Risks & Blockers")).toBeVisible();
    await expect(leadPage.getByText("Decisions")).toBeVisible();
    await expect(leadPage.getByText("Top 3 Priorities")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Navigation Edge Cases
// ---------------------------------------------------------------------------

test.describe("Navigation Edge Cases", () => {
  test("all nav links resolve to valid routes", async ({ leadPage }) => {
    await leadPage.goto("/lead/report");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    // Collect hrefs from the main navigation bar
    const navLinks = leadPage.locator('nav[aria-label="Main navigation"] a');
    const count = await navLinks.count();

    // Navigation must have at least 1 link
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const href = await navLinks.nth(i).getAttribute("href");
      expect(href).toBeTruthy();
      expect(href).toMatch(/^\//);
    }
  });

  test("browser back from /lead/report lands on previous page", async ({
    leadPage,
  }) => {
    // Navigate to history first, then to report
    await leadPage.goto("/lead/history");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    await leadPage.goto("/lead/report");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    // Go back
    await leadPage.goBack();
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    // Should be back on history page
    expect(leadPage.url()).toContain("/lead/history");
  });
});
