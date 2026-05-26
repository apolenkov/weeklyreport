/**
 * Responsive Breakpoints E2E Tests
 *
 * Verifies that pages adapt correctly across viewport sizes:
 * mobile (375px), tablet (768px), desktop (1280px), and large (1920px).
 *
 * Covers: SC-59..SC-62 (Responsive & Accessibility)
 */

import { test, expect } from "../fixtures";
import { test as base } from "@playwright/test";

// ---------------------------------------------------------------------------
// Mobile — 375 x 812  (iPhone-class)
// ---------------------------------------------------------------------------

base.describe("Responsive — Mobile 375px", () => {
  base.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
  });

  base("login page renders without left brand panel", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    // The left brand panel is hidden on mobile (lg:flex means >= 1024px)
    // On 375px it should not be visible
    const brandPanel = page.locator("main > div").first();
    // The brand panel has the green gradient background and "hidden lg:flex"
    // At 375px, the SSO sign-in should be visible without the panel
    await expect(page.getByText("Enter Application")).toBeVisible();
    await expect(page.getByText("CustomReport").first()).toBeVisible();

    // The brand panel text "Weekly Status Reporting" should be hidden at mobile
    const desktopTitle = page.locator(".hidden.lg\\:flex h1");
    await expect(desktopTitle).toHaveCount(0);
  });

  base("lead form is scrollable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/lead/report");
    await page.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    // Page should be scrollable — document height exceeds viewport height
    const docHeight = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    expect(docHeight).toBeGreaterThan(812);

    // The main content should be visible
    const main = page.locator("#main-content");
    await expect(main).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Tablet — 768 x 1024  (iPad-class)
// ---------------------------------------------------------------------------

test.describe("Responsive — Tablet 768px", () => {
  test("dashboard grid adjusts at tablet width", async ({ headPage }) => {
    await headPage.setViewportSize({ width: 768, height: 1024 });
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage
      .getByRole("heading", { name: "Dashboard" })
      .waitFor({ state: "visible", timeout: 15_000 });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // The dashboard page should be visible and render its content
    await expect(
      headPage.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
    // KPI cards should still be visible at tablet width
    await expect(headPage.getByText("Submissions")).toBeVisible();
    await expect(headPage.getByText("Deadline")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Desktop — 1280 x 800
// ---------------------------------------------------------------------------

test.describe("Responsive — Desktop 1280px", () => {
  test("full layout with content centered in max-w-6xl", async ({
    headPage,
  }) => {
    await headPage.setViewportSize({ width: 1280, height: 800 });
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage
      .getByRole("heading", { name: "Dashboard" })
      .waitFor({ state: "visible", timeout: 15_000 });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // Content wrapper should be constrained by max-w-6xl (1152px)
    const contentWrapper = headPage.locator("#main-content .max-w-6xl").first();
    const box = await contentWrapper.boundingBox();
    expect(box).toBeTruthy();
    // Width should not exceed 1152px at 1280px viewport
    expect(box!.width).toBeLessThanOrEqual(1152 + 1); // +1 for rounding
  });
});

// ---------------------------------------------------------------------------
// Large — 1920 x 1080
// ---------------------------------------------------------------------------

test.describe("Responsive — Large 1920px", () => {
  test("content max-width does not exceed 1152px", async ({ headPage }) => {
    await headPage.setViewportSize({ width: 1920, height: 1080 });
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage
      .getByRole("heading", { name: "Dashboard" })
      .waitFor({ state: "visible", timeout: 15_000 });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // At 1920px, the max-w-6xl container should cap at 1152px
    const contentWrapper = headPage.locator("#main-content .max-w-6xl").first();
    const box = await contentWrapper.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeLessThanOrEqual(1152 + 1);

    // Content should be centered (left margin roughly equal to right margin)
    const leftMargin = box!.x;
    const rightMargin = 1920 - (box!.x + box!.width);
    // Margins should be approximately equal (within 2px tolerance)
    expect(Math.abs(leftMargin - rightMargin)).toBeLessThan(2);
  });
});

// ---------------------------------------------------------------------------
// Mobile — Touch Targets
// ---------------------------------------------------------------------------

base.describe("Responsive — Touch Targets", () => {
  base("buttons and links meet 44px minimum touch target", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await page.waitForLoadState("networkidle", { timeout: 15_000 });

    // Check that the SSO button has minimum 44px height
    const ssoButton = page.getByText("Enter Application");
    await expect(ssoButton).toBeVisible();

    const box = await ssoButton.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
