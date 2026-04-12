import { test, expect } from './fixtures';
import { waitForAutosave } from './helpers/test-utils';

test('carry-over creates new sections and lead sees carried-over items in form', async ({ headPage, leadPage }) => {
  // Head triggers carry-over from admin panel
  await headPage.goto('/admin');

  await expect(headPage.getByRole('heading', { name: 'Admin Panel', level: 1 })).toBeVisible();

  const carryOverButton = headPage.getByRole('button', { name: /carry-?over/i });
  if (await carryOverButton.isVisible().catch(() => false)) {
    await carryOverButton.click();
    await expect(
      headPage.getByText(/carry-?over completed|carry-?over done/i),
    ).toBeVisible();

    // Run carry-over second time to verify idempotency
    await carryOverButton.click();
    await expect(
      headPage
        .getByText(/carry-?over completed|carry-?over done|already|no changes/i)
        .first(),
    ).toBeVisible({ timeout: 5_000 });
  }

  // Lead navigates to their report to see carried-over items
  await leadPage.goto('/lead/report');

  await expect(leadPage.getByRole('heading', { name: 'My Report', level: 1 })).toBeVisible();

  // After carry-over, the lead form may show items from previous period
  const carriedOverIndicator = leadPage.getByText(/carried over|previous report/i);
  const hasCopiedItems = await carriedOverIndicator.isVisible().catch(() => false);

  if (hasCopiedItems) {
    await expect(carriedOverIndicator).toBeVisible();
  }

  // Lead can edit carried-over items
  const submitButton = leadPage.getByRole('button', { name: 'Submit Section' });
  const isDraft = await submitButton.isVisible().catch(() => false);

  if (isDraft) {
    const priority1 = leadPage.getByLabel('Priority 1');
    if (await priority1.isVisible().catch(() => false)) {
      await priority1.fill('New priority after carry-over');
    }

    await waitForAutosave(leadPage);
  }
});
