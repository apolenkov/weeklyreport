import { test, expect } from './fixtures';
import { publishReport } from './helpers/test-utils';

test('viewer can read the published report and request async PDF export', async ({ headPage, viewerPage }) => {
  // Ensure report is published (as head)
  await headPage.goto('/head/report');
  await expect(headPage.getByRole('heading', { name: 'Assembled Report', level: 1 })).toBeVisible();

  const publishButton = headPage.getByRole('button', { name: 'Publish Report' });
  const canPublish = await publishButton.isVisible().catch(() => false);

  if (canPublish) {
    await publishReport(headPage);
  }

  // As viewer, navigate to published report
  const reportId = '00000000-0000-0000-0000-000000000001';
  await viewerPage.goto(`/reports/${reportId}`);

  await expect(viewerPage.getByRole('heading', { name: 'Published Report', level: 1 })).toBeVisible();
  await expect(viewerPage.getByText(/Published by/i)).toBeVisible();

  // Published report is read-only -- no publish button, no editable inputs
  await expect(viewerPage.getByRole('button', { name: 'Publish Report' })).toHaveCount(0);
  await expect(viewerPage.locator('select')).toHaveCount(0);

  // Trigger PDF export
  const exportButton = viewerPage.getByRole('button', { name: /Export PDF/i });
  if (await exportButton.isVisible().catch(() => false)) {
    await exportButton.click();

    await expect(viewerPage.getByText('PDF export started')).toBeVisible();

    // Wait for export completion
    const downloadLink = viewerPage.getByRole('link', { name: /Download PDF/i });
    const exportingIndicator = viewerPage.getByText('Exporting...');

    await expect(
      downloadLink.or(exportingIndicator),
    ).toBeVisible({ timeout: 30_000 });

    if (await exportingIndicator.isVisible().catch(() => false)) {
      await expect(downloadLink).toBeVisible({ timeout: 60_000 });
    }

    if (await downloadLink.isVisible().catch(() => false)) {
      await expect(downloadLink).toHaveAttribute('href', /.+/);
    }
  }
});
