/**
 * Phase 61 (robust-baking-aurora) — Head history page E2E tests.
 *
 * Validates /head/history: period navigator, archive toggle, and
 * inline form ↔ slides mode toggle across historical periods.
 * Covers plan acceptance criteria (b).
 */

import { test, expect } from "./fixtures";

test.describe("Head History Page", () => {
  test.beforeEach(async ({ headPage }) => {
    await headPage.goto("/head/history");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 20_000 });
  });

  test("renders the history toolbar with period navigator", async ({
    headPage,
  }) => {
    const nav = headPage.getByRole("group", {
      name: /period navigation/i,
    });
    await expect(nav).toBeVisible();
  });

  test("shows the archive toggle button", async ({ headPage }) => {
    const archiveBtn = headPage.getByRole("switch", {
      name: /show archived/i,
    });
    await expect(archiveBtn).toBeVisible();
    await expect(archiveBtn).toHaveAttribute("aria-checked", "false");
  });

  test("archive toggle changes aria-checked state on click", async ({
    headPage,
  }) => {
    const archiveBtn = headPage.getByRole("switch", {
      name: /show archived/i,
    });
    await archiveBtn.click();
    await expect(archiveBtn).toHaveAttribute("aria-checked", "true");
    await archiveBtn.click();
    await expect(archiveBtn).toHaveAttribute("aria-checked", "false");
  });

  test("shows Edit and Slides mode toggle links", async ({ headPage }) => {
    const editLink = headPage.getByRole("link", { name: /edit/i });
    const slidesLink = headPage.getByRole("link", { name: /slides/i });
    await expect(editLink).toBeVisible();
    await expect(slidesLink).toBeVisible();
  });

  test("form mode shows weekly report for the selected period", async ({
    headPage,
  }) => {
    const report = headPage.getByTestId("weekly-report-page");
    // If at least one published period exists, the weekly report renders
    const hasReport = await report.isVisible().catch(() => false);
    if (!hasReport) {
      // No published periods in seed — expect the empty state message
      await expect(
        headPage.getByText(/no published reports found/i),
      ).toBeVisible();
    } else {
      await expect(report).toBeVisible();
    }
  });

  test("mode=slides URL shows slides mode (no weekly report)", async ({
    headPage,
  }) => {
    // First check if we have any period to work with
    const url = headPage.url();
    const periodMatch = url.match(/[?&]period=([^&]+)/);
    if (!periodMatch) {
      test.skip();
      return;
    }
    const period = periodMatch[1];
    await headPage.goto(`/head/history?period=${period}&mode=slides`);
    await headPage.waitForLoadState("networkidle", { timeout: 20_000 });
    const report = headPage.getByTestId("weekly-report-page");
    await expect(report).not.toBeVisible();
  });

  test("head nav bar shows History link pointing to /head/history", async ({
    headPage,
  }) => {
    const historyLink = headPage
      .getByRole("navigation")
      .getByRole("link", { name: /history/i });
    await expect(historyLink).toBeVisible();
    await expect(historyLink).toHaveAttribute("href", "/head/history");
  });
});
