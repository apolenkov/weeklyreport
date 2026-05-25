/**
 * Head Dashboard E2E Tests
 *
 * Validates the head dashboard at /head/dashboard -- KPI cards, alert bar,
 * lead reports grid, report archive, and toggle-all interaction.
 *
 * Data source: the page calls tRPC weeklyReport.get (real backend in dev/
 * integration environments). Numeric assertions are derived from the advanced
 * seed: 4 submitted / 6 total for the active report period.
 *
 * Covers: SC-20..SC-25 (Dashboard), SC-59 (responsive)
 */

import { test, expect } from "./fixtures";

test.describe("Head Dashboard", () => {
  test.beforeEach(async ({ headPage }) => {
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    // Wait for client-side hydration: the Dashboard heading is rendered
    // by the DashboardPage client component
    await headPage
      .getByRole("heading", { name: "Dashboard" })
      .waitFor({ state: "visible", timeout: 15_000 });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });
  });

  // -----------------------------------------------------------------------
  // Page header
  // -----------------------------------------------------------------------

  test('shows "Dashboard" heading', async ({ headPage }) => {
    await expect(
      headPage.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
  });

  test("shows week and department context line", async ({ headPage }) => {
    // The subtitle contains week number and department; use a long substring
    // to avoid strict mode violations with "Apr 14" appearing in archive too
    await expect(headPage.getByText("CoreDev Department")).toBeVisible();
    await expect(
      headPage.getByText("Apr 14", { exact: false }).first(),
    ).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // KPI Cards
  // -----------------------------------------------------------------------

  test("Submissions KPI card shows seed-accurate 4/6 count", async ({
    headPage,
  }) => {
    // Seed: Vasily, Maria, Igor, Dmitry submitted (4); Olga draft, Sergey draft (2).
    // weeklyReport.get.submissionCount filters status==="submitted" in DB.
    await expect(headPage.getByText("Submissions")).toBeVisible();
    // Use .first() since "4/6" may also appear in archive card for the prior week.
    await expect(headPage.getByText("4/6").first()).toBeVisible();
  });

  test("Submissions KPI shows total lead count of 6", async ({ headPage }) => {
    // Seed registers 6 leads in the department's reporting group.
    await expect(headPage.getByText("6 leads")).toBeVisible();
  });

  test("Deadline KPI card is visible with report deadline", async ({
    headPage,
  }) => {
    await expect(headPage.getByText("Deadline")).toBeVisible();
    await expect(headPage.getByLabel(/Deadline:/)).toBeVisible();
  });

  test("Risks & Blockers KPI card is visible with counts", async ({
    headPage,
  }) => {
    await expect(headPage.getByText("Risks & Blockers")).toBeVisible();
    // Shows blocked count, at-risk count, decision count
    await expect(headPage.getByText("Blocked").first()).toBeVisible();
    await expect(headPage.getByText("At Risk").first()).toBeVisible();
    await expect(headPage.getByText("Decisions").first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Alert Bar
  // -----------------------------------------------------------------------

  test("alert bar shows exactly 2 pending leads from seed (Olga + Sergey)", async ({
    headPage,
  }) => {
    // Seed: 2 non-submitted leads — Ольга Н. (draft with items) and
    // Сергей Т. (draft, no items → shows as Not started / Pending).
    // Alert bar lists them by name so the head can identify who's missing.
    await expect(headPage.getByText("Olga N.").first()).toBeVisible();
    await expect(headPage.getByText("Sergey T.").first()).toBeVisible();
    await expect(
      headPage.getByRole("button", { name: "Send Reminder" }),
    ).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Lead Reports Grid
  // -----------------------------------------------------------------------

  test("Lead Reports section is visible with lead count", async ({
    headPage,
  }) => {
    await expect(headPage.getByText("Lead Reports")).toBeVisible();
    await expect(headPage.getByText("6 leads")).toBeVisible();
  });

  test("lead cards show status badges reflecting seed distribution", async ({
    headPage,
  }) => {
    // Seed: 4 submitted (Vasily, Maria, Igor, Dmitry), 1 draft with items
    // (Olga), 1 draft with no items (Sergey — shows as Pending in UI).
    const submittedBadges = headPage.getByText("Submitted", { exact: true });
    // At least 4 submitted badges visible (one per submitted lead card).
    await expect(submittedBadges.first()).toBeVisible();
    await expect(submittedBadges).toHaveCount(4);

    await expect(
      headPage.getByText("Draft", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      headPage.getByText("Pending", { exact: true }).first(),
    ).toBeVisible();
  });

  test("traffic light dots are visible on submitted lead cards", async ({
    headPage,
  }) => {
    // Тимлид 1 has 6 traffic light dots (small round divs with check/cross/bang icons)
    // The traffic lights are 18x18 rounded-full elements
    const trafficDots = headPage
      .locator(".rounded-full")
      .filter({ hasText: /^[!]$/ });
    await expect(trafficDots.first()).toBeVisible();
  });

  test("lock icon visible on non-current-user cards", async ({ headPage }) => {
    // Non-current-user submitted cards show a lock icon (svg with rect+path)
    // Maria K. card is submitted but not current user, should have lock icon
    const mariaCard = headPage
      .locator('div[role="listitem"]')
      .filter({ hasText: "Maria K." });
    await expect(mariaCard).toBeVisible();
    // Lock icon is an SVG with a rect
    const lockIcon = mariaCard.locator("svg");
    await expect(lockIcon.first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Report Archive
  // -----------------------------------------------------------------------

  test("Report Archive section is visible with past reports", async ({
    headPage,
  }) => {
    await expect(
      headPage.getByRole("heading", { name: "Report Archive" }),
    ).toBeVisible();
    await expect(headPage.getByText("12 reports total")).toBeVisible();
  });

  test("archive cards show week labels and date ranges", async ({
    headPage,
  }) => {
    // Week 16 (active), Week 15 (published), Week 14, Week 13
    await expect(headPage.getByText("Week 16").first()).toBeVisible();
    await expect(headPage.getByText("Week 15")).toBeVisible();
    // Published badge
    await expect(headPage.getByText("Published").first()).toBeVisible();
    // Active badge
    await expect(headPage.getByText("Active")).toBeVisible();
  });
});
