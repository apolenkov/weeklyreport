/**
 * Phase 61 (robust-baking-aurora) — Head mode toggle E2E tests.
 *
 * Validates the inline form ↔ slides mode toggle on /head/report/[reportId].
 * Covers plan acceptance criteria (a) and (c).
 */

import { test, expect } from "./fixtures";

test.describe("Head Report — form/slides mode toggle", () => {
  test.beforeEach(async ({ headPage }) => {
    await headPage.goto("/head/report");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 20_000 });
  });

  test("shows Edit and Slides toggle buttons", async ({ headPage }) => {
    const editLink = headPage.getByRole("link", { name: /edit/i });
    const slidesLink = headPage.getByRole("link", { name: /slides/i });
    await expect(editLink).toBeVisible();
    await expect(slidesLink).toBeVisible();
  });

  test("form mode shows weekly report content", async ({ headPage }) => {
    const report = headPage.getByTestId("weekly-report-page");
    await expect(report).toBeVisible();
  });

  test("slides mode shows slide deck after toggle", async ({ headPage }) => {
    const slidesLink = headPage.getByRole("link", { name: /slides/i });
    await slidesLink.click();
    await headPage.waitForLoadState("networkidle", { timeout: 20_000 });
    // Either a deck or an empty-state message should appear — not the weekly report
    const report = headPage.getByTestId("weekly-report-page");
    await expect(report).not.toBeVisible();
  });

  test("present sub-route still works after toggle addition", async ({
    headPage,
  }) => {
    // Navigate to the addressed head report page first to get a real reportId
    await headPage.goto("/head/report");
    await headPage.waitForLoadState("networkidle", { timeout: 20_000 });
    // The /head/report route redirects to the addressed report; grab reportId from URL
    const url = headPage.url();
    const match = url.match(/\/head\/report\/([0-9a-f-]+)/);
    if (!match) {
      // No active report — skip gracefully
      test.skip();
      return;
    }
    const reportId = match[1];
    await headPage.goto(`/head/report/${reportId}/present`);
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    // Present route is independent — should not be affected by ?mode= toggle
    await expect(headPage.locator("#main-content")).toBeVisible();
  });
});
