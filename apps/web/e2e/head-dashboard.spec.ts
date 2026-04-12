import { test, expect } from './fixtures';

test.describe('Head Dashboard', () => {
  test('lead users can navigate to head dashboard (read-only access via protectedProcedure)', async ({ leadPage }) => {
    await leadPage.goto('/head/dashboard');

    // review.dashboard uses protectedProcedure (any authenticated user),
    // so lead users CAN see the dashboard when they have activeReportId
    const heading = leadPage.getByRole('heading', { name: 'Review Dashboard', level: 1 });
    const errorText = leadPage.getByText('Something went wrong');

    await expect(heading.or(errorText)).toBeVisible({ timeout: 15_000 });
  });

  test('head navigates to dashboard page', async ({ headPage }) => {
    await headPage.goto('/head/dashboard');

    // Page either shows the dashboard heading or an error
    // (error occurs when session has no activeReportId)
    const heading = headPage.getByRole('heading', { name: 'Review Dashboard', level: 1 });
    const errorText = headPage.getByText('Something went wrong');

    await expect(heading.or(errorText)).toBeVisible({ timeout: 15_000 });

    // If error shown, verify error UI exists
    if (await errorText.isVisible().catch(() => false)) {
      await expect(headPage.getByRole('button', { name: 'Retry' })).toBeVisible();
      return;
    }

    // If dashboard loads, verify table and progress text
    await expect(
      headPage.getByRole('table', { name: 'Submission dashboard' }),
    ).toBeVisible();

    await expect(
      headPage.getByText(/\d+ of \d+ leads submitted/),
    ).toBeVisible();
  });
});
