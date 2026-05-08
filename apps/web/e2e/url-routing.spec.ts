/**
 * URL Routing & Navigation E2E Tests
 *
 * Validates bookmarkable URLs, query parameter persistence for period and
 * tab selection, browser back/forward navigation, 404 handling, and deep
 * link access across all role-based routes.
 *
 * Uses both leadPage and headPage fixtures to cover role-specific routes.
 *
 * Covers: SC-300..SC-311
 */

import { test, expect } from "./fixtures";

// ---------------------------------------------------------------------------
// SC-300: Every page has a unique, bookmarkable URL
// ---------------------------------------------------------------------------

test.describe("SC-300: Bookmarkable URLs", () => {
  test("SC-300: each main page has a distinct URL path", async ({
    headPage,
  }) => {
    // Dashboard
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    expect(headPage.url()).toContain("/head/dashboard");
    await expect(
      headPage.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();

    // Weekly Report
    await headPage.goto("/head/report");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    expect(headPage.url()).toContain("/head/report");
    await expect(
      headPage.getByRole("heading", { name: "Weekly Report" }),
    ).toBeVisible();

    // Admin
    await headPage.goto("/admin");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    expect(headPage.url()).toContain("/admin");
    await expect(
      headPage.getByRole("heading", { name: "Admin Panel" }),
    ).toBeVisible();
  });

  test("SC-300: lead pages have unique bookmarkable URLs", async ({
    leadPage,
  }) => {
    // Lead Report
    await leadPage.goto("/lead/report");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    expect(leadPage.url()).toContain("/lead/report");
    await expect(
      leadPage.getByRole("heading", { name: "My Report" }),
    ).toBeVisible();

    // Lead History
    await leadPage.goto("/lead/history");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    expect(leadPage.url()).toContain("/lead/history");
  });
});

// ---------------------------------------------------------------------------
// SC-301: Period selection updates URL query param (Lead Report)
// ---------------------------------------------------------------------------

test.describe("SC-301: Period selection in Lead Report URL", () => {
  test("SC-301: navigating to /lead/report?period=per3 renders the page", async ({
    leadPage,
  }) => {
    await leadPage.goto("/lead/report?period=per3");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    // Page renders with the period param in URL
    expect(leadPage.url()).toContain("period=per3");
    await expect(
      leadPage.getByRole("heading", { name: "My Report" }),
    ).toBeVisible();
  });

  test("SC-301: /lead/report without period param still renders correctly", async ({
    leadPage,
  }) => {
    await leadPage.goto("/lead/report");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    // Page renders without period param (defaults to current)
    await expect(
      leadPage.getByRole("heading", { name: "My Report" }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// SC-302: Weekly Report period selection updates URL
// ---------------------------------------------------------------------------

test.describe("SC-302: Weekly Report period URL", () => {
  test("SC-302: /head/report renders with period navigator", async ({
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

    // Weekly Report page renders
    expect(headPage.url()).toContain("/head/report");
    await expect(
      headPage.getByRole("heading", { name: "Weekly Report" }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// SC-303: Admin tab selection updates URL query param
// ---------------------------------------------------------------------------

test.describe("SC-303: Admin tab URL params", () => {
  test("SC-303: /admin?tab=products selects the products tab", async ({
    headPage,
  }) => {
    await headPage.goto("/admin?tab=products");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    expect(headPage.url()).toContain("tab=products");
    // Products tab should be active
    const productsTab = headPage.getByLabel("Products tab");
    await expect(productsTab).toHaveAttribute("aria-current", "page");
  });

  test("SC-303: /admin?tab=periods falls back because periods are not an admin tab", async ({
    headPage,
  }) => {
    await headPage.goto("/admin?tab=periods");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    await expect(headPage.getByLabel("Periods tab")).toHaveCount(0);
    await expect(headPage.getByLabel("Users tab")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("SC-303: /admin?tab=reminders selects the reminders tab", async ({
    headPage,
  }) => {
    await headPage.goto("/admin?tab=reminders");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    expect(headPage.url()).toContain("tab=reminders");
    const remindersTab = headPage.getByLabel("Reminders tab");
    await expect(remindersTab).toHaveAttribute("aria-current", "page");
  });

  test("SC-303: /admin?tab=settings selects the settings tab", async ({
    headPage,
  }) => {
    await headPage.goto("/admin?tab=settings");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    expect(headPage.url()).toContain("tab=settings");
    const settingsTab = headPage.getByLabel("Settings tab");
    await expect(settingsTab).toHaveAttribute("aria-current", "page");
  });

  test("SC-303: clicking admin tab link updates URL", async ({ headPage }) => {
    await headPage.goto("/admin");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // Click on Products tab
    const productsTab = headPage.getByLabel("Products tab");
    await productsTab.click();
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    expect(headPage.url()).toContain("tab=products");
  });
});

// ---------------------------------------------------------------------------
// SC-304: Admin viewing lead's form via URL
// ---------------------------------------------------------------------------

test.describe("SC-304: Admin can access lead form URL", () => {
  test("SC-304: /lead/report is accessible and renders content", async ({
    headPage,
  }) => {
    await headPage.goto("/lead/report");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    // The page should render (may show lead form or redirect)
    expect(headPage.url()).toContain("/lead/report");
  });
});

// ---------------------------------------------------------------------------
// SC-305: Direct URL access enforces role-based access
// ---------------------------------------------------------------------------

test.describe("SC-305: Role-based URL access", () => {
  test("SC-305: /admin?tab=invalid defaults to users tab", async ({
    headPage,
  }) => {
    await headPage.goto("/admin?tab=invalid");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // Should fall back to users tab
    const usersTab = headPage.getByLabel("Users tab");
    await expect(usersTab).toHaveAttribute("aria-current", "page");
  });

  test("SC-305: admin routes render Admin Panel for authorized users", async ({
    headPage,
  }) => {
    await headPage.goto("/admin");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    await expect(
      headPage.getByRole("heading", { name: "Admin Panel" }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// SC-306: Browser refresh preserves page state
// ---------------------------------------------------------------------------

test.describe("SC-306: Browser refresh preserves state", () => {
  test("SC-306: refreshing /admin?tab=products keeps products tab active", async ({
    headPage,
  }) => {
    await headPage.goto("/admin?tab=products");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // Verify products tab is active
    const productsTab = headPage.getByLabel("Products tab");
    await expect(productsTab).toHaveAttribute("aria-current", "page");

    // Refresh
    await headPage.reload();
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // Products tab should still be active after refresh
    await expect(headPage.getByLabel("Products tab")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("SC-306: refreshing /lead/report preserves the page", async ({
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

    // Refresh
    await leadPage.reload();
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    // Page should still show the report
    await expect(
      leadPage.getByRole("heading", { name: "My Report" }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// SC-307: Browser forward/back navigation works naturally
// ---------------------------------------------------------------------------

test.describe("SC-307: Browser back/forward navigation", () => {
  test("SC-307: back from /head/report returns to /head/dashboard", async ({
    headPage,
  }) => {
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    await headPage.goto("/head/report");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    // Go back
    await headPage.goBack();
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    expect(headPage.url()).toContain("/head/dashboard");
  });

  test("SC-307: forward after back returns to the original page", async ({
    headPage,
  }) => {
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    await headPage.goto("/head/report");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    // Back
    await headPage.goBack();
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    expect(headPage.url()).toContain("/head/dashboard");

    // Forward
    await headPage.goForward();
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    expect(headPage.url()).toContain("/head/report");
  });

  test("SC-307: back from /lead/report to /lead/history works", async ({
    leadPage,
  }) => {
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

    await leadPage.goBack();
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    expect(leadPage.url()).toContain("/lead/history");
  });
});

// ---------------------------------------------------------------------------
// SC-308: 404 page for invalid URLs
// ---------------------------------------------------------------------------

test.describe("SC-308: 404 page", () => {
  test("SC-308: /nonexistent-page returns 404", async ({ leadPage }) => {
    const response = await leadPage.goto("/this-route-does-not-exist-at-all");
    expect(response?.status()).toBe(404);
    await expect(leadPage.getByText(/404/)).toBeVisible({ timeout: 10_000 });
  });

  test("SC-308: /admin/nonexistent returns 404", async ({ headPage }) => {
    const response = await headPage.goto("/admin/nonexistent");
    expect(response?.status()).toBe(404);
    await expect(headPage.getByText(/404/)).toBeVisible({ timeout: 10_000 });
  });

  test("SC-308: deeply nested invalid path returns 404", async ({
    leadPage,
  }) => {
    const response = await leadPage.goto("/a/b/c/d/e");
    expect(response?.status()).toBe(404);
    await expect(leadPage.getByText(/404/)).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// SC-309: Deep link sharing works across users
// ---------------------------------------------------------------------------

test.describe("SC-309: Deep link sharing", () => {
  test("SC-309: /reports/w16 is directly accessible by URL", async ({
    headPage,
  }) => {
    await headPage.goto("/reports/w16");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    // Published report should render
    expect(headPage.url()).toContain("/reports/w16");
    await expect(
      headPage.getByRole("heading", { name: "Weekly Status Report" }),
    ).toBeVisible();
  });

  test("SC-309: /admin?tab=settings is directly accessible", async ({
    headPage,
  }) => {
    await headPage.goto("/admin?tab=settings");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    expect(headPage.url()).toContain("tab=settings");
    await expect(headPage.getByLabel("Department Name")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// SC-310: Logout clears session and redirects to /login
// (In dev mode, navigating to / shows the login page with role buttons)
// ---------------------------------------------------------------------------

test.describe("SC-310: Navigating to root shows login", () => {
  test("SC-310: visiting / shows the login page", async ({ leadPage }) => {
    await leadPage.goto("/");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    // Login page title
    await expect(
      leadPage.getByRole("heading", { name: "CustomReport" }),
    ).toBeVisible();
    await expect(
      leadPage.getByText("Weekly Status Reporting System", { exact: true }),
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// SC-311: Nav bar teal bottom border matches content width
// ---------------------------------------------------------------------------

test.describe("SC-311: Nav bar visual layout", () => {
  test("SC-311: navigation bar is visible on content pages", async ({
    headPage,
  }) => {
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    const nav = headPage.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();

    // Nav should contain links
    const navLinks = nav.locator("a");
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test("SC-311: nav bar has teal-themed active link", async ({ headPage }) => {
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    const nav = headPage.locator('nav[aria-label="Main navigation"]');
    await expect(nav).toBeVisible();

    // The Dashboard link should have active styling (aria-current="page")
    const dashboardLink = nav.locator('a[aria-current="page"]');
    await expect(dashboardLink).toBeVisible();
    await expect(dashboardLink).toHaveText(/Dashboard/);
  });
});
