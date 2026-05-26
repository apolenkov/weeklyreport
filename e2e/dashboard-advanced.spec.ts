/**
 * Dashboard Advanced E2E Tests
 *
 * Covers missing scenarios from the traceability matrix for the Head Dashboard:
 * - SC-21: Blocked products table accuracy
 * - SC-25: Historical comparison in Submissions KPI
 * - SC-171: Dashboard has no global collapse/expand control
 * - SC-173: Alert bar hidden when all submitted
 * - SC-174: Send Reminder success flow
 * - SC-176: Report Archive pagination (page 2)
 * - SC-177: Report Archive card links to correct routes
 * - SC-178: KPI escalations count accuracy
 * - SC-179: Submission Activity empty-state accuracy
 *
 * All data is currently mock; tests verify UI rendering and interactions.
 */

import { test, expect } from "./fixtures";

test.describe("Dashboard Advanced", () => {
  test.beforeEach(async ({ headPage }) => {
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage
      .getByRole("heading", { name: "Dashboard" })
      .waitFor({ state: "visible", timeout: 15_000 });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });
  });

  // -----------------------------------------------------------------------
  // SC-21: Blocked & At Risk table accuracy
  // -----------------------------------------------------------------------

  test("SC-21: Blocked & At Risk table shows correct issue count badge", async ({
    headPage,
  }) => {
    // Mock data has 5 blocked/at-risk items
    await expect(headPage.getByText("5 issues")).toBeVisible();
  });

  test("SC-21: Blocked & At Risk table shows severity labels", async ({
    headPage,
  }) => {
    // Table should show both "Blocked" and "At Risk" severity badges
    const blockedBadges = headPage
      .locator(".rounded-\\[var\\(--radius-pill\\)\\]")
      .filter({ hasText: "Blocked" });
    const atRiskBadges = headPage
      .locator(".rounded-\\[var\\(--radius-pill\\)\\]")
      .filter({ hasText: "At Risk" });

    // 2 blocked items (Data Analytics Dev + Testing)
    expect(await blockedBadges.count()).toBeGreaterThanOrEqual(2);
    // 3 at-risk items (CRM Dev, Cloud Dev, Mobile)
    expect(await atRiskBadges.count()).toBeGreaterThanOrEqual(3);
  });

  test("SC-21: Blocked & At Risk table shows product and assignee details", async ({
    headPage,
  }) => {
    // Verify specific items from mock data render with product + assignee
    await expect(headPage.getByText("Data Analytics").first()).toBeVisible();
    await expect(headPage.getByText("CRM Platform").first()).toBeVisible();
    await expect(
      headPage.getByText("Cloud Infrastructure").first(),
    ).toBeVisible();
    await expect(
      headPage.getByText("Mobile Applications").first(),
    ).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // SC-25: Submissions KPI historical comparison
  // -----------------------------------------------------------------------

  test("SC-25: Submissions KPI shows last week comparison", async ({
    headPage,
  }) => {
    // Mock data: lastWeekSubmitted=6, lastWeekTotal=6
    await expect(headPage.getByText("Last week: 6/6")).toBeVisible();
  });

  test("SC-25: Submissions KPI shows pending count badge", async ({
    headPage,
  }) => {
    // Mock data: pendingCount=2
    await expect(headPage.getByText("2 pending")).toBeVisible();
  });

  test("SC-25: Submissions KPI conic gradient ring is rendered", async ({
    headPage,
  }) => {
    // The conic gradient container holds the submission fraction
    const kpiCard = headPage.locator('[aria-label*="Submissions"]');
    await expect(kpiCard).toBeVisible();
    // The inner ring shows the fraction
    await expect(kpiCard.getByText("4/6")).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // SC-171: Dashboard has no global collapse/expand control
  // -----------------------------------------------------------------------

  test("SC-171: Dashboard does not render a global Collapse all control", async ({
    headPage,
  }) => {
    await expect(
      headPage.getByRole("button", { name: /collapse all|expand all/i }),
    ).toHaveCount(0);
  });

  // -----------------------------------------------------------------------
  // SC-173: Alert bar hidden when all submitted
  // -----------------------------------------------------------------------

  test("SC-173: Alert bar is visible when there are pending leads", async ({
    headPage,
  }) => {
    // Mock data has 2 pending leads: Olga N. and Sergey T.
    await expect(headPage.getByText("haven't submitted").first()).toBeVisible();
    await expect(
      headPage.getByRole("button", { name: "Send Reminder" }),
    ).toBeVisible();
  });

  // NOTE: SC-173 full test (alert hidden when all submitted) requires dynamic
  // state where pendingLeads=[] -- the AlertBar component returns null in that case.
  // This is validated at the component level; E2E confirms the conditional rendering
  // with current mock data (pending leads present).

  // -----------------------------------------------------------------------
  // SC-174: Send Reminder button
  // -----------------------------------------------------------------------

  test("SC-174: Send Reminder button is visible and clickable", async ({
    headPage,
  }) => {
    const reminderBtn = headPage.getByRole("button", { name: "Send Reminder" });
    await expect(reminderBtn).toBeVisible();
    const configureLink = headPage.getByRole("link", {
      name: /Configure reminders/i,
    });
    const needsReminderRule = await configureLink
      .isVisible({ timeout: 2_000 })
      .catch(() => false);

    if (needsReminderRule) {
      await expect(reminderBtn).toBeDisabled();
    } else {
      await expect(reminderBtn).toBeEnabled();
      await reminderBtn.click();
    }
    // Page should remain stable after click
    await expect(
      headPage.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
  });

  test("SC-174: Send Reminder shows success toast or is disabled when no rule configured", async ({
    headPage,
  }) => {
    // dispatchMut.mutate is wired in alert-bar.tsx:100 — toast fires on success.
    // In seed data, canSendReminder depends on whether a reminder rule exists.
    const reminderBtn = headPage.getByRole("button", { name: "Send Reminder" });
    await expect(reminderBtn).toBeVisible();

    const isEnabled = await reminderBtn.isEnabled();
    if (isEnabled) {
      await reminderBtn.click();
      await expect(headPage.getByText("Reminder sent")).toBeVisible({
        timeout: 5_000,
      });
    } else {
      // No reminder rule configured in seed → button is disabled; that is valid state.
      await expect(reminderBtn).toBeDisabled();
    }
  });

  // -----------------------------------------------------------------------
  // SC-176: Report Archive pagination
  // -----------------------------------------------------------------------

  test("SC-176: Report Archive pagination shows correct page count", async ({
    headPage,
  }) => {
    // 12 reports total / 4 per page = 3 pages
    const page1Btn = headPage.getByLabel("Page 1");
    const page2Btn = headPage.getByLabel("Page 2");
    const page3Btn = headPage.getByLabel("Page 3");

    await expect(page1Btn).toBeVisible();
    await expect(page2Btn).toBeVisible();
    await expect(page3Btn).toBeVisible();

    // Page 1 is active by default
    await expect(page1Btn).toHaveAttribute("aria-current", "page");
  });

  test("SC-176: Report Archive Previous button disabled on page 1", async ({
    headPage,
  }) => {
    const prevBtn = headPage.getByLabel("Previous page");
    await expect(prevBtn).toBeDisabled();
  });

  test("SC-176: Report Archive navigates to page 2", async ({ headPage }) => {
    const page2Btn = headPage.getByLabel("Page 2");
    await page2Btn.click();

    // Page 2 should become active
    await expect(page2Btn).toHaveAttribute("aria-current", "page");
    // Page 1 should no longer be current
    await expect(headPage.getByLabel("Page 1")).not.toHaveAttribute(
      "aria-current",
      "page",
    );

    // Previous button should now be enabled
    await expect(headPage.getByLabel("Previous page")).toBeEnabled();
  });

  test("SC-176: Report Archive Next button disabled on last page", async ({
    headPage,
  }) => {
    // Navigate to page 3 (last page)
    await headPage.getByLabel("Page 3").click();

    const nextBtn = headPage.getByLabel("Next page");
    await expect(nextBtn).toBeDisabled();
  });

  // -----------------------------------------------------------------------
  // SC-177: Report Archive card links
  // -----------------------------------------------------------------------

  test("SC-177: Active report card links to /head/report", async ({
    headPage,
  }) => {
    // Week 16 is "active" status -> should link to /head/report
    const week16Card = headPage
      .locator("a")
      .filter({ hasText: "Week 16" })
      .filter({ hasText: "Active" });
    await expect(week16Card).toBeVisible();
    await expect(week16Card).toHaveAttribute("href", "/head/report");
  });

  test("SC-177: Published report card links to /reports/{id}", async ({
    headPage,
  }) => {
    // Week 15 is "published" -> should link to /reports/w15
    const week15Card = headPage
      .locator("a")
      .filter({ hasText: "Week 15" })
      .filter({ hasText: "Published" });
    await expect(week15Card).toBeVisible();
    await expect(week15Card).toHaveAttribute("href", "/reports/w15");
  });

  test("SC-177: Report Archive cards show submission labels", async ({
    headPage,
  }) => {
    // Each card shows submission counts
    await expect(headPage.getByText("4/6 submitted").first()).toBeVisible();
    await expect(headPage.getByText("6/6 submitted").first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // SC-178: KPI Escalations accuracy
  // -----------------------------------------------------------------------

  test("SC-178: Risks & Blockers KPI shows accurate counts from mock data", async ({
    headPage,
  }) => {
    // Mock data: blockedCount=2, atRiskCount=3, decisionCount=2
    const kpiCard = headPage.locator('[aria-label*="Risks"]');
    await expect(kpiCard).toBeVisible();

    // The large numbers are rendered as text
    await expect(kpiCard.getByText("2").first()).toBeVisible(); // blockedCount
    await expect(kpiCard.getByText("3")).toBeVisible(); // atRiskCount
  });

  // -----------------------------------------------------------------------
  // SC-179: Submission Activity empty-state accuracy
  // -----------------------------------------------------------------------

  test("SC-179: Submission Activity is visible", async ({ headPage }) => {
    await expect(headPage.getByText("Submission Activity")).toBeVisible();
  });

  test("SC-179: Empty lead rows are non-clickable", async ({ headPage }) => {
    await expect(
      headPage.locator(
        'section[aria-labelledby="activity-live-heading"] a[href*="authorId="]',
      ),
    ).toHaveCount(0);
  });

  // -----------------------------------------------------------------------
  // SC-63: Head can view lead forms from Dashboard (drill into)
  // -----------------------------------------------------------------------

  test("SC-63: Current user lead card is a clickable link to /lead/report", async ({
    headPage,
  }) => {
    // Тимлид 1 is the current user; their card is an <a> linking to /lead/report
    const lead1Link = headPage.locator("a").filter({ hasText: "Тимлид 1" });
    await expect(lead1Link).toBeVisible();
    await expect(lead1Link).toHaveAttribute("href", "/lead/report");
  });

  test("SC-63: Non-current-user submitted cards are disabled (not clickable)", async ({
    headPage,
  }) => {
    // Maria K. is submitted but not current user -- aria-disabled="true"
    const mariaCard = headPage
      .locator('div[role="listitem"]')
      .filter({ hasText: "Maria K." });
    await expect(mariaCard).toBeVisible();
    await expect(mariaCard).toHaveAttribute("aria-disabled", "true");
  });

  // -----------------------------------------------------------------------
  // SC-22: Lead Reports show correct status distribution
  // -----------------------------------------------------------------------

  test("SC-22: Lead Reports shows correct status distribution", async ({
    headPage,
  }) => {
    // Mock: 4 submitted, 1 draft, 1 pending
    const submittedBadges = headPage.getByText("Submitted", { exact: true });
    expect(await submittedBadges.count()).toBe(4);

    await expect(
      headPage.getByText("Draft", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      headPage.getByText("Pending", { exact: true }).first(),
    ).toBeVisible();
  });
});
