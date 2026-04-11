import { test, expect } from '../fixtures';

test.describe('Head Journey', () => {
  test('head can review dashboard, view assembled report, publish, and verify', async ({
    headPage,
  }) => {
    // --- Step 1: Review dashboard ---
    await headPage.goto('/head/dashboard');

    // Heading "Review Dashboard" rendered by HeadDashboardPage
    await expect(
      headPage.getByRole('heading', { name: 'Review Dashboard', level: 1 }),
    ).toBeVisible();

    // SubmissionDashboard renders a DataTable with aria-label="Submission dashboard"
    await expect(
      headPage.getByRole('table', { name: 'Submission dashboard' }),
    ).toBeVisible();

    // Dashboard shows leads -- seed data has 6 leads
    // Lead 1 should show "Submitted" badge, others show "Draft"
    await expect(headPage.getByRole('cell', { name: 'Submitted' }).first()).toBeVisible();

    // Progress text shows "N of M leads submitted"
    await expect(headPage.getByText(/\d+ of \d+ leads submitted/)).toBeVisible();

    // "Open assembled report" link navigates to /head/report
    const assembledReportLink = headPage.getByRole('link', {
      name: 'Open assembled report',
    });
    await expect(assembledReportLink).toBeVisible();

    // --- Step 2: View assembled report ---
    await headPage.goto('/head/report');

    // Heading "Assembled Report" rendered by AssembledReportReview
    await expect(
      headPage.getByRole('heading', { name: 'Assembled Report', level: 1 }),
    ).toBeVisible();

    // Sections from leads should be visible (author names as card titles)
    // Seed data creates sections for all 6 leads
    await expect(headPage.getByText('Lead 1').first()).toBeVisible();

    // --- Step 3: Publish the report ---
    // "Publish Report" button rendered by AssembledReportReview when not published
    const publishButton = headPage.getByRole('button', {
      name: 'Publish Report',
    });
    const canPublish = await publishButton.isVisible().catch(() => false);

    if (canPublish) {
      await publishButton.click();

      // ConfirmDialog appears with title "Publish Report"
      await expect(
        headPage.getByRole('dialog').getByText('Publish Report'),
      ).toBeVisible();

      // Click confirm button (confirmLabel="Publish")
      await headPage
        .getByRole('dialog')
        .getByRole('button', { name: 'Publish' })
        .click();

      // Verify publication success -- toast shows "Report published"
      await expect(headPage.getByText('Report published')).toBeVisible();
    }

    // After publish, "Published" badge should appear
    await expect(headPage.getByText('Published')).toBeVisible();

    // Publish button should no longer be visible
    await expect(
      headPage.getByRole('button', { name: 'Publish Report' }),
    ).toHaveCount(0);

    // --- Step 4: Verify published report is accessible ---
    const reportId = '00000000-0000-0000-0000-000000000001';
    await headPage.goto(`/reports/${reportId}`);

    // PublishedReport renders heading "Published Report"
    await expect(
      headPage.getByRole('heading', { name: 'Published Report', level: 1 }),
    ).toBeVisible();

    // Published report is read-only -- no publish button
    await expect(
      headPage.getByRole('button', { name: 'Publish Report' }),
    ).toHaveCount(0);

    // Report content should be visible (portfolio overview card)
    await expect(headPage.getByText('Portfolio Overview')).toBeVisible();
  });
});
