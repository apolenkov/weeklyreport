/**
 * Lead History E2E Tests
 *
 * Validates the lead history page at /lead/history — rendering of
 * past submission cards, traffic light indicators, and navigation.
 * All data is currently mock.
 *
 * Covers: SC-01..SC-04 (History subset)
 */

import { test, expect } from "./fixtures";

test.describe("Lead History Page", () => {
  test.beforeEach(async ({ leadPage }) => {
    await leadPage.goto("/lead/history");
    await leadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
  });

  test('shows "My History" heading', async ({ leadPage }) => {
    await expect(
      leadPage.getByRole("heading", { name: "My History" }),
    ).toBeVisible();
    // Subtitle with submission count
    await expect(leadPage.getByText("past submissions")).toBeVisible();
  });

  test("history cards are visible", async ({ leadPage }) => {
    // There are 6 mock history entries rendered as link cards
    const cards = leadPage.locator('a[href*="/lead/report?period="]');
    await expect(cards).toHaveCount(6);
  });

  test("each card shows period dates and status", async ({ leadPage }) => {
    // First card: Week 15, Apr 7–13, 2026
    await expect(leadPage.getByText("Week 15")).toBeVisible();
    await expect(leadPage.getByText("Apr 7–13, 2026")).toBeVisible();

    // All cards show Submitted badge
    const submittedBadges = leadPage.getByText("Submitted", { exact: true });
    // There are 6 submitted entries
    await expect(submittedBadges).toHaveCount(6);
  });

  test("traffic light dots are visible on cards", async ({ leadPage }) => {
    // Traffic dots are small colored circles (14x14 px rounded-full)
    // The first card (Week 15) has 5 green + 1 yellow = 6 dots
    const trafficDots = leadPage.locator("span.rounded-full").first();
    await expect(trafficDots).toBeVisible();

    // Verify multiple dots exist across all cards
    const allDots = leadPage.locator("span.rounded-full");
    // Total dots: h1(5+1) + h2(4+1+1) + h3(5) + h4(3+2) + h5(4+1) + h6(5) = 32
    const count = await allDots.count();
    expect(count).toBeGreaterThanOrEqual(20);
  });
});
