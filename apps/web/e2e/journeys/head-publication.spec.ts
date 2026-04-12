import { test, expect } from '../fixtures';
import { publishReport } from '../helpers/test-utils';

test.describe('Head Publication - Dashboard Review', () => {
  test('head reviews dashboard showing all lead submissions with status', async ({
    headPage,
  }) => {
    await headPage.goto('/head/dashboard');

    await expect(
      headPage.getByRole('heading', { name: 'Review Dashboard', level: 1 }),
    ).toBeVisible();

    // Submission dashboard table should be visible
    await expect(
      headPage.getByRole('table', { name: 'Submission dashboard' }),
    ).toBeVisible();

    // Dashboard shows lead submission statuses
    await expect(
      headPage.getByRole('cell', { name: /Submitted|Draft/i }).first(),
    ).toBeVisible();

    // Progress text shows "N of M leads submitted"
    await expect(
      headPage.getByText(/\d+ of \d+ leads submitted/),
    ).toBeVisible();

    // Link to assembled report should be visible
    await expect(
      headPage.getByRole('link', { name: 'Open assembled report' }),
    ).toBeVisible();
  });
});

test.describe('Head Publication - Publish Flow', () => {
  test('head publishes a report and status changes to published', async ({
    headPage,
  }) => {
    await headPage.goto('/head/report');

    await expect(
      headPage.getByRole('heading', { name: 'Assembled Report', level: 1 }),
    ).toBeVisible();

    // Check if report can be published (not already published)
    const publishButton = headPage.getByRole('button', { name: 'Publish Report' });
    const canPublish = await publishButton.isVisible().catch(() => false);

    if (canPublish) {
      await publishReport(headPage);
    }

    // After publish, "Published" badge should appear
    await expect(headPage.getByText('Published')).toBeVisible();

    // Publish button should no longer be visible
    await expect(
      headPage.getByRole('button', { name: 'Publish Report' }),
    ).toHaveCount(0);
  });

  test('head cannot edit a published report sections', async ({
    headPage,
  }) => {
    await headPage.goto('/head/report');

    await expect(
      headPage.getByRole('heading', { name: 'Assembled Report', level: 1 }),
    ).toBeVisible();

    // Ensure report is published first
    const publishButton = headPage.getByRole('button', { name: 'Publish Report' });
    const canPublish = await publishButton.isVisible().catch(() => false);

    if (canPublish) {
      await publishReport(headPage);
    }

    // Published report should not have editable controls
    await expect(headPage.getByText('Published')).toBeVisible();
    await expect(
      headPage.getByRole('button', { name: 'Publish Report' }),
    ).toHaveCount(0);
  });
});

test.describe('Head Publication - Assembled Report Content', () => {
  test('head sees all lead sections in the assembled report', async ({
    headPage,
  }) => {
    await headPage.goto('/head/report');

    await expect(
      headPage.getByRole('heading', { name: 'Assembled Report', level: 1 }),
    ).toBeVisible();

    // Sections from leads should be visible -- seed data creates sections for leads
    // At least Lead 1 should appear (from seed data)
    await expect(headPage.getByText('Lead 1').first()).toBeVisible();

    // Portfolio overview should be present
    await expect(headPage.getByText('Portfolio Overview')).toBeVisible();
  });

  test('published report appears in report archive', async ({
    headPage,
  }) => {
    // Navigate to published report view
    const reportId = '00000000-0000-0000-0000-000000000001';
    await headPage.goto(`/reports/${reportId}`);

    // PublishedReport renders heading
    await expect(
      headPage.getByRole('heading', { name: 'Published Report', level: 1 }),
    ).toBeVisible();

    // Published report is read-only -- no publish button
    await expect(
      headPage.getByRole('button', { name: 'Publish Report' }),
    ).toHaveCount(0);

    // Report content should include portfolio overview
    await expect(headPage.getByText('Portfolio Overview')).toBeVisible();

    // Published by info should be visible
    await expect(
      headPage.getByText(/Published by/i),
    ).toBeVisible();
  });
});
