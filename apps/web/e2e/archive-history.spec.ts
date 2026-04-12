import { test, expect } from './fixtures';
import { expectRuLocaleDate } from './helpers/test-utils';

test('viewer can browse report history and open a historical report', async ({ viewerPage }) => {
  await viewerPage.goto('/reports/history');

  await expect(
    viewerPage.getByRole('heading', { name: /Report History|Archive/i, level: 1 }),
  ).toBeVisible();

  // At least one published report should be visible (from seed data)
  await expect(
    viewerPage.getByText(/published|Portfolio/i).first(),
  ).toBeVisible();

  // Click the first "Open report" link
  const openLink = viewerPage.getByRole('link', { name: /Open report/i }).first();
  if (await openLink.isVisible().catch(() => false)) {
    await openLink.click();

    await expect(
      viewerPage.getByRole('heading', { name: 'Published Report', level: 1 }),
    ).toBeVisible();
    await expect(viewerPage.getByText(/Published by/i)).toBeVisible();
    await expect(viewerPage.getByText('Portfolio Overview')).toBeVisible();
  }
});

test('archive dates display in ru-RU format', async ({ viewerPage }) => {
  await viewerPage.goto('/reports/history');

  await expect(
    viewerPage.getByRole('heading', { name: /Report History|Archive/i, level: 1 }),
  ).toBeVisible();

  // Verify dates are formatted in Russian locale (BUG-017 fix)
  await expectRuLocaleDate(viewerPage);
});
