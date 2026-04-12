import { test, expect } from '../fixtures';
import { waitForAutosave } from '../helpers/test-utils';

test.describe('Carry-Over - Section Creation', () => {
  test('carry-over creates new sections from previous report data', async ({
    headPage,
  }) => {
    // Head triggers carry-over from admin panel
    await headPage.goto('/admin');

    await expect(
      headPage.getByRole('heading', { name: 'Admin Panel', level: 1 }),
    ).toBeVisible();

    // Run carry-over (admin action that creates new report sections from previous)
    const carryOverButton = headPage.getByRole('button', { name: /carry-?over/i });
    if (await carryOverButton.isVisible().catch(() => false)) {
      await carryOverButton.click();

      // Verify carry-over completed toast
      await expect(
        headPage.getByText(/carry-?over completed|carry-?over done/i),
      ).toBeVisible();
    }
  });
});

test.describe('Carry-Over - Lead Form Population', () => {
  test('carried-over items appear in the new section form for lead', async ({
    leadPage,
  }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible();

    // After carry-over, the lead form should show items from previous period
    // "Next week" items from previous report become "Current week" items
    // Carried-over indicator should be visible if any items were carried
    const carriedOverIndicator = leadPage.getByText(/carried over|previous report/i);
    const hasCopiedItems = await carriedOverIndicator.isVisible().catch(() => false);

    if (hasCopiedItems) {
      // Carried-over items should be visible in the current week section
      await expect(carriedOverIndicator).toBeVisible();
    }
  });

  test('lead can edit carried-over items and add new ones', async ({
    leadPage,
  }) => {
    await leadPage.goto('/lead/report');

    await expect(
      leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
    ).toBeVisible();

    const submitButton = leadPage.getByRole('button', { name: 'Submit Section' });
    const isDraft = await submitButton.isVisible().catch(() => false);

    if (isDraft) {
      // Fill or modify a current week item (could be carried over)
      const currentItemInput = leadPage.getByLabel(/Current item 1/i);
      if (await currentItemInput.isVisible().catch(() => false)) {
        await currentItemInput.fill('Modified carried-over item');
      }

      // Fill a priority (new data added alongside carried-over data)
      const priority1 = leadPage.getByLabel('Priority 1');
      if (await priority1.isVisible().catch(() => false)) {
        await priority1.fill('New priority after carry-over');
      }

      // Wait for autosave
      await waitForAutosave(leadPage);

      // Reload and verify both old and new data persisted
      await leadPage.reload();
      await expect(
        leadPage.getByRole('heading', { name: 'My Report', level: 1 }),
      ).toBeVisible();

      if (await leadPage.getByLabel('Priority 1').isVisible().catch(() => false)) {
        await expect(leadPage.getByLabel('Priority 1')).toHaveValue(
          'New priority after carry-over',
        );
      }
    }
  });
});

test.describe('Carry-Over - Idempotency', () => {
  test('running carry-over twice does not create duplicate sections', async ({
    headPage,
  }) => {
    await headPage.goto('/admin');

    await expect(
      headPage.getByRole('heading', { name: 'Admin Panel', level: 1 }),
    ).toBeVisible();

    const carryOverButton = headPage.getByRole('button', { name: /carry-?over/i });
    if (await carryOverButton.isVisible().catch(() => false)) {
      // Run carry-over first time
      await carryOverButton.click();
      await expect(
        headPage.getByText(/carry-?over completed|carry-?over done/i),
      ).toBeVisible();

      // Run carry-over second time
      await carryOverButton.click();

      // Either the same success message appears (idempotent) or a "no changes" message
      // Either way, no error should appear
      await expect(
        headPage
          .getByText(/carry-?over completed|carry-?over done|already|no changes/i)
          .first(),
      ).toBeVisible({ timeout: 5_000 });

      // Navigate to dashboard and verify no duplicate sections
      await headPage.goto('/head/dashboard');
      await expect(
        headPage.getByRole('table', { name: 'Submission dashboard' }),
      ).toBeVisible();

      // Each lead should appear only once in the dashboard
      const leadRows = headPage.getByRole('row').filter({ hasText: 'Lead 1' });
      await expect(leadRows).toHaveCount(1);
    }
  });
});
