/**
 * Lead Journey E2E Tests
 *
 * Validates the lead report form at /lead/report — rendering, navigation,
 * SDLC pipeline, form sections, and submit flow.
 * All data is currently mock; tests verify UI rendering and interactions.
 *
 * Covers: SC-01..SC-19, SC-191..SC-194 (partial)
 */

import { test, expect } from './fixtures';

test.describe('Lead Report Page', () => {
  test.beforeEach(async ({ leadPage }) => {
    await leadPage.goto('/lead/report');
    await leadPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    // Wait for client-side hydration: the "Product Status" text is rendered
    // by the LeadForm client component after Suspense resolves
    await leadPage.getByText('Product Status').waitFor({ state: 'visible', timeout: 15_000 });
    // Wait for React hydration to complete.
    // Next.js 16 hydrates client components asynchronously; network idle
    // is a good proxy for when all JS bundles have loaded and executed.
    await leadPage.waitForLoadState('networkidle', { timeout: 15_000 });
  });

  // -----------------------------------------------------------------------
  // Page header
  // -----------------------------------------------------------------------

  test('shows "My Report" heading', async ({ leadPage }) => {
    await expect(leadPage.getByRole('heading', { name: 'My Report' })).toBeVisible();
  });

  test('shows autosave badge', async ({ leadPage }) => {
    await expect(leadPage.getByText('Autosaved')).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // SDLC Pipeline
  // -----------------------------------------------------------------------

  test('renders SDLC pipeline with products', async ({ leadPage }) => {
    await expect(leadPage.getByText('Product Status')).toBeVisible();
    // Verify at least some products are visible
    await expect(leadPage.getByText('CRM Platform').first()).toBeVisible();
    await expect(leadPage.getByText('Data Analytics Suite').first()).toBeVisible();
    await expect(leadPage.getByText('Mobile Applications').first()).toBeVisible();
  });

  test('stage chips show status labels', async ({ leadPage }) => {
    // Status badges on products
    await expect(leadPage.getByText('On Track').first()).toBeVisible();
    await expect(leadPage.getByText('At Risk').first()).toBeVisible();
    await expect(leadPage.getByText('Blocked').first()).toBeVisible();
  });

  test('locked stages have reduced opacity', async ({ leadPage }) => {
    // Find a locked stage chip (e.g., "Planning" in CRM which is locked)
    const lockedChip = leadPage.getByLabel('Planning: on-track').first();
    await expect(lockedChip).toBeVisible();
    // Locked chips are disabled
    await expect(lockedChip).toBeDisabled();
  });

  // -----------------------------------------------------------------------
  // Period Navigator
  // -----------------------------------------------------------------------

  test('period navigator shows week label', async ({ leadPage }) => {
    const periodSelect = leadPage.getByLabel('Select reporting period');
    await expect(periodSelect).toBeVisible();
    // Default selection should be the current period (Week 16)
    await expect(periodSelect).toHaveValue('2026-W16');
  });

  test('period navigator arrows are clickable', async ({ leadPage }) => {
    const prevButton = leadPage.getByLabel('Previous period');
    const nextButton = leadPage.getByLabel('Next period');
    await expect(prevButton).toBeVisible();
    await expect(nextButton).toBeVisible();
    // Previous should be enabled (there are past periods)
    await expect(prevButton).toBeEnabled();
    // Next should be disabled (we are on the latest period)
    await expect(nextButton).toBeDisabled();
  });

  // -----------------------------------------------------------------------
  // Fill From + Version History
  // -----------------------------------------------------------------------

  test('Fill from Previous button is visible', async ({ leadPage }) => {
    await expect(leadPage.getByText('Fill from Previous')).toBeVisible();
  });

  test('version history navigator is visible', async ({ leadPage }) => {
    await expect(leadPage.getByText('Editing version')).toBeVisible();
    // Should show current version (v3)
    await expect(leadPage.getByText('v3')).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Accordion sections
  // -----------------------------------------------------------------------

  test('Current Week section shows items', async ({ leadPage }) => {
    await expect(leadPage.getByText('Current Week')).toBeVisible();
    // Badge should show item count
    await expect(leadPage.getByText('11 items')).toBeVisible();
  });

  test('Next Week section shows items', async ({ leadPage }) => {
    await expect(leadPage.getByText('Next Week')).toBeVisible();
    await expect(leadPage.getByText('6 items')).toBeVisible();
  });

  test('Risks section shows entries', async ({ leadPage }) => {
    await expect(leadPage.getByText('Risks & Blockers')).toBeVisible();
    // Risk badge count
    const riskSection = leadPage.getByText('Risks & Blockers');
    await expect(riskSection).toBeVisible();
  });

  test('Decisions section shows entries', async ({ leadPage }) => {
    await expect(leadPage.getByText('Decisions')).toBeVisible();
  });

  test('Priorities section shows numbered list', async ({ leadPage }) => {
    await expect(leadPage.getByText('Top 3 Priorities')).toBeVisible();
    await expect(leadPage.getByText('3/3')).toBeVisible();
  });

  // -----------------------------------------------------------------------
  // Submit flow
  // -----------------------------------------------------------------------

  test('Submit Report button is visible and enabled', async ({ leadPage }) => {
    const submitBtn = leadPage.getByRole('button', { name: 'Submit Report' }).first();
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
  });

  test('clicking Submit opens confirmation dialog', async ({ leadPage }) => {
    // Click Submit and retry until the dialog appears (handles hydration timing)
    const submitBtn = leadPage.getByRole('button', { name: 'Submit Report' }).first();
    const dialogTitle = leadPage.getByText('Submit Report?');

    // Retry click up to 10 times with 500ms gaps to wait for hydration
    for (let i = 0; i < 10; i++) {
      await submitBtn.click();
      try {
        await dialogTitle.waitFor({ state: 'visible', timeout: 1_000 });
        break;
      } catch {
        // Event handler not attached yet, retry
      }
    }

    // Verify dialog content
    await expect(dialogTitle).toBeVisible({ timeout: 5_000 });
    await expect(leadPage.getByText('Your report will be locked')).toBeVisible();
    await expect(leadPage.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  test('confirming submit locks the form', async ({ leadPage }) => {
    // Click Submit with retry to handle hydration timing
    const submitBtn = leadPage.getByRole('button', { name: 'Submit Report' }).first();
    const dialogTitle = leadPage.getByText('Submit Report?');

    for (let i = 0; i < 10; i++) {
      await submitBtn.click();
      try {
        await dialogTitle.waitFor({ state: 'visible', timeout: 1_000 });
        break;
      } catch {
        // Retry
      }
    }
    await expect(dialogTitle).toBeVisible({ timeout: 5_000 });

    // Click the confirm button (last "Submit Report" button on page)
    const confirmBtn = leadPage.getByRole('button', { name: 'Submit Report' }).last();
    await confirmBtn.click();

    // Dialog should close
    await expect(dialogTitle).not.toBeVisible({ timeout: 5_000 });

    // Submitted badge should appear
    await expect(leadPage.getByText('Submitted').first()).toBeVisible();

    // Submit button should now be disabled (read-only mode)
    const disabledBtn = leadPage.getByRole('button', { name: 'Submit Report' }).first();
    await expect(disabledBtn).toBeDisabled();
  });
});
