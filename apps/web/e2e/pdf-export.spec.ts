/**
 * PDF Export / Print Page E2E Tests
 *
 * Validates the print-optimized report page at /reports/[reportId]/print.
 * This is a server-rendered page with inline styles (no client components).
 * Tests verify that the PDF template renders correctly with mock data.
 *
 * Covers: PDF export rendering, company header, portfolio table
 */

import { test, expect } from './fixtures';

test.describe('Print Report Page', () => {
  test.beforeEach(async ({ headPage }) => {
    // Navigate to the print page for the active report (w16)
    await headPage.goto('/reports/w16/print');
    // The print page has no #main-content id — wait for the heading instead
    await headPage.getByRole('heading', { name: 'Core Development' }).waitFor({ state: 'visible', timeout: 15_000 });
  });

  test('print page renders with report content', async ({ headPage }) => {
    // The page should have the main heading
    await expect(
      headPage.getByRole('heading', { name: 'Core Development' }),
    ).toBeVisible();
    // Should show the week and submission summary
    await expect(headPage.getByText('Week 16')).toBeVisible();
  });

  test('print page has company header with submission count', async ({ headPage }) => {
    // Header shows "Core Development - Weekly Status Report"
    await expect(
      headPage.getByText('Core Development'),
    ).toBeVisible();
    // Submission summary in header: "4/6 leads submitted"
    await expect(headPage.getByText('4/6 leads submitted')).toBeVisible();
  });

  test('print page has portfolio overview table', async ({ headPage }) => {
    // Portfolio Overview heading
    await expect(
      headPage.getByRole('heading', { name: 'Portfolio Overview' }),
    ).toBeVisible();
    // Table should have product names
    await expect(headPage.getByText('CRM Platform').first()).toBeVisible();
    await expect(headPage.getByText('Data Analytics Suite').first()).toBeVisible();
    // Table headers
    await expect(headPage.getByText('Product').first()).toBeVisible();
    await expect(headPage.getByText('Status').first()).toBeVisible();
  });
});
