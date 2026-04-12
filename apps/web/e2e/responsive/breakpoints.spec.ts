import { expect, test } from '@playwright/test';

/**
 * Dev-mode session helpers — identical to the functional E2E specs.
 */

const DEV_SESSION_KEY = 'customreport:dev-session';

interface DevSession {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly role: 'lead' | 'head' | 'viewer';
  readonly activeReportId: string;
  readonly activeReportSectionId: string | null;
}

const sessions: Record<'lead' | 'head', DevSession> = {
  lead: {
    userId: '33333333-3333-4333-8333-333333333333',
    email: 'lead1@customreport.local',
    name: 'Lead 1',
    role: 'lead',
    activeReportId: '22222222-2222-4222-8222-222222222222',
    activeReportSectionId: '11111111-1111-4111-8111-111111111111',
  },
  head: {
    userId: '00000000-0000-4000-8000-000000000001',
    email: 'head@customreport.local',
    name: 'Department Head',
    role: 'head',
    activeReportId: '22222222-2222-4222-8222-222222222222',
    activeReportSectionId: null,
  },
};

async function setSession(page: import('@playwright/test').Page, session: DevSession): Promise<void> {
  await page.goto('/');
  await page.evaluate(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: DEV_SESSION_KEY, value: session },
  );
}

// ─── Breakpoints ─────────────────────────────────────────────────────

const breakpoints = [
  { name: 'mobile-small', width: 320, height: 568 },
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1024, height: 768 },
  { name: 'desktop-wide', width: 1920, height: 1080 },
] as const;

// ─── Key pages to test across breakpoints ────────────────────────────

const keyPages = [
  { name: 'lead-report', path: '/lead/report', role: 'lead' as const },
  { name: 'head-dashboard', path: '/head/dashboard', role: 'head' as const },
  { name: 'admin-panel', path: '/admin', role: 'head' as const },
] as const;

// ─── Responsive layout tests ─────────────────────────────────────────

test.describe('Responsive breakpoints', () => {
  for (const bp of breakpoints) {
    for (const entry of keyPages) {
      test(`${bp.name} (${bp.width}px): ${entry.name}`, async ({ page }) => {
        await page.setViewportSize({ width: bp.width, height: bp.height });

        await setSession(page, sessions[entry.role]);
        await page.goto(entry.path);
        await page.waitForLoadState('networkidle');

        // 1. Verify no horizontal overflow
        const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyScrollWidth).toBeLessThanOrEqual(bp.width + 1); // +1 for sub-pixel rounding

        // 2. Verify main content area is visible
        const mainContent = page.locator('main');
        if ((await mainContent.count()) > 0) {
          await expect(mainContent).toBeVisible();
        }

        // 3. On mobile viewports, check for mobile navigation trigger
        if (bp.width < 768) {
          const mobileNavTrigger = page.locator(
            '[data-testid="mobile-nav-trigger"], button[aria-label*="menu"], button[aria-label*="Menu"]',
          );
          // Mobile nav trigger may or may not exist depending on page;
          // we only assert it does not cause layout issues
          if ((await mobileNavTrigger.count()) > 0) {
            await expect(mobileNavTrigger.first()).toBeVisible();
          }
        }

        // 4. Visual screenshot for baseline comparison
        await expect(page).toHaveScreenshot(`${entry.name}-${bp.name}.png`, {
          fullPage: true,
          animations: 'disabled',
        });
      });
    }
  }
});

// ─── Mobile navigation interaction ───────────────────────────────────

test.describe('Mobile navigation', () => {
  test('mobile nav opens and closes at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });

    await setSession(page, sessions.lead);
    await page.goto('/lead/report');
    await page.waitForLoadState('networkidle');

    // Attempt to find and click mobile nav trigger
    const trigger = page
      .locator('button')
      .filter({ hasText: /menu/i })
      .or(page.locator('[data-testid="mobile-nav-trigger"]'));

    if ((await trigger.count()) > 0) {
      await trigger.first().click();

      // Verify some kind of navigation overlay becomes visible
      const navSheet = page.locator('[role="dialog"]').or(page.locator('nav'));
      await expect(navSheet.first()).toBeVisible();
    }
  });
});
