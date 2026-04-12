import { test, expect } from './fixtures';
import { publishReport } from './helpers/test-utils';

test('head can publish the assembled report and the surface becomes read-only', async ({ headPage }) => {
  await headPage.goto('/head/report');

  await expect(headPage.getByRole('heading', { name: 'Assembled Report', level: 1 })).toBeVisible();

  // Check if report can be published (not already published)
  const publishButton = headPage.getByRole('button', { name: 'Publish Report' });
  const canPublish = await publishButton.isVisible().catch(() => false);

  if (canPublish) {
    await publishReport(headPage);
  }

  // After publish, "Published" badge should appear
  await expect(headPage.getByText('Published')).toBeVisible();

  // Publish button should no longer be visible
  await expect(headPage.getByRole('button', { name: 'Publish Report' })).toHaveCount(0);
});
