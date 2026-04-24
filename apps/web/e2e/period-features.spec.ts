/**
 * Period Features E2E Tests
 *
 * Validates period navigation, Fill From, and version history features
 * on the lead report form (/lead/report) and head report (/head/report).
 * All data is currently mock; tests verify UI components exist and are interactive.
 *
 * Covers: E2E-06 (period navigation), E2E-07 (fill from), E2E-08 (version history)
 * Scenarios: SC-100..SC-130
 */

import { test, expect } from './fixtures';

// ---------------------------------------------------------------------------
// Shared setup helper
// ---------------------------------------------------------------------------

async function setupLeadPage(leadPage: import('@playwright/test').Page) {
  await leadPage.goto('/lead/report');
  await leadPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
  await leadPage.getByText('Product Status').waitFor({ state: 'visible', timeout: 15_000 });
  await leadPage.waitForLoadState('networkidle', { timeout: 15_000 });
}

// ---------------------------------------------------------------------------
// Period Navigation (E2E-06)
// ---------------------------------------------------------------------------

test.describe('Period Navigation', () => {
  test.beforeEach(async ({ leadPage }) => {
    await setupLeadPage(leadPage);
  });

  test('period navigator visible on lead form', async ({ leadPage }) => {
    const periodSelect = leadPage.getByLabel('Select reporting period');
    await expect(periodSelect).toBeVisible();
  });

  test('period navigator shows week label text', async ({ leadPage }) => {
    const periodSelect = leadPage.getByLabel('Select reporting period');
    // Default selection is the current period (Week 16)
    await expect(periodSelect).toHaveValue('2026-W16');
    // The select should contain options with week labels
    const options = leadPage.locator('select[aria-label="Select reporting period"] option');
    await expect(options).toHaveCount(5);
  });

  test('left and right arrow buttons visible and clickable', async ({ leadPage }) => {
    const prevButton = leadPage.getByLabel('Previous period');
    const nextButton = leadPage.getByLabel('Next period');

    await expect(prevButton).toBeVisible();
    await expect(nextButton).toBeVisible();

    // On current (latest) period: prev enabled, next disabled
    await expect(prevButton).toBeEnabled();
    await expect(nextButton).toBeDisabled();

    // Click previous to navigate to Week 15
    await prevButton.click();
    // URL should update with period parameter
    await leadPage.waitForURL(/period=2026-W15/, { timeout: 5_000 });
    // Now next should become enabled
    await expect(nextButton).toBeEnabled();
  });

  test('period dropdown lists all available periods', async ({ leadPage }) => {
    const periodSelect = leadPage.getByLabel('Select reporting period');
    // All 5 mock periods should be available as options
    const options = leadPage.locator('select[aria-label="Select reporting period"] option');
    await expect(options).toHaveCount(5);
    // First option should be the current period
    await expect(options.nth(0)).toContainText('Week 16');
    // Last option should be the oldest
    await expect(options.nth(4)).toContainText('Week 12');
    // Submitted periods have a checkmark
    await expect(options.nth(1)).toContainText('\u2713');
  });

  test('period navigator visible on head weekly report', async ({ headPage }) => {
    await headPage.goto('/head/report');
    await headPage.waitForSelector('#main-content', { state: 'visible', timeout: 15_000 });
    await headPage.waitForLoadState('networkidle', { timeout: 15_000 });

    const periodSelect = headPage.getByLabel('Select reporting period');
    await expect(periodSelect).toBeVisible();

    // Head page has "Previous week" / "Next week" labels
    const prevButton = headPage.getByLabel('Previous week');
    const nextButton = headPage.getByLabel('Next week');
    await expect(prevButton).toBeVisible();
    await expect(nextButton).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Fill From (E2E-07)
// ---------------------------------------------------------------------------

test.describe('Fill From', () => {
  test.beforeEach(async ({ leadPage }) => {
    await setupLeadPage(leadPage);
  });

  test('Fill from Previous button visible on lead form', async ({ leadPage }) => {
    await expect(leadPage.getByText('Fill from Previous')).toBeVisible();
  });

  test('Fill from dropdown opens on click and shows period list', async ({ leadPage }) => {
    const dropdownTrigger = leadPage.getByLabel('Choose past report to fill from');
    await expect(dropdownTrigger).toBeVisible();

    // Click dropdown trigger with retry for hydration
    for (let i = 0; i < 10; i++) {
      await dropdownTrigger.click();
      try {
        await leadPage.getByPlaceholder('Search reports...').waitFor({ state: 'visible', timeout: 1_000 });
        break;
      } catch {
        // Handler not yet attached, retry
      }
    }

    // Dropdown should be open with search input
    await expect(leadPage.getByPlaceholder('Search reports...')).toBeVisible({ timeout: 5_000 });
    // Past submitted periods should be listed inside the dropdown panel
    const dropdown = leadPage.locator('.absolute.right-0');
    await expect(dropdown.getByText('Week 15')).toBeVisible();
  });

  test('Fill from dropdown has searchable input', async ({ leadPage }) => {
    const dropdownTrigger = leadPage.getByLabel('Choose past report to fill from');

    // Open the dropdown with retry
    for (let i = 0; i < 10; i++) {
      await dropdownTrigger.click();
      try {
        await leadPage.getByPlaceholder('Search reports...').waitFor({ state: 'visible', timeout: 1_000 });
        break;
      } catch {
        // Retry
      }
    }

    const searchInput = leadPage.getByPlaceholder('Search reports...');
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Type to filter
    await searchInput.fill('Week 14');
    // Only Week 14 should remain in the filtered dropdown list
    const dropdown = leadPage.locator('.absolute.right-0');
    await expect(dropdown.getByText('Mar 31-Apr 6')).toBeVisible();
  });

  test('clicking a period option shows confirmation dialog', async ({ leadPage }) => {
    // Click "Fill from Previous" button with retry
    const fillButton = leadPage.getByText('Fill from Previous');

    for (let i = 0; i < 10; i++) {
      await fillButton.click();
      try {
        await leadPage
          .getByLabel('Confirm fill from previous')
          .waitFor({ state: 'visible', timeout: 1_000 });
        break;
      } catch {
        // Retry
      }
    }

    // Confirmation dialog should appear
    const dialog = leadPage.getByLabel('Confirm fill from previous');
    await expect(dialog).toBeVisible({ timeout: 5_000 });
    // Dialog text should mention "overwrite your current draft"
    await expect(leadPage.getByText('This will overwrite your current draft')).toBeVisible();
    // Cancel and confirm buttons should be present
    await expect(leadPage.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(leadPage.getByRole('button', { name: 'Replace & Fill' })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Version History (E2E-08)
// ---------------------------------------------------------------------------

test.describe('Version History', () => {
  test.beforeEach(async ({ leadPage }) => {
    await setupLeadPage(leadPage);
  });

  test('version history navigator visible on lead form', async ({ leadPage }) => {
    await expect(leadPage.getByText('Editing version')).toBeVisible();
    // Navigation arrows should be present
    await expect(leadPage.getByLabel('Previous version')).toBeVisible();
    await expect(leadPage.getByLabel('Next version')).toBeVisible();
  });

  test('Autosaved indicator visible', async ({ leadPage }) => {
    await expect(leadPage.getByText('Autosaved')).toBeVisible();
  });

  test('version navigation arrows visible and functional', async ({ leadPage }) => {
    const prevVersionBtn = leadPage.getByLabel('Previous version');
    const nextVersionBtn = leadPage.getByLabel('Next version');

    // On latest version: prev enabled, next disabled
    await expect(prevVersionBtn).toBeEnabled();
    await expect(nextVersionBtn).toBeDisabled();

    // Click previous to go to v2
    for (let i = 0; i < 10; i++) {
      await prevVersionBtn.click();
      try {
        await leadPage.getByText('v2').waitFor({ state: 'visible', timeout: 1_000 });
        break;
      } catch {
        // Retry
      }
    }

    await expect(leadPage.getByText('v2')).toBeVisible({ timeout: 5_000 });
    // Now next should be enabled (can go back to v3)
    await expect(nextVersionBtn).toBeEnabled();
  });

  test('version number and label displayed', async ({ leadPage }) => {
    // Current version (v3) should be displayed
    await expect(leadPage.getByText('v3')).toBeVisible();
    // The "Editing version" label precedes it
    await expect(leadPage.getByText('Editing version')).toBeVisible();
  });

  test('restore functionality accessible via version history modal', async ({ leadPage }) => {
    // Click the version button (showing v3) to open the history modal
    const versionButton = leadPage.locator('button', { hasText: 'v3' });

    for (let i = 0; i < 10; i++) {
      await versionButton.click();
      try {
        await leadPage
          .getByLabel('Version history')
          .waitFor({ state: 'visible', timeout: 1_000 });
        break;
      } catch {
        // Retry
      }
    }

    // Version history modal should be open
    const modal = leadPage.getByLabel('Version history');
    await expect(modal).toBeVisible({ timeout: 5_000 });

    // Should show all 3 versions
    await expect(modal.getByText('Version 3')).toBeVisible();
    await expect(modal.getByText('Version 2')).toBeVisible();
    await expect(modal.getByText('Version 1')).toBeVisible();

    // Latest version should have "Latest" badge, no Restore button
    await expect(modal.getByText('Latest')).toBeVisible();

    // Older versions should have Restore buttons
    const restoreButtons = modal.getByRole('button', { name: 'Restore' });
    await expect(restoreButtons).toHaveCount(2);

    // Close modal
    await leadPage.getByLabel('Close').click();
    await expect(modal).not.toBeVisible({ timeout: 3_000 });
  });
});
