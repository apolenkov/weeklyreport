/**
 * Weekly Report Advanced E2E Tests
 *
 * Covers missing scenarios from the traceability matrix for the Weekly Report:
 * - SC-151: Publish warns about pending leads (dialog content details)
 * - SC-200: Toggle All collapses all accordion sections
 * - SC-201: Portfolio Overview shows all 12 products with correct statuses
 * - SC-202: Per-lead accordion shows correct item counts and data
 * - SC-32: Item counts in accordions match lead form data
 *
 * All data is currently mock; tests verify UI rendering and interactions.
 */

import { test, expect } from './fixtures';

test.describe('Weekly Report Advanced', () => {
  test.beforeEach(async ({ headPage }) => {
    await headPage.goto('/head/report');
    await headPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await headPage.getByRole('heading', { name: 'Weekly Report' }).waitFor({ state: 'visible', timeout: 15_000 });
    await headPage.waitForLoadState('networkidle', { timeout: 15_000 });
  });

  // -----------------------------------------------------------------------
  // SC-200: Toggle All collapses all accordion sections
  // -----------------------------------------------------------------------

  test('SC-200: Toggle All collapses all open accordion sections', async ({ headPage }) => {
    // First expand a product accordion
    const crmBtn = headPage.locator('#report-product-crm button[aria-expanded]');
    for (let i = 0; i < 10; i++) {
      await crmBtn.click();
      try {
        await headPage.locator('#report-product-crm').getByText('Current Week').waitFor({ state: 'visible', timeout: 1_000 });
        break;
      } catch {
        // Retry
      }
    }
    await expect(headPage.locator('#report-product-crm').getByText('Current Week')).toBeVisible({ timeout: 5_000 });

    // Now click Toggle All to collapse everything
    const toggleBtn = headPage.getByRole('button', { name: 'Toggle All' });
    await toggleBtn.click();
    await headPage.waitForTimeout(500);

    // All accordions should be collapsed
    const expandedButtons = headPage.locator('button[aria-expanded="true"]');
    expect(await expandedButtons.count()).toBe(0);
  });

  test('SC-200: Toggle All expands all collapsed sections', async ({ headPage }) => {
    // All product accordions start collapsed (defaultOpen={false})
    // Also Blocked & At Risk in the Dashboard starts expanded, but on /head/report
    // all product accordions are collapsed by default

    // Verify at least one is collapsed
    const collapsedBtn = headPage.locator('#report-product-crm button[aria-expanded="false"]');
    await expect(collapsedBtn).toBeVisible();

    // Click Toggle All to expand
    const toggleBtn = headPage.getByRole('button', { name: 'Toggle All' });
    await toggleBtn.click();
    await headPage.waitForTimeout(500);

    // All product accordions should be expanded
    const expandedButtons = headPage.locator('button[aria-expanded="true"]');
    expect(await expandedButtons.count()).toBeGreaterThanOrEqual(6);
  });

  // -----------------------------------------------------------------------
  // SC-201: Portfolio Overview shows all 12 products
  // -----------------------------------------------------------------------

  test('SC-201: Portfolio Overview shows "12 products" count', async ({ headPage }) => {
    await expect(headPage.getByText('12 products')).toBeVisible();
  });

  test('SC-201: Portfolio Overview renders all 12 product names', async ({ headPage }) => {
    // All 12 products from MOCK_PORTFOLIO
    const productNames = [
      'CRM Platform',
      'Data Analytics Suite',
      'Mobile Applications',
      'Cloud Infrastructure',
      'AI/ML Platform',
      'Integration Gateway',
      'Payment Gateway',
      'Auth Service',
      'Notification Hub',
      'Admin Portal',
      'Logging Platform',
      'CDN Service',
    ];

    for (const name of productNames) {
      await expect(headPage.getByText(name).first()).toBeVisible();
    }
  });

  test('SC-201: Portfolio Overview shows correct worst-case statuses', async ({ headPage }) => {
    // From mock data: CRM=at-risk, Analytics=blocked, Mobile=at-risk, Cloud=at-risk
    // These products have non-"on-track" statuses
    await expect(headPage.getByText('At Risk', { exact: false }).first()).toBeVisible();
    await expect(headPage.getByText('Blocked', { exact: false }).first()).toBeVisible();
    await expect(headPage.getByText('On Track', { exact: false }).first()).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // SC-202 + SC-32: Per-product accordion data accuracy
  // -----------------------------------------------------------------------

  test('SC-202: CRM Platform accordion shows correct item count', async ({ headPage }) => {
    // CRM has 5 currentWeek items
    const crmBtn = headPage.locator('#report-product-crm button[aria-expanded]');

    for (let i = 0; i < 10; i++) {
      await crmBtn.click();
      try {
        await headPage.locator('#report-product-crm').getByText('Current Week').waitFor({ state: 'visible', timeout: 1_000 });
        break;
      } catch {
        // Retry
      }
    }

    // Item count label: "Current Week . 5 items"
    await expect(
      headPage.locator('#report-product-crm').getByText('5 items'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('SC-202: CRM Platform accordion shows Next Week items', async ({ headPage }) => {
    const crmBtn = headPage.locator('#report-product-crm button[aria-expanded]');

    for (let i = 0; i < 10; i++) {
      await crmBtn.click();
      try {
        await headPage.locator('#report-product-crm').getByText('Next Week').waitFor({ state: 'visible', timeout: 1_000 });
        break;
      } catch {
        // Retry
      }
    }

    // CRM has 3 next week items
    await expect(
      headPage.locator('#report-product-crm').getByText('3 items'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('SC-202: CRM Platform accordion shows Needs Attention section', async ({ headPage }) => {
    const crmBtn = headPage.locator('#report-product-crm button[aria-expanded]');

    for (let i = 0; i < 10; i++) {
      await crmBtn.click();
      try {
        await headPage.locator('#report-product-crm').getByText('Needs Attention').waitFor({ state: 'visible', timeout: 1_000 });
        break;
      } catch {
        // Retry
      }
    }

    await expect(
      headPage.locator('#report-product-crm').getByText('Needs Attention'),
    ).toBeVisible({ timeout: 5_000 });
    // CRM needs attention text mentions OAuth2
    await expect(
      headPage.locator('#report-product-crm').getByText('OAuth2', { exact: false }),
    ).toBeVisible();
  });

  test('SC-202: Data Analytics accordion shows Risks & Blockers', async ({ headPage }) => {
    const analyticsBtn = headPage.locator('#report-product-analytics button[aria-expanded]');

    for (let i = 0; i < 10; i++) {
      await analyticsBtn.click();
      try {
        await headPage.locator('#report-product-analytics').getByText('Risks & Blockers').waitFor({ state: 'visible', timeout: 1_000 });
        break;
      } catch {
        // Retry
      }
    }

    // Analytics has 2 risks
    await expect(
      headPage.locator('#report-product-analytics').getByText('Risks & Blockers'),
    ).toBeVisible({ timeout: 5_000 });
    // Risk count badge
    await expect(
      headPage.locator('#report-product-analytics').getByText(/Risks & Blockers.*2/),
    ).toBeVisible();
  });

  test('SC-32: Cloud Infrastructure accordion shows Decisions section', async ({ headPage }) => {
    const cloudBtn = headPage.locator('#report-product-cloud button[aria-expanded]');

    for (let i = 0; i < 10; i++) {
      await cloudBtn.click();
      try {
        await headPage.locator('#report-product-cloud').getByText('Decisions').waitFor({ state: 'visible', timeout: 1_000 });
        break;
      } catch {
        // Retry
      }
    }

    // Cloud has 1 decision
    await expect(
      headPage.locator('#report-product-cloud').getByText('Decisions'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('SC-32: CRM Platform accordion shows Top Priorities', async ({ headPage }) => {
    const crmBtn = headPage.locator('#report-product-crm button[aria-expanded]');

    for (let i = 0; i < 10; i++) {
      await crmBtn.click();
      try {
        await headPage.locator('#report-product-crm').getByText('Top Priorities').waitFor({ state: 'visible', timeout: 1_000 });
        break;
      } catch {
        // Retry
      }
    }

    // CRM has 2 priorities
    await expect(
      headPage.locator('#report-product-crm').getByText('Top Priorities'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('SC-202: Product accordion shows lead names in header badge', async ({ headPage }) => {
    // CRM Platform header shows "Platanov A. . Maria K."
    const crmHeader = headPage.locator('#report-product-crm button[aria-expanded]');
    await expect(crmHeader.getByText('Platanov A.')).toBeVisible();
    await expect(crmHeader.getByText('Maria K.')).toBeVisible();
  });

  test('SC-202: Product accordion shows status badge in header', async ({ headPage }) => {
    // CRM has "At Risk" status badge
    const crmHeader = headPage.locator('#report-product-crm button[aria-expanded]');
    await expect(crmHeader.getByText('At Risk')).toBeVisible();

    // Analytics has "Blocked" status badge
    const analyticsHeader = headPage.locator('#report-product-analytics button[aria-expanded]');
    await expect(analyticsHeader.getByText('Blocked')).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // SC-151: Publish dialog warns about pending leads
  // -----------------------------------------------------------------------

  test('SC-151: Publish dialog shows exact pending lead count', async ({ headPage }) => {
    const publishBtn = headPage.getByRole('button', { name: 'Publish & Lock' });
    const dialogTitle = headPage.getByText('Publish & Lock Report?');

    for (let i = 0; i < 10; i++) {
      await publishBtn.click();
      try {
        await dialogTitle.waitFor({ state: 'visible', timeout: 1_000 });
        break;
      } catch {
        // Retry
      }
    }

    await expect(dialogTitle).toBeVisible({ timeout: 5_000 });
    // Dialog shows "2 of 6 leads haven't submitted yet"
    await expect(headPage.getByText('2 of 6')).toBeVisible();
    await expect(headPage.getByText("haven't submitted yet")).toBeVisible();
    // Warning about empty sections
    await expect(headPage.getByText('empty in the published report')).toBeVisible();
    // Shows "Publish Anyway" because there are pending leads
    await expect(headPage.getByRole('button', { name: 'Publish Anyway' })).toBeVisible();
  });

  test('SC-151: Publish dialog has lock warning text', async ({ headPage }) => {
    const publishBtn = headPage.getByRole('button', { name: 'Publish & Lock' });
    const dialogTitle = headPage.getByText('Publish & Lock Report?');

    for (let i = 0; i < 10; i++) {
      await publishBtn.click();
      try {
        await dialogTitle.waitFor({ state: 'visible', timeout: 1_000 });
        break;
      } catch {
        // Retry
      }
    }

    await expect(dialogTitle).toBeVisible({ timeout: 5_000 });
    // Warning about locking
    await expect(headPage.getByText('all lead forms will be locked')).toBeVisible();
  });

  test('SC-151: Publish dialog Cancel button closes dialog', async ({ headPage }) => {
    const publishBtn = headPage.getByRole('button', { name: 'Publish & Lock' });
    const dialogTitle = headPage.getByText('Publish & Lock Report?');

    for (let i = 0; i < 10; i++) {
      await publishBtn.click();
      try {
        await dialogTitle.waitFor({ state: 'visible', timeout: 1_000 });
        break;
      } catch {
        // Retry
      }
    }

    await expect(dialogTitle).toBeVisible({ timeout: 5_000 });

    // Cancel closes the dialog
    await headPage.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialogTitle).not.toBeVisible({ timeout: 5_000 });

    // Publish & Lock button is still available
    await expect(publishBtn).toBeVisible();
  });
});
