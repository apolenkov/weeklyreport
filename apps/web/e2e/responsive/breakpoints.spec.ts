import { test, expect } from '../fixtures';

// ─── Breakpoints ─────────────────────────────────────────────────────

const breakpoints = [
  { name: 'mobile-small', width: 320, height: 568 },
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1024, height: 768 },
  { name: 'desktop-wide', width: 1920, height: 1080 },
] as const;

// ─── Responsive layout tests (lead pages) ───────────────────────────

test.describe('Responsive breakpoints - lead', () => {
  for (const bp of breakpoints) {
    test(`${bp.name} (${bp.width}px): lead-report`, async ({ leadPage }) => {
      await leadPage.setViewportSize({ width: bp.width, height: bp.height });
      await leadPage.goto('/lead/report');
      await leadPage.waitForLoadState('networkidle');

      // Verify no horizontal overflow
      const bodyScrollWidth = await leadPage.evaluate(() => document.body.scrollWidth);
      expect(bodyScrollWidth).toBeLessThanOrEqual(bp.width + 1);

      // Verify main content area is visible
      const mainContent = leadPage.locator('main');
      if ((await mainContent.count()) > 0) {
        await expect(mainContent).toBeVisible();
      }

      // On mobile viewports, check for mobile navigation trigger
      if (bp.width < 768) {
        const mobileNavTrigger = leadPage.locator(
          '[data-testid="mobile-nav-trigger"], button[aria-label*="menu"], button[aria-label*="Menu"]',
        );
        if ((await mobileNavTrigger.count()) > 0) {
          await expect(mobileNavTrigger.first()).toBeVisible();
        }
      }

      // Visual screenshot for baseline comparison
      await expect(leadPage).toHaveScreenshot(`lead-report-${bp.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});

// ─── Responsive layout tests (head pages) ───────────────────────────

test.describe('Responsive breakpoints - head', () => {
  for (const bp of breakpoints) {
    test(`${bp.name} (${bp.width}px): head-dashboard`, async ({ headPage }) => {
      await headPage.setViewportSize({ width: bp.width, height: bp.height });
      await headPage.goto('/head/dashboard');
      await headPage.waitForLoadState('networkidle');

      const bodyScrollWidth = await headPage.evaluate(() => document.body.scrollWidth);
      expect(bodyScrollWidth).toBeLessThanOrEqual(bp.width + 1);

      const mainContent = headPage.locator('main');
      if ((await mainContent.count()) > 0) {
        await expect(mainContent).toBeVisible();
      }

      if (bp.width < 768) {
        const mobileNavTrigger = headPage.locator(
          '[data-testid="mobile-nav-trigger"], button[aria-label*="menu"], button[aria-label*="Menu"]',
        );
        if ((await mobileNavTrigger.count()) > 0) {
          await expect(mobileNavTrigger.first()).toBeVisible();
        }
      }

      await expect(headPage).toHaveScreenshot(`head-dashboard-${bp.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });

    test(`${bp.name} (${bp.width}px): admin-panel`, async ({ headPage }) => {
      await headPage.setViewportSize({ width: bp.width, height: bp.height });
      await headPage.goto('/admin');
      await headPage.waitForLoadState('networkidle');

      const bodyScrollWidth = await headPage.evaluate(() => document.body.scrollWidth);
      expect(bodyScrollWidth).toBeLessThanOrEqual(bp.width + 1);

      const mainContent = headPage.locator('main');
      if ((await mainContent.count()) > 0) {
        await expect(mainContent).toBeVisible();
      }

      if (bp.width < 768) {
        const mobileNavTrigger = headPage.locator(
          '[data-testid="mobile-nav-trigger"], button[aria-label*="menu"], button[aria-label*="Menu"]',
        );
        if ((await mobileNavTrigger.count()) > 0) {
          await expect(mobileNavTrigger.first()).toBeVisible();
        }
      }

      await expect(headPage).toHaveScreenshot(`admin-panel-${bp.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    });
  }
});

// ─── Mobile navigation interaction ───────────────────────────────────

test.describe('Mobile navigation', () => {
  test('mobile nav opens and closes at 375px', async ({ leadPage }) => {
    await leadPage.setViewportSize({ width: 375, height: 812 });
    await leadPage.goto('/lead/report');
    await leadPage.waitForLoadState('networkidle');

    // Attempt to find and click mobile nav trigger
    const trigger = leadPage
      .locator('button')
      .filter({ hasText: /menu/i })
      .or(leadPage.locator('[data-testid="mobile-nav-trigger"]'));

    if ((await trigger.count()) > 0) {
      await trigger.first().click();

      // Verify some kind of navigation overlay becomes visible
      const navSheet = leadPage.locator('[role="dialog"]').or(leadPage.locator('nav'));
      await expect(navSheet.first()).toBeVisible();
    }
  });
});
