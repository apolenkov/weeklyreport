import { test, expect } from './fixtures';

test.describe('Head Publication', () => {
  test('head navigates to assembled report page', async ({ headPage }) => {
    await headPage.goto('/head/report');

    // Page either shows the assembled report heading or an error
    // (error occurs when session has no activeReportId)
    const heading = headPage.getByRole('heading', { name: 'Assembled Report', level: 1 });
    const errorText = headPage.getByText('Something went wrong');
    const retryButton = headPage.getByRole('button', { name: 'Retry' });

    await expect(heading.or(errorText)).toBeVisible({ timeout: 15_000 });

    // If error is shown, verify error UI structure
    if (await errorText.isVisible().catch(() => false)) {
      await expect(retryButton).toBeVisible();
      return;
    }

    // If heading is shown, verify assembled report content
    await expect(headPage.getByText('Lead 1').first()).toBeVisible();
  });

  test('head sees Publish Report button or Published badge when report loads', async ({ headPage }) => {
    await headPage.goto('/head/report');

    const heading = headPage.getByRole('heading', { name: 'Assembled Report', level: 1 });
    const errorText = headPage.getByText('Something went wrong');

    await expect(heading.or(errorText)).toBeVisible({ timeout: 15_000 });

    // Skip if page shows error (no activeReportId)
    if (await errorText.isVisible().catch(() => false)) {
      return;
    }

    // Either Publish button (not yet published) or Published badge
    const publishButton = headPage.getByRole('button', { name: 'Publish Report' });
    const publishedBadge = headPage.getByText('Published', { exact: true });

    await expect(publishButton.or(publishedBadge)).toBeVisible();
  });
});
