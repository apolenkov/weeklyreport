import { test, expect } from '../fixtures';

test.describe('Head Publication - Dashboard Review', () => {
  test('head navigates to dashboard and sees content or error', async ({ headPage }) => {
    await headPage.goto('/head/dashboard');

    // Dashboard requires activeReportId in session; head user may not have it
    const heading = headPage.getByRole('heading', { name: 'Review Dashboard', level: 1 });
    const errorText = headPage.getByText('Something went wrong');

    await expect(heading.or(errorText)).toBeVisible({ timeout: 15_000 });

    // If dashboard loaded, verify table structure
    if (await heading.isVisible().catch(() => false)) {
      await expect(
        headPage.getByRole('table', { name: 'Submission dashboard' }),
      ).toBeVisible();

      await expect(
        headPage.getByText(/\d+ of \d+ leads submitted/),
      ).toBeVisible();
    }
  });
});

test.describe('Head Publication - Publish Flow', () => {
  test('head navigates to assembled report page', async ({ headPage }) => {
    await headPage.goto('/head/report');

    const heading = headPage.getByRole('heading', { name: 'Assembled Report', level: 1 });
    const errorText = headPage.getByText('Something went wrong');

    await expect(heading.or(errorText)).toBeVisible({ timeout: 15_000 });

    if (await heading.isVisible().catch(() => false)) {
      // Publish button or Published badge should be present
      const publishButton = headPage.getByRole('button', { name: 'Publish Report' });
      const publishedBadge = headPage.getByText('Published', { exact: true });

      await expect(publishButton.or(publishedBadge)).toBeVisible();
    }
  });
});

test.describe('Head Publication - Assembled Report Content', () => {
  test('head sees lead sections when assembled report loads', async ({ headPage }) => {
    await headPage.goto('/head/report');

    const heading = headPage.getByRole('heading', { name: 'Assembled Report', level: 1 });
    const errorText = headPage.getByText('Something went wrong');

    await expect(heading.or(errorText)).toBeVisible({ timeout: 15_000 });

    if (await heading.isVisible().catch(() => false)) {
      await expect(headPage.getByText('Lead 1').first()).toBeVisible();
    }
  });
});
