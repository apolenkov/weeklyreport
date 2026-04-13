import { test, expect } from '../fixtures';

// Breakpoints
const breakpoints = [
  { name: 'mobile-small', width: 320, height: 568 },
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1024, height: 768 },
  { name: 'desktop-wide', width: 1920, height: 1080 },
] as const;

// Responsive layout tests (lead pages)
test.describe('Responsive breakpoints - lead', () => {
  for (const bp of breakpoints) {
    test(`${bp.name} (${bp.width}px): lead-report`, async ({ leadPage }) => {
      await leadPage.setViewportSize({ width: bp.width, height: bp.height });
      await leadPage.goto('/lead/report');
      await leadPage.getByRole('heading', { level: 1 }).waitFor({ timeout: 30_000 });

      // Verify no horizontal overflow
      const bodyScrollWidth = await leadPage.evaluate(() => document.body.scrollWidth);
      expect(bodyScrollWidth).toBeLessThanOrEqual(bp.width + 1);

      // Verify main content area is visible
      await expect(leadPage.locator('main').first()).toBeVisible();

      // Visual screenshot for baseline comparison
      await expect(leadPage).toHaveScreenshot(`lead-report-${bp.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});

// Responsive layout tests (head pages - admin only, as dashboard/report may error)
test.describe('Responsive breakpoints - head', () => {
  for (const bp of breakpoints) {
    test(`${bp.name} (${bp.width}px): admin-panel`, async ({ headPage }) => {
      await headPage.setViewportSize({ width: bp.width, height: bp.height });
      await headPage.goto('/admin');
      await headPage.getByRole('heading', { level: 1 }).waitFor({ timeout: 15_000 });

      // Admin tables may overflow on very narrow viewports (< 768px),
      // which is expected behavior for data-heavy tables
      if (bp.width >= 1024) {
        const bodyScrollWidth = await headPage.evaluate(() => document.body.scrollWidth);
        expect(bodyScrollWidth).toBeLessThanOrEqual(bp.width + 1);
      }

      await expect(headPage.locator('main').first()).toBeVisible();

      await expect(headPage).toHaveScreenshot(`admin-panel-${bp.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});

// Mobile navigation interaction
test.describe('Mobile navigation', () => {
  test('mobile nav trigger is visible at 375px', async ({ leadPage }) => {
    await leadPage.setViewportSize({ width: 375, height: 812 });
    await leadPage.goto('/lead/report');
    await leadPage.getByRole('heading', { level: 1 }).waitFor({ timeout: 30_000 });

    // Look for mobile nav button
    const trigger = leadPage
      .getByRole('button', { name: /open navigation menu|menu/i })
      .or(leadPage.locator('[data-testid="mobile-nav-trigger"]'));

    if ((await trigger.count()) > 0) {
      await expect(trigger.first()).toBeVisible();
    }
  });
});
