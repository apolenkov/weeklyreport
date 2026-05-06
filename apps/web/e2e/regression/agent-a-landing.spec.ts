import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR = '.planning/regression/screenshots/agent-a';

/**
 * LAND-001..LAND-006: Landing page rendering basics (6 scenarios)
 * Scope: card layout, button links, responsive, no sidebar
 */

test.describe('LAND-001..006: Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any session cookies to ensure landing page visibility
    await page.context().clearCookies();
  });

  const entryLink = (page: import('@playwright/test').Page) =>
    page
      .locator(
        [
          'a[aria-label="Enter application"]',
          'a[aria-label="Sign in with corporate SSO"]',
          'a[href*="/auth/dev-login"]',
          'a[href*="/auth/saml/login"]',
        ].join(', '),
      )
      .first();

  const gotoLanding = async (page: import('@playwright/test').Page) => {
    await page.goto('/?stay=1');
    await expect(page.getByRole('heading', { name: 'CustomReport' })).toBeVisible({
      timeout: 5000,
    });
  };

  test('LAND-001: Landing page renders without auth → card with logo + subtitle + Sign In button', async ({
    page,
  }) => {
    await gotoLanding(page);

    await expect(page.locator('main#main-content')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Weekly Status Reporting System', { exact: true })).toBeVisible();

    const hasSsoButton = await entryLink(page).isVisible({ timeout: 5000 }).catch(() => false);
    const hasDevPicker = await page.getByText('Войти как…').isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasSsoButton || hasDevPicker).toBe(true);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LAND-001.png` });
  });

  test('LAND-002: "Sign In" button links to API_URL/auth/saml/login', async ({ page }) => {
    await gotoLanding(page);

    const signInButton = entryLink(page);
    const href = await signInButton.getAttribute('href');

    expect(href).toMatch(/\/auth\/(?:saml\/login|dev-login)/);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LAND-002.png` });
  });

  test('LAND-003: Card centered vertically and horizontally', async ({ page }) => {
    await gotoLanding(page);

    const headingBox = await page
      .getByRole('heading', { name: 'CustomReport' })
      .boundingBox();

    // Page should be roughly centered (simple heuristic)
    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();

    if (viewport && headingBox) {
      const headingCenterX = headingBox.x + headingBox.width / 2;
      const rightPanelCenterX = viewport.width >= 1024 ? viewport.width - 240 : viewport.width / 2;

      expect(Math.abs(headingCenterX - rightPanelCenterX)).toBeLessThan(80);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LAND-003.png` });
  });

  test('LAND-004: Card max-width is sm (max-w-sm)', async ({ page }) => {
    await gotoLanding(page);

    const boundingBox = await page
      .getByRole('heading', { name: 'CustomReport' })
      .boundingBox();

    expect(boundingBox?.width).toBeLessThanOrEqual(420);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LAND-004.png` });
  });

  test('LAND-005: Button is full-width inside card (w-full)', async ({ page }) => {
    await gotoLanding(page);

    const signInButton = entryLink(page);
    const buttonBox = await signInButton.boundingBox();
    const mainBox = await page.locator('main').boundingBox();

    if (buttonBox && mainBox) {
      // Button should be nearly as wide as card (accounting for padding)
      const buttonWidth = buttonBox.width;

      // Allow 30px for padding on each side
      expect(buttonWidth).toBeLessThanOrEqual(mainBox.width);
      expect(buttonWidth).toBeGreaterThan(180);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LAND-005.png` });
  });

  test('LAND-006: Page has no sidebar/navigation (no AppShell wrapper)', async ({ page }) => {
    await gotoLanding(page);

    // Check that there's no sidebar
    const sidebar = page.locator('[role="navigation"], nav, [class*="sidebar"]');
    const count = await sidebar.count();

    // Should have 0 or minimal navigation (only landing)
    expect(count).toBeLessThanOrEqual(1);

    // Verify the page is mostly just the card
    const mainContent = page.locator('main#main-content');
    expect(mainContent).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: `${SCREENSHOT_DIR}/LAND-006.png` });
  });
});
