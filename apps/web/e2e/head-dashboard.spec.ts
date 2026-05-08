/**
 * Head Dashboard E2E Tests
 *
 * Validates the head dashboard at /head/dashboard -- KPI cards, alert bar,
 * lead reports grid, report archive, and toggle-all interaction.
 * All data is currently mock; tests verify UI rendering and interactions.
 *
 * Covers: SC-20..SC-25 (Dashboard), SC-59 (responsive)
 */

import { test, expect } from './fixtures';

test.describe('Head Dashboard', () => {
  test.beforeEach(async ({ headPage }) => {
    await headPage.goto('/head/dashboard');
    await headPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    // Wait for client-side hydration: the Dashboard heading is rendered
    // by the DashboardPage client component
    await headPage.getByRole('heading', { name: 'Dashboard' }).waitFor({ state: 'visible', timeout: 15_000 });
    await headPage.waitForLoadState('networkidle', { timeout: 15_000 });
  });

  // -----------------------------------------------------------------------
  // Page header
  // -----------------------------------------------------------------------

  test('shows "Dashboard" heading', async ({ headPage }) => {
    await expect(headPage.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('shows week and department context line', async ({ headPage }) => {
    // The subtitle contains week number and department; use a long substring
    // to avoid strict mode violations with "Apr 14" appearing in archive too
    await expect(headPage.getByText('Development Department')).toBeVisible();
    await expect(headPage.getByText('Apr 14', { exact: false }).first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // KPI Cards
  // -----------------------------------------------------------------------

  test('Submissions KPI card is visible with count', async ({ headPage }) => {
    await expect(headPage.getByText('Submissions')).toBeVisible();
    // Shows 4/6 from mock data -- use .first() since 4/6 also appears in archive card
    await expect(headPage.getByText('4/6').first()).toBeVisible();
  });

  test('Deadline KPI card is visible with report deadline', async ({ headPage }) => {
    await expect(headPage.getByText('Deadline')).toBeVisible();
    await expect(headPage.getByLabel(/Deadline:/)).toBeVisible();
  });

  test('Risks & Blockers KPI card is visible with counts', async ({ headPage }) => {
    await expect(headPage.getByText('Risks & Blockers')).toBeVisible();
    // Shows blocked count, at-risk count, decision count
    await expect(headPage.getByText('Blocked').first()).toBeVisible();
    await expect(headPage.getByText('At Risk').first()).toBeVisible();
    await expect(headPage.getByText('Decisions').first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Alert Bar
  // -----------------------------------------------------------------------

  test('alert bar shows pending leads message', async ({ headPage }) => {
    // Alert bar text: "Olga N. (Draft) and Sergey T. (Not started) haven't submitted"
    // Use the full container text to avoid strict mode violations
    await expect(headPage.getByText('Olga N.').first()).toBeVisible();
    await expect(headPage.getByText('Sergey T.').first()).toBeVisible();
    await expect(headPage.getByRole('button', { name: 'Send Reminder' })).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Lead Reports Grid
  // -----------------------------------------------------------------------

  test('Lead Reports section is visible with lead count', async ({ headPage }) => {
    await expect(headPage.getByText('Lead Reports')).toBeVisible();
    await expect(headPage.getByText('6 leads')).toBeVisible();
  });

  test('lead cards show status badges', async ({ headPage }) => {
    // 4 submitted, 1 draft, 1 pending from mock data
    const submittedBadges = headPage.getByText('Submitted', { exact: true });
    await expect(submittedBadges.first()).toBeVisible();
    await expect(headPage.getByText('Draft', { exact: true }).first()).toBeVisible();
    await expect(headPage.getByText('Pending', { exact: true }).first()).toBeVisible();
  });

  test('traffic light dots are visible on submitted lead cards', async ({ headPage }) => {
    // Тимлид 1 has 6 traffic light dots (small round divs with check/cross/bang icons)
    // The traffic lights are 18x18 rounded-full elements
    const trafficDots = headPage.locator('.rounded-full').filter({ hasText: /^[!]$/ });
    await expect(trafficDots.first()).toBeVisible();
  });

  test('lock icon visible on non-current-user cards', async ({ headPage }) => {
    // Non-current-user submitted cards show a lock icon (svg with rect+path)
    // Maria K. card is submitted but not current user, should have lock icon
    const mariaCard = headPage.locator('div[role="listitem"]').filter({ hasText: 'Maria K.' });
    await expect(mariaCard).toBeVisible();
    // Lock icon is an SVG with a rect
    const lockIcon = mariaCard.locator('svg');
    await expect(lockIcon.first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Report Archive
  // -----------------------------------------------------------------------

  test('Report Archive section is visible with past reports', async ({ headPage }) => {
    await expect(headPage.getByRole('heading', { name: 'Report Archive' })).toBeVisible();
    await expect(headPage.getByText('12 reports total')).toBeVisible();
  });

  test('archive cards show week labels and date ranges', async ({ headPage }) => {
    // Week 16 (active), Week 15 (published), Week 14, Week 13
    await expect(headPage.getByText('Week 16').first()).toBeVisible();
    await expect(headPage.getByText('Week 15')).toBeVisible();
    // Published badge
    await expect(headPage.getByText('Published').first()).toBeVisible();
    // Active badge
    await expect(headPage.getByText('Active')).toBeVisible();
  });
});
